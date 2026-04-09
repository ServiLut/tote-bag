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

  private async ensureMateriaPrimaCategory(tx: Prisma.TransactionClient) {
    let opexCategory = await tx.opexCategory.findUnique({
      where: { name: 'Materia Prima' },
    });

    if (!opexCategory) {
      opexCategory = await tx.opexCategory.create({
        data: {
          name: 'Materia Prima',
          description: 'Gastos en insumos y materia prima para produccion',
        },
      });
    }

    return opexCategory;
  }

  private canAdjustBatch(batch: {
    status: BatchStatus;
    quantityRemaining: number;
    quantityReceived: number;
  }) {
    return (
      batch.status === BatchStatus.PENDING
      || batch.quantityRemaining === batch.quantityReceived
    );
  }

  private async createPurchaseAdjustmentTransaction(
    tx: Prisma.TransactionClient,
    input: {
      amount: number;
      supplierId: string;
      purchaseBatchId: string;
      userId: string;
      description: string;
    },
  ) {
    if (input.amount === 0) {
      return;
    }

    const opexCategory = await this.ensureMateriaPrimaCategory(tx);

    await tx.financialTransaction.create({
      data: {
        type:
          input.amount < 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
        category: TransactionCategory.PURCHASE,
        amount: Math.abs(input.amount),
        description: input.description,
        userId: input.userId,
        supplierId: input.supplierId,
        purchaseBatchId: input.purchaseBatchId,
        opexCategoryId: opexCategory.id,
      },
    });
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
      const opexCategory = await this.ensureMateriaPrimaCategory(tx);

      const statusValue = this.isReceivedStatus(data.status)
        ? BatchStatus.IN_STOCK
        : BatchStatus.PENDING;

      const batch = await tx.purchaseBatch.create({
        data: {
          productId,
          variantId: data.variantId,
          supplierId: data.supplierId,
          quantityReceived: quantity,
          quantityRemaining: this.isReceivedStatus(data.status) ? quantity : 0,
          unitCost,
          totalCost,
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

      if (this.isReceivedStatus(data.status)) {
        await tx.variant.update({
          where: { id: data.variantId },
          data: {
            stock: { increment: quantity },
          },
        });

        await tx.financialTransaction.create({
          data: {
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PURCHASE,
            amount: totalCost,
            description: `Compra de lote (Materia Prima): Producto ${productId} - Prov: ${data.supplierId}`,
            userId: data.userId,
            purchaseBatchId: batch.id,
            supplierId: data.supplierId,
            opexCategoryId: opexCategory.id,
          },
        });

        await tx.supplier.update({
          where: { id: data.supplierId },
          data: {
            balance: { increment: totalCost },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'RECEIVE_BATCH',
          entity: 'PurchaseBatch',
          entityId: batch.id,
          userId: data.userId,
          payload: {
            productId,
            quantity,
            totalCost,
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

      const opexCategory = await this.ensureMateriaPrimaCategory(tx);
      const statusValue = this.isReceivedStatus(data.status)
        ? BatchStatus.IN_STOCK
        : BatchStatus.PENDING;
      let recalculatedTotalCost = 0;

      const batches: Prisma.PurchaseBatchGetPayload<{
        include: { product: true; supplier: true; variant: true };
      }>[] = [];

      for (const item of data.items) {
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

        await tx.supplier.update({
          where: { id: data.supplierId },
          data: {
            balance: { increment: recalculatedTotalCost },
          },
        });
      }

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

      const batch = await tx.purchaseBatch.create({
        data: {
          productId: data.productId,
          variantId: data.variantId,
          supplierId: data.supplierId,
          quantityReceived: data.quantityReceived,
          quantityRemaining: data.quantityReceived,
          unitCost: data.unitCost,
          totalCost,
          status: BatchStatus.IN_STOCK,
          createdAt: data.purchaseDate,
        },
        include: {
          product: true,
          supplier: true,
        },
      });

      await tx.variant.update({
        where: { id: data.variantId },
        data: {
          stock: { increment: data.quantityReceived },
        },
      });

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

      await tx.supplier.update({
        where: { id: data.supplierId },
        data: {
          balance: { increment: totalCost },
        },
      });

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

  async updatePurchaseBatch(
    batchId: string,
    data: {
      supplierId: string;
      productId: string;
      variantId: string;
      quantityReceived: number;
      unitCost: number;
      status: BatchInputStatus;
      purchaseDate?: string;
      userId: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existingBatch = await tx.purchaseBatch.findUnique({
        where: { id: batchId },
        include: {
          invoices: {
            select: { id: true },
          },
        },
      });

      if (!existingBatch) {
        throw new BadRequestException('Lote no encontrado');
      }

      if (!this.canAdjustBatch(existingBatch)) {
        throw new BadRequestException(
          'Solo puedes editar lotes que no hayan tenido movimientos de stock.',
        );
      }

      if (existingBatch.invoices.length > 0) {
        throw new BadRequestException(
          'No puedes editar un lote que ya tiene facturas asociadas.',
        );
      }

      if (data.quantityReceived <= 0) {
        throw new BadRequestException(
          'La cantidad recibida debe ser mayor a cero.',
        );
      }

      if (data.unitCost < 0) {
        throw new BadRequestException(
          'El costo unitario no puede ser negativo.',
        );
      }

      const supplier = await tx.supplier.findUnique({
        where: { id: data.supplierId },
        select: { id: true },
      });

      if (!supplier) {
        throw new BadRequestException('Proveedor no encontrado');
      }

      const variant = await tx.variant.findUnique({
        where: { id: data.variantId },
        select: { id: true, productId: true },
      });

      if (!variant || variant.productId !== data.productId) {
        throw new BadRequestException(
          'La variante no existe o no pertenece al producto seleccionado',
        );
      }

      const nextStatus = this.isReceivedStatus(data.status)
        ? BatchStatus.IN_STOCK
        : BatchStatus.PENDING;
      const nextTotalCost = data.quantityReceived * data.unitCost;
      const previousFinancialImpact =
        existingBatch.status === BatchStatus.IN_STOCK ? existingBatch.totalCost : 0;
      const nextFinancialImpact =
        nextStatus === BatchStatus.IN_STOCK ? nextTotalCost : 0;
      const previousStockImpact =
        existingBatch.status === BatchStatus.IN_STOCK
          ? existingBatch.quantityRemaining
          : 0;
      const nextStockImpact =
        nextStatus === BatchStatus.IN_STOCK ? data.quantityReceived : 0;

      if (existingBatch.variantId) {
        const previousVariantDelta =
          existingBatch.variantId === data.variantId
            ? nextStockImpact - previousStockImpact
            : -previousStockImpact;

        if (previousVariantDelta !== 0) {
          await tx.variant.update({
            where: { id: existingBatch.variantId },
            data: {
              stock: { increment: previousVariantDelta },
            },
          });
        }
      }

      if (
        existingBatch.variantId !== data.variantId
        && nextStockImpact !== 0
      ) {
        await tx.variant.update({
          where: { id: data.variantId },
          data: {
            stock: { increment: nextStockImpact },
          },
        });
      }

      if (existingBatch.supplierId === data.supplierId) {
        const balanceDelta = nextFinancialImpact - previousFinancialImpact;
        if (balanceDelta !== 0) {
          await tx.supplier.update({
            where: { id: data.supplierId },
            data: {
              balance: { increment: balanceDelta },
            },
          });
        }
      } else {
        if (previousFinancialImpact !== 0) {
          await tx.supplier.update({
            where: { id: existingBatch.supplierId },
            data: {
              balance: { decrement: previousFinancialImpact },
            },
          });
        }

        if (nextFinancialImpact !== 0) {
          await tx.supplier.update({
            where: { id: data.supplierId },
            data: {
              balance: { increment: nextFinancialImpact },
            },
          });
        }
      }

      if (existingBatch.supplierId === data.supplierId) {
        await this.createPurchaseAdjustmentTransaction(tx, {
          amount: nextFinancialImpact - previousFinancialImpact,
          supplierId: data.supplierId,
          purchaseBatchId: batchId,
          userId: data.userId,
          description: `Ajuste por edicion del lote ${batchId}`,
        });
      } else {
        await this.createPurchaseAdjustmentTransaction(tx, {
          amount: -previousFinancialImpact,
          supplierId: existingBatch.supplierId,
          purchaseBatchId: batchId,
          userId: data.userId,
          description: `Reversion financiera por traslado del lote ${batchId}`,
        });
        await this.createPurchaseAdjustmentTransaction(tx, {
          amount: nextFinancialImpact,
          supplierId: data.supplierId,
          purchaseBatchId: batchId,
          userId: data.userId,
          description: `Reasignacion financiera por edicion del lote ${batchId}`,
        });
      }

      const updatedBatch = await tx.purchaseBatch.update({
        where: { id: batchId },
        data: {
          supplierId: data.supplierId,
          productId: data.productId,
          variantId: data.variantId,
          quantityReceived: data.quantityReceived,
          quantityRemaining: nextStockImpact,
          unitCost: data.unitCost,
          totalCost: nextTotalCost,
          status: nextStatus,
          ...(data.purchaseDate
            ? {
                createdAt: new Date(data.purchaseDate),
              }
            : {}),
        },
        include: {
          product: true,
          supplier: true,
          variant: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE_PURCHASE_BATCH',
          entity: 'PurchaseBatch',
          entityId: batchId,
          userId: data.userId,
          payload: {
            previous: {
              supplierId: existingBatch.supplierId,
              productId: existingBatch.productId,
              variantId: existingBatch.variantId,
              quantityReceived: existingBatch.quantityReceived,
              unitCost: existingBatch.unitCost,
              totalCost: existingBatch.totalCost,
              status: existingBatch.status,
            },
            next: {
              supplierId: data.supplierId,
              productId: data.productId,
              variantId: data.variantId,
              quantityReceived: data.quantityReceived,
              unitCost: data.unitCost,
              totalCost: nextTotalCost,
              status: nextStatus,
            },
          },
        },
      });

      return updatedBatch;
    });
  }

  async deletePurchaseBatch(batchId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existingBatch = await tx.purchaseBatch.findUnique({
        where: { id: batchId },
        include: {
          invoices: {
            select: { id: true },
          },
        },
      });

      if (!existingBatch) {
        throw new BadRequestException('Lote no encontrado');
      }

      if (!this.canAdjustBatch(existingBatch)) {
        throw new BadRequestException(
          'Solo puedes borrar lotes que no hayan tenido movimientos de stock.',
        );
      }

      if (existingBatch.invoices.length > 0) {
        throw new BadRequestException(
          'No puedes borrar un lote que ya tiene facturas asociadas.',
        );
      }

      const stockImpact =
        existingBatch.status === BatchStatus.IN_STOCK
          ? existingBatch.quantityRemaining
          : 0;
      const financialImpact =
        existingBatch.status === BatchStatus.IN_STOCK
          ? existingBatch.totalCost
          : 0;

      if (existingBatch.variantId && stockImpact !== 0) {
        await tx.variant.update({
          where: { id: existingBatch.variantId },
          data: {
            stock: { decrement: stockImpact },
          },
        });
      }

      if (financialImpact !== 0) {
        await tx.supplier.update({
          where: { id: existingBatch.supplierId },
          data: {
            balance: { decrement: financialImpact },
          },
        });

        await this.createPurchaseAdjustmentTransaction(tx, {
          amount: -financialImpact,
          supplierId: existingBatch.supplierId,
          purchaseBatchId: batchId,
          userId,
          description: `Reversion financiera por borrado del lote ${batchId}`,
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'DELETE_PURCHASE_BATCH',
          entity: 'PurchaseBatch',
          entityId: batchId,
          userId,
          payload: {
            supplierId: existingBatch.supplierId,
            productId: existingBatch.productId,
            variantId: existingBatch.variantId,
            quantityReceived: existingBatch.quantityReceived,
            quantityRemaining: existingBatch.quantityRemaining,
            totalCost: existingBatch.totalCost,
            status: existingBatch.status,
          },
        },
      });

      await tx.purchaseBatch.delete({
        where: { id: batchId },
      });

      return { success: true };
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
        if (remainingToReduce <= 0) {
          break;
        }

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

        await tx.variant.update({
          where: { id: variantId },
          data: {
            stock: { decrement: amountFromThisBatch },
          },
        });

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

    if (activeBatches.length === 0) {
      return 0;
    }

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
