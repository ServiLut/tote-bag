import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Product } from '../../generated/client/client';
import {
  BatchStatus,
  TransactionType,
  TransactionCategory,
} from '../../generated/client/enums';
import {
  BatchInputStatus,
  CreatePurchaseBatchDto,
} from './dto/create-purchase-batch.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private isReceivedStatus(status: CreatePurchaseBatchDto['status']) {
    return status === BatchInputStatus.RECIBIDO;
  }

  async receiveBatch(data: CreatePurchaseBatchDto & { userId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const quantity = data.quantityReceived || 0;
      const productId = data.productId || '';

      if (!quantity || !productId || !data.variantId) {
        throw new BadRequestException(
          'Faltan datos obligatorios (producto, variante o cantidad)',
        );
      }

      const variant = await tx.variant.findUnique({
        where: { id: data.variantId },
        select: { id: true, productId: true },
      });

      if (!variant || variant.productId !== productId) {
        throw new BadRequestException(
          'La variante no existe o no pertenece al producto seleccionado',
        );
      }

      const totalCost = data.totalCost;
      const unitCost = totalCost / quantity;

      // 1. Encontrar o crear la categoría de OPEX 'Materia Prima'
      let opexCategory = await tx.opexCategory.findUnique({
        where: { name: 'Materia Prima' },
      });

      if (!opexCategory) {
        opexCategory = await tx.opexCategory.create({
          data: {
            name: 'Materia Prima',
            description: 'Gastos en insumos y materia prima para producción',
          },
        });
      }

      // Map status
      const statusValue = this.isReceivedStatus(data.status)
        ? BatchStatus.IN_STOCK
        : BatchStatus.PENDING;

      // 2. Crear el registro en la tabla PurchaseBatch
      const batch = await tx.purchaseBatch.create({
        data: {
          productId: productId,
          variantId: data.variantId,
          supplierId: data.supplierId,
          quantityReceived: quantity,
          quantityRemaining: this.isReceivedStatus(data.status) ? quantity : 0,
          unitCost: unitCost,
          totalCost: totalCost,
          status: statusValue,
          createdAt: data.purchaseDate
            ? new Date(data.purchaseDate)
            : new Date(),
        },
        include: {
          product: true,
          supplier: true,
        },
      });

      // 2.5 Actualizar stock de la variante si es recibido
      if (this.isReceivedStatus(data.status)) {
        await tx.variant.update({
          where: { id: data.variantId },
          data: {
            stock: { increment: quantity },
          },
        });
      }

      // 3. Si el estado es 'RECIBIDO', crear automáticamente una FinancialTransaction vinculada
      if (this.isReceivedStatus(data.status)) {
        await tx.financialTransaction.create({
          data: {
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PURCHASE,
            amount: totalCost,
            description: `Compra de lote (Materia Prima): Producto ${productId} - Prov: ${data.supplierId}`,
            userId: data.userId,
            purchaseBatchId: batch.id,
            supplierId: data.supplierId,
            opexCategoryId: opexCategory.id, // Vinculamos a la categoría para reportes
          },
        });

        // 4. Actualizar el saldo del proveedor
        await tx.supplier.update({
          where: { id: data.supplierId },
          data: {
            balance: { increment: totalCost },
          },
        });
      }

      // 5. Log the action
      await tx.auditLog.create({
        data: {
          action: 'RECEIVE_BATCH',
          entity: 'PurchaseBatch',
          entityId: batch.id,
          userId: data.userId,
          payload: {
            productId: productId,
            quantity: quantity,
            totalCost: totalCost,
            status: data.status,
          },
        },
      });

      return batch;
    });
  }

  async createPurchaseBatch(data: CreatePurchaseBatchDto & { userId: string }) {
    return this.prisma.$transaction(async (tx) => {
      if (!data.items.length) {
        throw new BadRequestException(
          'Debes registrar al menos un item en el lote',
        );
      }

      // 1. Encontrar o crear la categoría de OPEX 'Materia Prima'
      let opexCategory = await tx.opexCategory.findUnique({
        where: { name: 'Materia Prima' },
      });

      if (!opexCategory) {
        opexCategory = await tx.opexCategory.create({
          data: {
            name: 'Materia Prima',
            description: 'Gastos en insumos y materia prima para producción',
          },
        });
      }

      const statusValue = this.isReceivedStatus(data.status)
        ? BatchStatus.IN_STOCK
        : BatchStatus.PENDING;
      let recalculatedTotalCost = 0;

      const batches: Prisma.PurchaseBatchGetPayload<{
        include: { product: true; supplier: true; variant: true };
      }>[] = [];

      // 2. Crear cada item del lote como un PurchaseBatch individual
      for (const item of data.items) {
        // Intentar encontrar el producto por ID o por nombre
        let product: Product | null;
        if (item.productId) {
          product = await tx.product.findUnique({
            where: { id: item.productId },
          });
        } else {
          product = await tx.product.findFirst({
            where: { name: item.nombre },
          });
        }

        if (!product) {
          throw new BadRequestException(
            `Producto o Insumo no encontrado: ${item.nombre}`,
          );
        }

        if (!item.variantId) {
          throw new BadRequestException(
            `El item ${item.nombre} debe incluir una variante`,
          );
        }

        const variant = await tx.variant.findUnique({
          where: { id: item.variantId },
          select: { id: true, productId: true },
        });

        if (!variant || variant.productId !== product.id) {
          throw new BadRequestException(
            `La variante seleccionada no pertenece al producto ${product.name}`,
          );
        }

        const batch = await tx.purchaseBatch.create({
          data: {
            productId: product.id,
            variantId: item.variantId,
            supplierId: data.supplierId,
            quantityReceived: item.cantidad,
            quantityRemaining: this.isReceivedStatus(data.status)
              ? item.cantidad
              : 0,
            unitCost: item.costoUnitario,
            totalCost: item.cantidad * item.costoUnitario,
            status: statusValue,
            createdAt: data.purchaseDate
              ? new Date(data.purchaseDate)
              : new Date(),
          },
          include: {
            product: true,
            supplier: true,
            variant: true,
          },
        });

        recalculatedTotalCost += item.cantidad * item.costoUnitario;

        // Actualizar stock de la variante si es recibido
        if (this.isReceivedStatus(data.status)) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: item.cantidad },
            },
          });
        }
        batches.push(batch);
      }

      // 3. Si el estado es 'RECIBIDO', crear la FinancialTransaction por el TOTAL
      if (this.isReceivedStatus(data.status)) {
        const supplier = await tx.supplier.findUnique({
          where: { id: data.supplierId },
        });

        await tx.financialTransaction.create({
          data: {
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PURCHASE,
            amount: recalculatedTotalCost,
            description: `Compra de lote de insumos - Prov: ${supplier?.name || 'Desconocido'}`,
            userId: data.userId,
            supplierId: data.supplierId,
            opexCategoryId: opexCategory.id,
          },
        });

        // 4. Actualizar saldo del proveedor
        await tx.supplier.update({
          where: { id: data.supplierId },
          data: {
            balance: { increment: recalculatedTotalCost },
          },
        });
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          action: 'CREATE_PURCHASE_BATCH_MULTIPLE',
          entity: 'PurchaseBatch',
          userId: data.userId,
          payload: {
            supplierId: data.supplierId,
            itemCount: data.items.length,
            totalCost: recalculatedTotalCost,
            status: data.status,
          },
        },
      });

      return batches;
    });
  }

  async getDetailedInventory() {
    const products = await this.prisma.product.findMany({
      include: {
        purchaseBatches: {
          where: {
            status: BatchStatus.IN_STOCK,
            quantityRemaining: { gt: 0 },
            variantId: { not: null },
          },
          include: { supplier: true },
          orderBy: { createdAt: 'asc' },
        },
        images: { take: 1 },
      },
    });

    return products.map((product) => {
      const activeBatches = product.purchaseBatches;
      const totalStock = activeBatches.reduce(
        (sum, b) => sum + b.quantityRemaining,
        0,
      );
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
        action: {
          in: ['REDUCE_STOCK_FIFO', 'RETURN_TO_STOCK'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createBatch(data: {
    productId: string;
    variantId: string;
    supplierId: string;
    quantityReceived: number;
    unitCost: number;
    purchaseDate: Date;
    userId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.variant.findUnique({
        where: { id: data.variantId },
        select: { id: true, productId: true },
      });

      if (!variant || variant.productId !== data.productId) {
        throw new BadRequestException(
          'La variante no existe o no pertenece al producto seleccionado',
        );
      }

      const totalCost = data.quantityReceived * data.unitCost;

      // 1. Create the Purchase Batch
      const batch = await tx.purchaseBatch.create({
        data: {
          productId: data.productId,
          variantId: data.variantId,
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

      // 2. Keep variant stock in sync with the new FIFO batch
      await tx.variant.update({
        where: { id: data.variantId },
        data: {
          stock: { increment: data.quantityReceived },
        },
      });

      // 3. Create the Financial Transaction (EXPENSE)
      await tx.financialTransaction.create({
        data: {
          type: TransactionType.EXPENSE,
          category: TransactionCategory.PURCHASE,
          amount: totalCost,
          description: `Compra de lote: Producto ${data.productId} (${data.quantityReceived} und) - Prov: ${data.supplierId}`,
          userId: data.userId,
          purchaseBatchId: batch.id,
        },
      });

      // 4. Update Supplier balance (optional but good practice)
      await tx.supplier.update({
        where: { id: data.supplierId },
        data: {
          balance: { increment: totalCost },
        },
      });

      // 5. Log the action
      await tx.auditLog.create({
        data: {
          action: 'CREATE_PURCHASE_BATCH',
          entity: 'PurchaseBatch',
          entityId: batch.id,
          userId: data.userId,
          payload: {
            productId: data.productId,
            variantId: data.variantId,
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
        variant: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllSuppliers() {
    return this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async reduceStockFIFO(
    variantId: string,
    quantityToSell: number,
    userId?: string,
    txClient?: Prisma.TransactionClient,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // Find active batches for the specific variant, sorted by creation date ASC
      const batches = await tx.purchaseBatch.findMany({
        where: {
          variantId,
          quantityRemaining: { gt: 0 },
          status: BatchStatus.IN_STOCK,
        },
        orderBy: { createdAt: 'asc' },
      });

      let remainingToReduce = quantityToSell;
      let totalCOGS = 0;
      const reductions: {
        batchId: string;
        supplierId: string;
        quantity: number;
        unitCost: number;
      }[] = [];

      for (const batch of batches) {
        if (remainingToReduce <= 0) break;

        const amountFromThisBatch = Math.min(
          batch.quantityRemaining,
          remainingToReduce,
        );
        remainingToReduce -= amountFromThisBatch;
        totalCOGS += amountFromThisBatch * batch.unitCost;

        const newRemaining = batch.quantityRemaining - amountFromThisBatch;

        await tx.purchaseBatch.update({
          where: { id: batch.id },
          data: {
            quantityRemaining: newRemaining,
            status:
              newRemaining === 0 ? BatchStatus.DEPLETED : BatchStatus.IN_STOCK,
          },
        });

        // 1.5 Actualizar stock de la variante (decremento)
        await tx.variant.update({
          where: { id: variantId },
          data: {
            stock: { decrement: amountFromThisBatch },
          },
        });

        // Log the change
        await tx.auditLog.create({
          data: {
            action: 'REDUCE_STOCK_FIFO',
            entity: 'PurchaseBatch',
            entityId: batch.id,
            userId: userId ?? null,
            payload: {
              variantId,
              quantityReduced: amountFromThisBatch,
              previousRemaining: batch.quantityRemaining,
              newRemaining,
              unitCost: batch.unitCost,
            },
          },
        });

        reductions.push({
          batchId: batch.id,
          supplierId: batch.supplierId,
          quantity: amountFromThisBatch,
          unitCost: batch.unitCost,
        });
      }

      if (remainingToReduce > 0) {
        throw new BadRequestException(
          `Stock insuficiente para la variante ${variantId}. Faltan ${remainingToReduce} unidades.`,
        );
      }

      return { totalCOGS, reductions };
    };

    if (txClient) {
      return execute(txClient);
    }

    return this.prisma.$transaction(async (tx) => {
      return execute(tx);
    });
  }

  async getAverageCost(productId: string): Promise<number> {
    const activeBatches = await this.prisma.purchaseBatch.findMany({
      where: {
        productId,
        variantId: { not: null },
        quantityRemaining: { gt: 0 },
        status: BatchStatus.IN_STOCK,
      },
    });

    if (activeBatches.length === 0) return 0;

    const totalRemaining = activeBatches.reduce(
      (sum, b) => sum + b.quantityRemaining,
      0,
    );
    const totalCostValue = activeBatches.reduce(
      (sum, b) => sum + b.quantityRemaining * b.unitCost,
      0,
    );

    return totalCostValue / totalRemaining;
  }
}
