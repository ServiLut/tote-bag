import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BatchStatus, TransactionType, TransactionCategory } from '../../generated/client/enums';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getDetailedInventory() {
    const products = await this.prisma.product.findMany({
      include: {
        purchaseBatches: {
          where: {
            status: BatchStatus.IN_STOCK,
            quantityRemaining: { gt: 0 },
          },
          include: { supplier: true },
          orderBy: { createdAt: 'asc' },
        },
        images: { take: 1 },
      },
    });

    return products.map((product) => {
      const activeBatches = product.purchaseBatches;
      const totalStock = activeBatches.reduce((sum, b) => sum + b.quantityRemaining, 0);
      const totalValuation = activeBatches.reduce(
        (sum, b) => sum + b.quantityRemaining * b.unitCost,
        0,
      );
      const weightedAvgCost = totalStock > 0 ? totalValuation / totalStock : 0;

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        image: product.images[0]?.url,
        totalStock,
        totalValuation,
        weightedAvgCost,
        batches: activeBatches,
      };
    });
  }

  async getInventoryMovements() {
    return this.prisma.auditLog.findMany({
      where: {
        action: 'REDUCE_STOCK_FIFO',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createBatch(data: {
    productId: string;
    supplierId: string;
    quantityReceived: number;
    unitCost: number;
    purchaseDate: Date;
    userId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const totalCost = data.quantityReceived * data.unitCost;

      // 1. Create the Purchase Batch
      const batch = await tx.purchaseBatch.create({
        data: {
          productId: data.productId,
          supplierId: data.supplierId,
          quantityReceived: data.quantityReceived,
          quantityRemaining: data.quantityReceived,
          unitCost: data.unitCost,
          totalCost: totalCost,
          status: BatchStatus.IN_STOCK,
          createdAt: data.purchaseDate,
        },
        include: {
          product: true,
          supplier: true,
        },
      });

      // 2. Create the Financial Transaction (EXPENSE)
      await tx.financialTransaction.create({
        data: {
          type: TransactionType.EXPENSE,
          category: TransactionCategory.PURCHASE,
          amount: totalCost,
          description: `Compra de lote: ${batch.product.name} (${data.quantityReceived} und) - Prov: ${batch.supplier.name}`,
          userId: data.userId,
          purchaseBatchId: batch.id,
        },
      });

      // 3. Update Supplier balance (optional but good practice)
      await tx.supplier.update({
        where: { id: data.supplierId },
        data: {
          balance: { increment: totalCost },
        },
      });

      // 4. Log the action
      await tx.auditLog.create({
        data: {
          action: 'CREATE_PURCHASE_BATCH',
          entity: 'PurchaseBatch',
          entityId: batch.id,
          userId: data.userId,
          payload: {
            productId: data.productId,
            quantity: data.quantityReceived,
            unitCost: data.unitCost,
          },
        },
      });

      return batch;
    });
  }

  async findAllBatches() {
    return this.prisma.purchaseBatch.findMany({
      include: {
        product: true,
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllSuppliers() {
    return this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async reduceStockFIFO(productId: string, quantityToSell: number, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Find active batches for the product, sorted by creation date ASC
      const batches = await tx.purchaseBatch.findMany({
        where: {
          productId,
          quantityRemaining: { gt: 0 },
          status: BatchStatus.IN_STOCK,
        },
        orderBy: { createdAt: 'asc' },
      });

      let remainingToReduce = quantityToSell;
      let totalCOGS = 0;
      const reductions = [];

      for (const batch of batches) {
        if (remainingToReduce <= 0) break;

        const amountFromThisBatch = Math.min(batch.quantityRemaining, remainingToReduce);
        remainingToReduce -= amountFromThisBatch;
        totalCOGS += amountFromThisBatch * batch.unitCost;

        const newRemaining = batch.quantityRemaining - amountFromThisBatch;
        
        await tx.purchaseBatch.update({
          where: { id: batch.id },
          data: {
            quantityRemaining: newRemaining,
            status: newRemaining === 0 ? BatchStatus.DEPLETED : BatchStatus.IN_STOCK,
          },
        });

        // Log the change
        await tx.auditLog.create({
          data: {
            action: 'REDUCE_STOCK_FIFO',
            entity: 'PurchaseBatch',
            entityId: batch.id,
            userId,
            payload: {
              quantityReduced: amountFromThisBatch,
              previousRemaining: batch.quantityRemaining,
              newRemaining,
              unitCost: batch.unitCost,
            },
          },
        });

        reductions.push({
          batchId: batch.id,
          quantity: amountFromThisBatch,
          unitCost: batch.unitCost,
        });
      }

      if (remainingToReduce > 0) {
        throw new BadRequestException(
          `Stock insuficiente para el producto ${productId}. Faltan ${remainingToReduce} unidades.`,
        );
      }

      return { totalCOGS, reductions };
    });
  }

  async getAverageCost(productId: string): Promise<number> {
    const activeBatches = await this.prisma.purchaseBatch.findMany({
      where: {
        productId,
        quantityRemaining: { gt: 0 },
        status: BatchStatus.IN_STOCK,
      },
    });

    if (activeBatches.length === 0) return 0;

    const totalRemaining = activeBatches.reduce((sum, b) => sum + b.quantityRemaining, 0);
    const totalCostValue = activeBatches.reduce(
      (sum, b) => sum + b.quantityRemaining * b.unitCost,
      0,
    );

    return totalCostValue / totalRemaining;
  }
}
