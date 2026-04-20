import { Injectable, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Product } from '../../generated/client/client';
import {
  BatchStatus,
  PurchaseDocumentType,
  PurchaseBatchItemType,
  TransactionType,
  TransactionCategory,
} from '../../generated/client/enums';
import {
  BatchInputStatus,
  CreatePurchaseBatchDto,
  CreateSupplyItemDto,
  PurchaseBatchItemDto,
} from './dto/create-purchase-batch.dto';
import {
  decimalToNumber,
  roundMoney,
  toDecimal,
} from '../../common/utils/sales-tax.util';
import { ManagerApprovalsService } from '../manager-approvals/manager-approvals.service';

type ResolvedBatchLine = {
  item: PurchaseBatchItemDto;
  itemType: PurchaseBatchItemType;
  product: Product | null;
  variant: { id: string; productId: string } | null;
  supplyItem: { id: string; name: string; unitOfMeasure: string } | null;
  itemName: string | null;
  description: string | null;
  quantity: Decimal;
  unitOfMeasure: string;
  rawLineTotal: Decimal;
};

const PURCHASE_BATCH_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly managerApprovalsService: ManagerApprovalsService,
  ) {}

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
      batch.status === BatchStatus.PENDING ||
      batch.quantityRemaining === batch.quantityReceived
    );
  }

  private normalizeFreightCost(value?: number) {
    return Decimal.max(0, roundMoney(value ?? 0));
  }

  private toQuantityDecimal(value: Decimal.Value) {
    return toDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  }

  private quantityToNumber(value: Decimal.Value) {
    return this.toQuantityDecimal(value).toNumber();
  }

  private quantityToLegacyInt(value: Decimal.Value) {
    return this.toQuantityDecimal(value).toDecimalPlaces(0).toNumber();
  }

  private isWholeQuantity(value: Decimal.Value) {
    return this.toQuantityDecimal(value).isInteger();
  }

  private sanitizeOptionalText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private resolveRequiredSupportUrl(data: CreatePurchaseBatchDto) {
    const supportUrl = this.sanitizeOptionalText(data.supportUrl);

    if (!supportUrl) {
      throw new BadRequestException(
        'Debes adjuntar soporte PDF/JPG del proveedor para registrar la recepcion.',
      );
    }

    return supportUrl;
  }

  private resolveRequiredDocumentType(data: CreatePurchaseBatchDto) {
    if (!data.documentType) {
      throw new BadRequestException(
        'Debes indicar si el soporte del proveedor es factura o remision.',
      );
    }

    return data.documentType as PurchaseDocumentType;
  }

  private resolveLineItemType(item: PurchaseBatchItemDto) {
    if (item.itemType) {
      return item.itemType as PurchaseBatchItemType;
    }

    if (item.supplyItemId) {
      return PurchaseBatchItemType.SUPPLY;
    }

    if (item.variantId || item.productId) {
      return PurchaseBatchItemType.VARIANT;
    }

    return PurchaseBatchItemType.OTHER;
  }

  private serializeBatchMoney<T extends Record<string, unknown> | null>(
    batch: T,
  ): T {
    if (!batch) {
      return batch;
    }

    const result: Record<string, unknown> = { ...batch };

    if ('unitCost' in result) {
      result.unitCost = decimalToNumber(result.unitCost as Decimal.Value);
    }

    if ('totalCost' in result) {
      result.totalCost = decimalToNumber(result.totalCost as Decimal.Value);
    }

    if (Array.isArray(result.lines)) {
      result.lines = result.lines.map((line) =>
        this.serializePurchaseBatchLine(line as Record<string, unknown>),
      );
    }

    return result as T;
  }

  private serializePurchaseBatchLine<T extends Record<string, unknown> | null>(
    line: T,
  ): T {
    if (!line) {
      return line;
    }

    const result: Record<string, unknown> = { ...line };

    if ('quantity' in result) {
      result.quantity = this.quantityToNumber(result.quantity as Decimal.Value);
    }

    if ('quantityRemaining' in result) {
      result.quantityRemaining = this.quantityToNumber(
        result.quantityRemaining as Decimal.Value,
      );
    }

    if ('unitCost' in result) {
      result.unitCost = decimalToNumber(result.unitCost as Decimal.Value);
    }

    if ('lineTotal' in result) {
      result.lineTotal = decimalToNumber(result.lineTotal as Decimal.Value);
    }

    if (
      result.supplyItem &&
      typeof result.supplyItem === 'object' &&
      !Array.isArray(result.supplyItem)
    ) {
      result.supplyItem = this.serializeSupplyItem(
        result.supplyItem as Record<string, unknown>,
      );
    }

    return result as T;
  }

  private serializeSupplyItem<T extends Record<string, unknown> | null>(
    supplyItem: T,
  ): T {
    if (!supplyItem) {
      return supplyItem;
    }

    const result: Record<string, unknown> = { ...supplyItem };

    if ('cost' in result) {
      result.cost = decimalToNumber(result.cost as Decimal.Value);
    }

    if ('stock' in result) {
      result.stock = this.quantityToNumber(result.stock as Decimal.Value);
    }

    if ('minStock' in result && result.minStock !== null) {
      result.minStock = this.quantityToNumber(result.minStock as Decimal.Value);
    }

    return result as T;
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

  private async resolvePurchaseBatchLine(
    tx: Prisma.TransactionClient,
    item: PurchaseBatchItemDto,
  ): Promise<ResolvedBatchLine> {
    const itemType = this.resolveLineItemType(item);
    const quantity = this.toQuantityDecimal(item.cantidad || 0);
    const unitCost = roundMoney(item.costoUnitario || 0);
    const requestedUnitOfMeasure = this.sanitizeOptionalText(
      item.unitOfMeasure,
    );
    const unitOfMeasure = requestedUnitOfMeasure || 'und';

    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        `La cantidad de ${item.nombre || item.itemName || 'la linea'} debe ser mayor a cero`,
      );
    }

    if (unitCost.lessThan(0)) {
      throw new BadRequestException(
        `El costo unitario de ${item.nombre || item.itemName || 'la linea'} no puede ser negativo`,
      );
    }

    if (itemType === PurchaseBatchItemType.VARIANT) {
      if (!item.variantId) {
        throw new BadRequestException(
          `El item ${item.nombre || 'VARIANT'} debe incluir una variante`,
        );
      }

      if (!this.isWholeQuantity(quantity)) {
        throw new BadRequestException(
          `La cantidad de la variante ${item.variantId} debe ser entera`,
        );
      }

      const variant = await tx.variant.findUnique({
        where: { id: item.variantId },
        select: { id: true, productId: true },
      });

      if (!variant) {
        throw new BadRequestException('La variante seleccionada no existe');
      }

      if (item.productId && variant.productId !== item.productId) {
        throw new BadRequestException(
          `La variante seleccionada no pertenece al producto ${item.productId}`,
        );
      }

      const product = await tx.product.findUnique({
        where: { id: variant.productId },
      });

      if (!product) {
        throw new BadRequestException(
          'El producto de la variante seleccionada no existe',
        );
      }

      return {
        item,
        itemType,
        product,
        variant,
        supplyItem: null,
        itemName: null,
        description: null,
        quantity,
        unitOfMeasure,
        rawLineTotal: roundMoney(unitCost.mul(quantity)),
      };
    }

    if (itemType === PurchaseBatchItemType.SUPPLY) {
      if (!item.supplyItemId) {
        throw new BadRequestException('El insumo debe incluir supplyItemId');
      }

      const supplyItem = await tx.supplyItem.findUnique({
        where: { id: item.supplyItemId },
        select: { id: true, name: true, unitOfMeasure: true },
      });

      if (!supplyItem) {
        throw new BadRequestException('El insumo seleccionado no existe');
      }

      return {
        item,
        itemType,
        product: null,
        variant: null,
        supplyItem,
        itemName: supplyItem.name,
        description: this.sanitizeOptionalText(item.description),
        quantity,
        unitOfMeasure: requestedUnitOfMeasure || supplyItem.unitOfMeasure,
        rawLineTotal: roundMoney(unitCost.mul(quantity)),
      };
    }

    const itemName = this.sanitizeOptionalText(item.itemName || item.nombre);
    const description = this.sanitizeOptionalText(item.description);

    if (!itemName && !description) {
      throw new BadRequestException(
        `${itemType} debe incluir nombre o descripcion`,
      );
    }

    return {
      item,
      itemType,
      product: null,
      variant: null,
      supplyItem: null,
      itemName,
      description,
      quantity,
      unitOfMeasure,
      rawLineTotal: roundMoney(unitCost.mul(quantity)),
    };
  }

  async receiveBatch(data: CreatePurchaseBatchDto & { userId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const quantity = data.quantityReceived || 0;
      const productId = data.productId || '';
      const supportUrl = this.resolveRequiredSupportUrl(data);
      const documentType = this.resolveRequiredDocumentType(data);

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

      const invoiceTotal = roundMoney(data.totalCost);
      const freightCost = this.normalizeFreightCost(data.freightCost);
      const totalCost = roundMoney(invoiceTotal.plus(freightCost));
      const unitCost = roundMoney(totalCost.div(quantity));
      const totalCostNumber = decimalToNumber(totalCost);
      const unitCostNumber = decimalToNumber(unitCost);
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
          unitCost: unitCostNumber,
          totalCost: totalCostNumber,
          status: statusValue,
          documentType,
          supportUrl,
          createdAt: data.purchaseDate
            ? new Date(data.purchaseDate)
            : new Date(),
        },
        include: {
          product: true,
          supplier: true,
        },
      });

      await tx.purchaseBatchLine.create({
        data: {
          purchaseBatchId: batch.id,
          itemType: PurchaseBatchItemType.VARIANT,
          variantId: data.variantId,
          quantity,
          quantityRemaining: this.isReceivedStatus(data.status) ? quantity : 0,
          unitOfMeasure: 'und',
          unitCost: unitCostNumber,
          lineTotal: totalCostNumber,
          status: statusValue,
          notes: 'Linea generada desde endpoint legacy receive-batch',
        },
      });

      if (this.isReceivedStatus(data.status)) {
        await tx.variant.update({
          where: { id: data.variantId },
          data: {
            stock: { increment: quantity },
            costPrice: unitCostNumber,
          },
        });

        await tx.financialTransaction.create({
          data: {
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PURCHASE,
            amount: totalCostNumber,
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
            balance: { increment: totalCostNumber },
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
            invoiceTotal: decimalToNumber(invoiceTotal),
            freightCost: decimalToNumber(freightCost),
            totalCost: totalCostNumber,
            landedTotalCost: totalCostNumber,
            landedUnitCost: unitCostNumber,
            documentType,
            supportUrl,
            status: data.status,
          },
        },
      });

      return this.serializeBatchMoney(batch);
    });
  }

  async createPurchaseBatch(data: CreatePurchaseBatchDto & { userId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const supportUrl = this.resolveRequiredSupportUrl(data);
      const documentType = this.resolveRequiredDocumentType(data);

      if (!data.items.length) {
        throw new BadRequestException(
          'Debes registrar al menos una linea en el lote',
        );
      }

      const supplier = await tx.supplier.findUnique({
        where: { id: data.supplierId },
        select: { id: true, name: true },
      });

      if (!supplier) {
        throw new BadRequestException('Proveedor no encontrado');
      }

      const opexCategory = await this.ensureMateriaPrimaCategory(tx);
      const statusValue = this.isReceivedStatus(data.status)
        ? BatchStatus.IN_STOCK
        : BatchStatus.PENDING;
      const freightCost = this.normalizeFreightCost(data.freightCost);
      let invoiceSubtotal = new Decimal(0);
      let allocatedFreight = new Decimal(0);
      let recalculatedTotalCost = new Decimal(0);

      const resolvedItems: ResolvedBatchLine[] = [];

      for (const item of data.items) {
        const resolvedLine = await this.resolvePurchaseBatchLine(tx, item);
        invoiceSubtotal = invoiceSubtotal.plus(resolvedLine.rawLineTotal);
        resolvedItems.push(resolvedLine);
      }

      if (invoiceSubtotal.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'El valor facturado del lote debe ser mayor a cero',
        );
      }

      const singleVariantLine =
        resolvedItems.length === 1 &&
        resolvedItems[0].itemType === PurchaseBatchItemType.VARIANT;
      const legacyQuantity = singleVariantLine
        ? this.quantityToLegacyInt(resolvedItems[0].quantity)
        : 0;

      const batch = await tx.purchaseBatch.create({
        data: {
          productId: singleVariantLine ? resolvedItems[0].product?.id : null,
          variantId: singleVariantLine ? resolvedItems[0].variant?.id : null,
          supplierId: data.supplierId,
          quantityReceived: legacyQuantity,
          quantityRemaining: this.isReceivedStatus(data.status)
            ? legacyQuantity
            : 0,
          unitCost: 0,
          totalCost: 0,
          status: statusValue,
          documentType,
          supportUrl,
          createdAt: data.purchaseDate
            ? new Date(data.purchaseDate)
            : new Date(),
        },
        include: {
          product: true,
          supplier: true,
          variant: true,
          lines: {
            include: {
              variant: true,
              supplyItem: true,
            },
          },
        },
      });

      for (const [index, resolved] of resolvedItems.entries()) {
        const { item, rawLineTotal } = resolved;
        const lineFreight =
          index === resolvedItems.length - 1
            ? roundMoney(freightCost.minus(allocatedFreight))
            : roundMoney(rawLineTotal.div(invoiceSubtotal).mul(freightCost));
        allocatedFreight = allocatedFreight.plus(lineFreight);
        const landedLineTotal = roundMoney(rawLineTotal.plus(lineFreight));
        const landedUnitCost = roundMoney(
          landedLineTotal.div(resolved.quantity),
        );
        const landedLineTotalNumber = decimalToNumber(landedLineTotal);
        const landedUnitCostNumber = decimalToNumber(landedUnitCost);
        const quantityNumber = this.quantityToNumber(resolved.quantity);
        const lineStatus = this.isReceivedStatus(data.status)
          ? BatchStatus.IN_STOCK
          : BatchStatus.PENDING;

        await tx.purchaseBatchLine.create({
          data: {
            purchaseBatchId: batch.id,
            itemType: resolved.itemType,
            variantId: resolved.variant?.id ?? null,
            supplyItemId: resolved.supplyItem?.id ?? null,
            itemName: resolved.itemName,
            description: resolved.description,
            quantity: quantityNumber,
            quantityRemaining: this.isReceivedStatus(data.status)
              ? quantityNumber
              : 0,
            unitOfMeasure: resolved.unitOfMeasure,
            unitCost: landedUnitCostNumber,
            lineTotal: landedLineTotalNumber,
            status: lineStatus,
            notes: this.sanitizeOptionalText(item.notes),
          },
        });

        recalculatedTotalCost = recalculatedTotalCost.plus(landedLineTotal);

        if (
          this.isReceivedStatus(data.status) &&
          resolved.itemType === PurchaseBatchItemType.VARIANT &&
          resolved.variant
        ) {
          await tx.variant.update({
            where: { id: resolved.variant.id },
            data: {
              stock: {
                increment: this.quantityToLegacyInt(resolved.quantity),
              },
              costPrice: landedUnitCostNumber,
            },
          });
        }

        if (
          this.isReceivedStatus(data.status) &&
          resolved.itemType === PurchaseBatchItemType.SUPPLY &&
          resolved.supplyItem
        ) {
          await tx.supplyItem.update({
            where: { id: resolved.supplyItem.id },
            data: {
              stock: { increment: quantityNumber },
              cost: landedUnitCostNumber,
            },
          });
        }
      }

      const recalculatedTotalCostNumber = decimalToNumber(
        recalculatedTotalCost,
      );
      const updatedBatch = await tx.purchaseBatch.update({
        where: { id: batch.id },
        data: {
          totalCost: recalculatedTotalCostNumber,
          unitCost:
            legacyQuantity > 0
              ? decimalToNumber(recalculatedTotalCost.div(legacyQuantity))
              : 0,
        },
        include: {
          product: true,
          supplier: true,
          variant: true,
          lines: {
            include: {
              variant: true,
              supplyItem: true,
            },
          },
        },
      });

      if (this.isReceivedStatus(data.status)) {
        await tx.financialTransaction.create({
          data: {
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PURCHASE,
            amount: recalculatedTotalCostNumber,
            description: `Recepcion de abastecimiento - Prov: ${supplier.name}`,
            userId: data.userId,
            purchaseBatchId: batch.id,
            supplierId: data.supplierId,
            opexCategoryId: opexCategory.id,
          },
        });

        await tx.supplier.update({
          where: { id: data.supplierId },
          data: {
            balance: { increment: recalculatedTotalCostNumber },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'CREATE_PURCHASE_BATCH_MULTIPLE',
          entity: 'PurchaseBatch',
          entityId: batch.id,
          userId: data.userId,
          payload: {
            supplierId: data.supplierId,
            itemCount: data.items.length,
            lineTypes: resolvedItems.map((line) => line.itemType),
            invoiceSubtotal: decimalToNumber(invoiceSubtotal),
            freightCost: decimalToNumber(freightCost),
            totalCost: decimalToNumber(recalculatedTotalCost),
            landedTotalCost: decimalToNumber(recalculatedTotalCost),
            documentType,
            supportUrl,
            status: data.status,
          },
        },
      });

      return this.serializeBatchMoney(updatedBatch);
    }, PURCHASE_BATCH_TRANSACTION_OPTIONS);
  }

  async getDetailedInventory() {
    const activeLines = await this.prisma.purchaseBatchLine.findMany({
      where: {
        itemType: PurchaseBatchItemType.VARIANT,
        variantId: { not: null },
        status: BatchStatus.IN_STOCK,
        quantityRemaining: { gt: 0 },
        purchaseBatch: {
          status: BatchStatus.IN_STOCK,
          deletedAt: null,
        },
      },
      include: {
        variant: {
          include: {
            product: {
              include: {
                images: { take: 1 },
              },
            },
          },
        },
        purchaseBatch: {
          include: { supplier: true },
        },
      },
      orderBy: [{ purchaseBatch: { createdAt: 'asc' } }, { createdAt: 'asc' }],
    });

    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        image?: string | null;
        batches: Array<Record<string, unknown>>;
      }
    >();

    for (const line of activeLines) {
      if (!line.variant) {
        continue;
      }

      const product = line.variant.product;
      const current = grouped.get(product.id) ?? {
        id: product.id,
        name: product.name,
        slug: product.slug,
        image: product.images[0]?.url,
        batches: [],
      };

      current.batches.push({
        id: line.purchaseBatchId,
        lineId: line.id,
        quantityReceived: this.quantityToNumber(line.quantity),
        quantityRemaining: this.quantityToNumber(line.quantityRemaining),
        unitCost: line.unitCost,
        totalCost: line.lineTotal,
        status: line.status,
        createdAt: line.purchaseBatch.createdAt,
        supplier: line.purchaseBatch.supplier,
      });

      grouped.set(product.id, current);
    }

    return Array.from(grouped.values()).map((product) => {
      const totalStock = product.batches.reduce(
        (sum, batch) => sum + Number(batch.quantityRemaining || 0),
        0,
      );
      const totalValuation = product.batches.reduce(
        (sum, batch) =>
          sum.plus(
            toDecimal(batch.unitCost as Decimal.Value).mul(
              Number(batch.quantityRemaining || 0),
            ),
          ),
        new Decimal(0),
      );
      const weightedAvgCost =
        totalStock > 0 ? totalValuation.div(totalStock) : new Decimal(0);

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        image: product.image,
        totalStock,
        totalValuation: decimalToNumber(totalValuation),
        weightedAvgCost: decimalToNumber(weightedAvgCost),
        batches: product.batches.map((batch) =>
          this.serializeBatchMoney(batch),
        ),
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
    documentType?: PurchaseDocumentType;
    supportUrl?: string;
    userId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const supportUrl = this.sanitizeOptionalText(data.supportUrl);
      if (!supportUrl) {
        throw new BadRequestException(
          'Debes adjuntar soporte PDF/JPG del proveedor para registrar la recepcion.',
        );
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

      const unitCost = roundMoney(data.unitCost);
      const totalCost = roundMoney(unitCost.mul(data.quantityReceived));
      const unitCostNumber = decimalToNumber(unitCost);
      const totalCostNumber = decimalToNumber(totalCost);

      const batch = await tx.purchaseBatch.create({
        data: {
          productId: data.productId,
          variantId: data.variantId,
          supplierId: data.supplierId,
          quantityReceived: data.quantityReceived,
          quantityRemaining: data.quantityReceived,
          unitCost: unitCostNumber,
          totalCost: totalCostNumber,
          status: BatchStatus.IN_STOCK,
          documentType: data.documentType ?? PurchaseDocumentType.INVOICE,
          supportUrl,
          createdAt: data.purchaseDate,
        },
        include: {
          product: true,
          supplier: true,
        },
      });

      await tx.purchaseBatchLine.create({
        data: {
          purchaseBatchId: batch.id,
          itemType: PurchaseBatchItemType.VARIANT,
          variantId: data.variantId,
          quantity: data.quantityReceived,
          quantityRemaining: data.quantityReceived,
          unitOfMeasure: 'und',
          unitCost: unitCostNumber,
          lineTotal: totalCostNumber,
          status: BatchStatus.IN_STOCK,
          notes: 'Linea generada desde endpoint legacy batch',
        },
      });

      await tx.variant.update({
        where: { id: data.variantId },
        data: {
          stock: { increment: data.quantityReceived },
          costPrice: unitCostNumber,
        },
      });

      await tx.financialTransaction.create({
        data: {
          type: TransactionType.EXPENSE,
          category: TransactionCategory.PURCHASE,
          amount: totalCostNumber,
          description: `Compra de lote: Producto ${data.productId} (${data.quantityReceived} und) - Prov: ${data.supplierId}`,
          userId: data.userId,
          purchaseBatchId: batch.id,
        },
      });

      await tx.supplier.update({
        where: { id: data.supplierId },
        data: {
          balance: { increment: totalCostNumber },
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
            invoiceUnitCost: decimalToNumber(unitCost),
            landedUnitCost: unitCostNumber,
            landedTotalCost: totalCostNumber,
            documentType: data.documentType ?? PurchaseDocumentType.INVOICE,
            supportUrl,
          },
        },
      });

      return this.serializeBatchMoney(batch);
    });
  }

  async findAllBatches() {
    const batches = await this.prisma.purchaseBatch.findMany({
      where: { deletedAt: null },
      include: {
        product: true,
        supplier: true,
        variant: true,
        lines: {
          include: {
            variant: true,
            supplyItem: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return batches.map((batch) => this.serializeBatchMoney(batch));
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
      managerApprovalId?: string;
      managerApprovalReason?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.managerApprovalsService.requireApproval({
        actorUserId: data.userId,
        approvalId: data.managerApprovalId,
        reason: data.managerApprovalReason,
        resource: 'inventory',
        action: 'update-entry-costs',
        entity: 'PurchaseBatch',
        entityId: batchId,
        metadata: {
          supplierId: data.supplierId,
          variantId: data.variantId,
          quantityReceived: data.quantityReceived,
          unitCost: data.unitCost,
          status: data.status,
        },
        tx,
      });

      const existingBatch = await tx.purchaseBatch.findUnique({
        where: { id: batchId },
        include: {
          invoices: {
            select: { id: true },
          },
          lines: true,
        },
      });

      if (!existingBatch || existingBatch.deletedAt) {
        throw new BadRequestException('Lote no encontrado');
      }

      const existingLines = existingBatch.lines ?? [];

      if (
        existingLines.length > 1 ||
        (existingLines[0] &&
          existingLines[0].itemType !== PurchaseBatchItemType.VARIANT)
      ) {
        throw new BadRequestException(
          'Este endpoint solo edita lotes legacy de una variante. Usa el flujo de lineas para recepciones mixtas.',
        );
      }

      const canAdjustExisting =
        existingLines[0] !== undefined
          ? existingLines[0].status === BatchStatus.PENDING ||
            toDecimal(existingLines[0].quantityRemaining).equals(
              existingLines[0].quantity,
            )
          : this.canAdjustBatch(existingBatch);

      if (!canAdjustExisting) {
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
      const nextUnitCost = roundMoney(data.unitCost);
      const nextTotalCost = roundMoney(nextUnitCost.mul(data.quantityReceived));
      const nextUnitCostNumber = decimalToNumber(nextUnitCost);
      const nextTotalCostNumber = decimalToNumber(nextTotalCost);
      const previousFinancialImpact =
        existingBatch.status === BatchStatus.IN_STOCK
          ? roundMoney(existingBatch.totalCost)
          : new Decimal(0);
      const nextFinancialImpact =
        nextStatus === BatchStatus.IN_STOCK ? nextTotalCost : new Decimal(0);
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

      if (existingBatch.variantId !== data.variantId && nextStockImpact !== 0) {
        await tx.variant.update({
          where: { id: data.variantId },
          data: {
            stock: { increment: nextStockImpact },
          },
        });
      }

      if (nextStatus === BatchStatus.IN_STOCK) {
        await tx.variant.update({
          where: { id: data.variantId },
          data: {
            costPrice: nextUnitCostNumber,
          },
        });
      }

      if (existingBatch.supplierId === data.supplierId) {
        const balanceDelta = nextFinancialImpact.minus(previousFinancialImpact);
        if (!balanceDelta.isZero()) {
          await tx.supplier.update({
            where: { id: data.supplierId },
            data: {
              balance: { increment: decimalToNumber(balanceDelta) },
            },
          });
        }
      } else {
        if (!previousFinancialImpact.isZero()) {
          await tx.supplier.update({
            where: { id: existingBatch.supplierId },
            data: {
              balance: { decrement: decimalToNumber(previousFinancialImpact) },
            },
          });
        }

        if (!nextFinancialImpact.isZero()) {
          await tx.supplier.update({
            where: { id: data.supplierId },
            data: {
              balance: { increment: decimalToNumber(nextFinancialImpact) },
            },
          });
        }
      }

      if (existingBatch.supplierId === data.supplierId) {
        await this.createPurchaseAdjustmentTransaction(tx, {
          amount: decimalToNumber(
            nextFinancialImpact.minus(previousFinancialImpact),
          ),
          supplierId: data.supplierId,
          purchaseBatchId: batchId,
          userId: data.userId,
          description: `Ajuste por edicion del lote ${batchId}`,
        });
      } else {
        await this.createPurchaseAdjustmentTransaction(tx, {
          amount: decimalToNumber(previousFinancialImpact.negated()),
          supplierId: existingBatch.supplierId,
          purchaseBatchId: batchId,
          userId: data.userId,
          description: `Reversion financiera por traslado del lote ${batchId}`,
        });
        await this.createPurchaseAdjustmentTransaction(tx, {
          amount: decimalToNumber(nextFinancialImpact),
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
          unitCost: nextUnitCostNumber,
          totalCost: nextTotalCostNumber,
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
          lines: {
            include: {
              variant: true,
              supplyItem: true,
            },
          },
        },
      });

      if (existingLines[0]) {
        await tx.purchaseBatchLine.update({
          where: { id: existingLines[0].id },
          data: {
            itemType: PurchaseBatchItemType.VARIANT,
            variantId: data.variantId,
            supplyItemId: null,
            itemName: null,
            description: null,
            quantity: data.quantityReceived,
            quantityRemaining: nextStockImpact,
            unitOfMeasure: 'und',
            unitCost: nextUnitCostNumber,
            lineTotal: nextTotalCostNumber,
            status: nextStatus,
          },
        });
      } else {
        await tx.purchaseBatchLine.create({
          data: {
            purchaseBatchId: batchId,
            itemType: PurchaseBatchItemType.VARIANT,
            variantId: data.variantId,
            quantity: data.quantityReceived,
            quantityRemaining: nextStockImpact,
            unitOfMeasure: 'und',
            unitCost: nextUnitCostNumber,
            lineTotal: nextTotalCostNumber,
            status: nextStatus,
            notes: 'Linea generada al editar lote legacy',
          },
        });
      }

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
              unitCost: nextUnitCostNumber,
              totalCost: nextTotalCostNumber,
              status: nextStatus,
            },
          },
        },
      });

      return this.serializeBatchMoney(updatedBatch);
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
          lines: true,
        },
      });

      if (!existingBatch || existingBatch.deletedAt) {
        throw new BadRequestException('Lote no encontrado');
      }

      const existingLines = existingBatch.lines ?? [];
      const hasLines = existingLines.length > 0;
      const canAdjustLines = hasLines
        ? existingLines.every(
            (line) =>
              line.status === BatchStatus.PENDING ||
              toDecimal(line.quantityRemaining).equals(line.quantity),
          )
        : this.canAdjustBatch(existingBatch);

      if (!canAdjustLines) {
        throw new BadRequestException(
          'Solo puedes borrar lotes que no hayan tenido movimientos de stock.',
        );
      }

      if (existingBatch.invoices.length > 0) {
        throw new BadRequestException(
          'No puedes borrar un lote que ya tiene facturas asociadas.',
        );
      }

      const financialImpact =
        existingBatch.status === BatchStatus.IN_STOCK
          ? roundMoney(existingBatch.totalCost)
          : new Decimal(0);

      if (hasLines) {
        for (const line of existingLines) {
          if (line.status !== BatchStatus.IN_STOCK) {
            continue;
          }

          const quantity = this.quantityToNumber(line.quantityRemaining);

          if (
            line.itemType === PurchaseBatchItemType.VARIANT &&
            line.variantId &&
            quantity !== 0
          ) {
            await tx.variant.update({
              where: { id: line.variantId },
              data: {
                stock: { decrement: this.quantityToLegacyInt(quantity) },
              },
            });
          }

          if (
            line.itemType === PurchaseBatchItemType.SUPPLY &&
            line.supplyItemId &&
            quantity !== 0
          ) {
            await tx.supplyItem.update({
              where: { id: line.supplyItemId },
              data: {
                stock: { decrement: quantity },
              },
            });
          }
        }
      } else if (
        existingBatch.variantId &&
        existingBatch.status === BatchStatus.IN_STOCK &&
        existingBatch.quantityRemaining !== 0
      ) {
        await tx.variant.update({
          where: { id: existingBatch.variantId },
          data: {
            stock: { decrement: existingBatch.quantityRemaining },
          },
        });
      }

      if (!financialImpact.isZero()) {
        const financialImpactNumber = decimalToNumber(financialImpact);
        await tx.supplier.update({
          where: { id: existingBatch.supplierId },
          data: {
            balance: { decrement: financialImpactNumber },
          },
        });

        await this.createPurchaseAdjustmentTransaction(tx, {
          amount: -financialImpactNumber,
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
            lines: existingLines.map((line) => ({
              id: line.id,
              itemType: line.itemType,
              variantId: line.variantId,
              supplyItemId: line.supplyItemId,
              quantity: line.quantity,
              quantityRemaining: line.quantityRemaining,
            })),
          },
        },
      });

      await tx.purchaseBatchLine.updateMany({
        where: { purchaseBatchId: batchId },
        data: {
          quantityRemaining: 0,
          status: BatchStatus.CANCELLED,
        },
      });

      await tx.purchaseBatch.update({
        where: { id: batchId },
        data: {
          quantityRemaining: 0,
          status: BatchStatus.CANCELLED,
          deletedAt: new Date(),
        },
      });

      return { success: true };
    });
  }

  async findAllSuppliers() {
    return this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findReceivableVariants() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: [{ size: 'asc' }, { color: 'asc' }],
        },
        images: {
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findAllSupplyItems() {
    const supplyItems = await this.prisma.supplyItem.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return supplyItems.map((item) => this.serializeSupplyItem(item));
  }

  async createSupplyItem(data: CreateSupplyItemDto) {
    const name = data.name.trim();
    const category = data.category.trim();
    const unitOfMeasure = data.unitOfMeasure.trim();
    const sku = this.sanitizeOptionalText(data.sku);

    if (!name || !category || !unitOfMeasure) {
      throw new BadRequestException(
        'Nombre, categoria y unidad de medida son obligatorios',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const supplyItem = await tx.supplyItem.create({
        data: {
          name,
          sku,
          category,
          unitOfMeasure,
          cost: decimalToNumber(roundMoney(data.cost ?? 0)),
          stock: this.quantityToNumber(data.stock ?? 0),
          minStock:
            data.minStock === undefined
              ? undefined
              : this.quantityToNumber(data.minStock),
        },
      });

      return this.serializeSupplyItem(supplyItem);
    });
  }

  async reduceStockFIFO(
    variantId: string,
    quantityToSell: number,
    userId?: string,
    txClient?: Prisma.TransactionClient,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const lines = await tx.purchaseBatchLine.findMany({
        where: {
          variantId,
          quantityRemaining: { gt: 0 },
          status: BatchStatus.IN_STOCK,
          itemType: PurchaseBatchItemType.VARIANT,
          purchaseBatch: {
            status: BatchStatus.IN_STOCK,
            deletedAt: null,
          },
        },
        include: {
          purchaseBatch: {
            select: {
              id: true,
              supplierId: true,
              variantId: true,
              createdAt: true,
            },
          },
        },
        orderBy: [
          { purchaseBatch: { createdAt: 'asc' } },
          { createdAt: 'asc' },
        ],
      });

      let remainingToReduce = quantityToSell;
      let totalCOGS = new Decimal(0);
      const reductions: {
        batchId: string;
        supplierId: string;
        quantity: number;
        unitCost: number;
      }[] = [];

      for (const line of lines) {
        if (remainingToReduce <= 0) {
          break;
        }

        const amountFromThisBatch = Math.min(
          this.quantityToNumber(line.quantityRemaining),
          remainingToReduce,
        );
        remainingToReduce -= amountFromThisBatch;
        const unitCost = roundMoney(line.unitCost);
        totalCOGS = totalCOGS.plus(unitCost.mul(amountFromThisBatch));

        const previousRemaining = this.quantityToNumber(line.quantityRemaining);
        const newRemaining = previousRemaining - amountFromThisBatch;

        await tx.purchaseBatchLine.update({
          where: { id: line.id },
          data: {
            quantityRemaining: newRemaining,
            status:
              newRemaining === 0 ? BatchStatus.DEPLETED : BatchStatus.IN_STOCK,
          },
        });

        const siblingActiveLines = await tx.purchaseBatchLine.count({
          where: {
            purchaseBatchId: line.purchaseBatchId,
            quantityRemaining: { gt: 0 },
            status: BatchStatus.IN_STOCK,
          },
        });
        const remainingSummary = await tx.purchaseBatchLine.aggregate({
          where: {
            purchaseBatchId: line.purchaseBatchId,
          },
          _sum: {
            quantityRemaining: true,
          },
        });
        const batchRemaining = this.quantityToLegacyInt(
          remainingSummary._sum.quantityRemaining ?? 0,
        );

        await tx.purchaseBatch.update({
          where: { id: line.purchaseBatchId },
          data: {
            quantityRemaining: line.purchaseBatch.variantId
              ? batchRemaining
              : 0,
            status:
              siblingActiveLines === 0
                ? BatchStatus.DEPLETED
                : BatchStatus.IN_STOCK,
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
            entity: 'PurchaseBatchLine',
            entityId: line.id,
            userId: userId ?? null,
            payload: {
              purchaseBatchId: line.purchaseBatchId,
              variantId,
              quantityReduced: amountFromThisBatch,
              previousRemaining,
              newRemaining,
              unitCost: decimalToNumber(unitCost),
            },
          },
        });

        reductions.push({
          batchId: line.purchaseBatchId,
          supplierId: line.purchaseBatch.supplierId,
          quantity: amountFromThisBatch,
          unitCost: decimalToNumber(unitCost),
        });
      }

      if (remainingToReduce > 0) {
        throw new BadRequestException(
          `Stock insuficiente para la variante ${variantId}. Faltan ${remainingToReduce} unidades.`,
        );
      }

      return { totalCOGS: decimalToNumber(totalCOGS), reductions };
    };

    if (txClient) {
      return execute(txClient);
    }

    return this.prisma.$transaction(async (tx) => {
      return execute(tx);
    });
  }

  async getAverageCost(productId: string): Promise<number> {
    const activeLines = await this.prisma.purchaseBatchLine.findMany({
      where: {
        variantId: { not: null },
        quantityRemaining: { gt: 0 },
        status: BatchStatus.IN_STOCK,
        itemType: PurchaseBatchItemType.VARIANT,
        variant: {
          productId,
        },
        purchaseBatch: {
          status: BatchStatus.IN_STOCK,
          deletedAt: null,
        },
      },
      select: {
        quantityRemaining: true,
        unitCost: true,
      },
    });

    if (activeLines.length === 0) {
      return 0;
    }

    const totalRemaining = activeLines.reduce(
      (sum, line) => sum.plus(toDecimal(line.quantityRemaining)),
      new Decimal(0),
    );
    const totalCostValue = activeLines.reduce(
      (sum, line) =>
        sum.plus(toDecimal(line.unitCost).mul(line.quantityRemaining)),
      new Decimal(0),
    );

    return decimalToNumber(totalCostValue.div(totalRemaining));
  }
}
