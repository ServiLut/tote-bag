import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Prisma } from '../../generated/client/client';
import { PricingService } from '../pricing/pricing.service';
import { InventoryService } from '../inventory/inventory.service';
import { ShippingSyncService } from '../shipping/shipping-sync.service';
import {
  PriceRuleScope,
  OrderStatus,
  OrderSource,
  PurchaseDocumentType,
  SaleLegalDocumentType,
  SaleLegalRequirement,
  SaleLegalStatus,
} from '../../generated/client/enums';
import {
  ConfigurationSnapshot,
  normalizeSnapshotPersonalizations,
} from '../../common/interfaces/snapshots.interface';
import { generateDeterministicHash } from '../../common/utils/hash.util';
import {
  calculateGrossTaxBreakdown,
  calculateSalesTaxBreakdown,
  decimalToNumber,
  DecimalInput,
  roundMoney,
  toDecimal,
} from '../../common/utils/sales-tax.util';

type InventoryConsumptionReduction = {
  purchaseBatchLineId: string | null;
  batchId: string;
  supplierId: string;
  quantity: number;
  unitCost: number;
  documentType: PurchaseDocumentType;
};

type InventoryConsumptionSnapshot = {
  totalCOGS: number;
  reductions: InventoryConsumptionReduction[];
};

type SaleLegalResolution = {
  saleLegalRequirement: SaleLegalRequirement;
  saleLegalStatus: SaleLegalStatus;
  saleLegalTrace: Prisma.InputJsonValue;
  saleLegalResolvedAt: Date | null;
};

type ResolvedCommercialVariant = {
  id: string;
  sku: string;
  productId: string;
  imageUrl: string;
  salePrice: number | null;
  minPrice: number | null;
  comparePrice: number | null;
  costPrice: number | null;
  taxRate: DecimalInput;
  size: string | null;
  isActive: boolean;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly inventoryService: InventoryService,
    private readonly shippingSyncService: ShippingSyncService,
  ) {}

  private async resolveCommercialVariant(
    tx: Prisma.TransactionClient,
    item: {
      variantId: string;
      sku: string;
      productId: string;
    },
  ): Promise<ResolvedCommercialVariant> {
    const variant = await tx.variant.findUnique({
      where: { id: item.variantId },
      select: {
        id: true,
        sku: true,
        productId: true,
        imageUrl: true,
        salePrice: true,
        minPrice: true,
        comparePrice: true,
        costPrice: true,
        taxRate: true,
        size: true,
        isActive: true,
      },
    });

    if (!variant || variant.productId !== item.productId) {
      throw new BadRequestException(
        `La variante ${item.variantId} no existe o no pertenece al producto ${item.productId}`,
      );
    }

    if (!variant.isActive) {
      throw new BadRequestException(
        `La variante ${item.variantId} no se encuentra activa para la venta.`,
      );
    }

    return variant;
  }

  private hasInventoryConsumption(pricingJson: Prisma.JsonValue | null) {
    return (
      !!pricingJson &&
      typeof pricingJson === 'object' &&
      !Array.isArray(pricingJson) &&
      'inventoryConsumption' in pricingJson
    );
  }

  private hasInventoryCommitment(pricingJson: Prisma.JsonValue | null) {
    return (
      !!pricingJson &&
      typeof pricingJson === 'object' &&
      !Array.isArray(pricingJson) &&
      'inventoryCommitment' in pricingJson
    );
  }

  private isPendingPaymentStatus(status: OrderStatus) {
    const pendingPaymentStatuses: OrderStatus[] = [
      OrderStatus.PENDIENTE_PAGO,
      OrderStatus.PENDING_DEPOSIT,
      OrderStatus.PENDING_FINAL_PAYMENT,
    ];

    return pendingPaymentStatuses.includes(status);
  }

  private isFullyPaidOperationalStatus(status: OrderStatus) {
    const fullyPaidOperationalStatuses: OrderStatus[] = [
      OrderStatus.PAGADA,
      OrderStatus.READY_FOR_DISPATCH,
      OrderStatus.ENVIADA,
      OrderStatus.ENTREGADA,
    ];

    return fullyPaidOperationalStatuses.includes(status);
  }

  private isInventoryAssignedOperationalStatus(status: OrderStatus) {
    const inventoryAssignedOperationalStatuses: OrderStatus[] = [
      OrderStatus.EN_PRODUCCION,
      OrderStatus.IN_PRODUCTION,
      OrderStatus.PAGADA,
      OrderStatus.READY_FOR_DISPATCH,
      OrderStatus.ENVIADA,
      OrderStatus.ENTREGADA,
    ];

    return inventoryAssignedOperationalStatuses.includes(status);
  }

  private requiresCompletedSaleLegalDocument(status: OrderStatus) {
    const closureStatuses: OrderStatus[] = [
      OrderStatus.READY_FOR_DISPATCH,
      OrderStatus.ENVIADA,
      OrderStatus.ENTREGADA,
    ];

    return closureStatuses.includes(status);
  }

  private extractInventoryConsumption(
    pricingJson: Prisma.JsonValue | null,
  ): InventoryConsumptionSnapshot | null {
    if (
      !pricingJson ||
      typeof pricingJson !== 'object' ||
      Array.isArray(pricingJson)
    ) {
      return null;
    }

    const inventoryConsumption = (pricingJson as Record<string, unknown>)
      .inventoryConsumption;

    if (
      !inventoryConsumption ||
      typeof inventoryConsumption !== 'object' ||
      Array.isArray(inventoryConsumption)
    ) {
      return null;
    }

    const rawConsumption = inventoryConsumption as Record<string, unknown>;
    const reductions = rawConsumption.reductions;

    if (!Array.isArray(reductions)) {
      return null;
    }

    const parsedReductions = reductions.flatMap((reduction) => {
      if (
        !reduction ||
        typeof reduction !== 'object' ||
        Array.isArray(reduction)
      ) {
        return [];
      }

      const candidate = reduction as Record<string, unknown>;
      if (
        typeof candidate.batchId !== 'string' ||
        typeof candidate.supplierId !== 'string' ||
        typeof candidate.quantity !== 'number' ||
        typeof candidate.unitCost !== 'number' ||
        (candidate.documentType !== PurchaseDocumentType.INVOICE &&
          candidate.documentType !== PurchaseDocumentType.DELIVERY_NOTE)
      ) {
        return [];
      }

      return [
        {
          purchaseBatchLineId:
            typeof candidate.purchaseBatchLineId === 'string'
              ? candidate.purchaseBatchLineId
              : null,
          batchId: candidate.batchId,
          supplierId: candidate.supplierId,
          quantity: candidate.quantity,
          unitCost: candidate.unitCost,
          documentType: candidate.documentType,
        },
      ];
    });

    if (parsedReductions.length === 0) {
      return null;
    }

    return {
      totalCOGS:
        typeof rawConsumption.totalCOGS === 'number'
          ? rawConsumption.totalCOGS
          : 0,
      reductions: parsedReductions,
    };
  }

  private resolveSaleLegalRequirement(
    items: Array<{
      id?: string;
      sku?: string;
      quantity: number;
      inventoryConsumption: InventoryConsumptionSnapshot | null;
    }>,
  ): SaleLegalResolution {
    const lots = items.flatMap((item) =>
      (item.inventoryConsumption?.reductions ?? []).map((reduction) => ({
        orderItemId: item.id ?? null,
        sku: item.sku ?? null,
        itemQuantity: item.quantity,
        purchaseBatchLineId: reduction.purchaseBatchLineId,
        batchId: reduction.batchId,
        supplierId: reduction.supplierId,
        quantity: reduction.quantity,
        unitCost: reduction.unitCost,
        documentType: reduction.documentType,
      })),
    );

    if (lots.length === 0) {
      return {
        saleLegalRequirement: SaleLegalRequirement.PENDING_STOCK_ASSIGNMENT,
        saleLegalStatus: SaleLegalStatus.PENDING,
        saleLegalResolvedAt: null,
        saleLegalTrace: {
          reason: 'Sin consumo FIFO asignado todavia',
          lots: [],
        },
      };
    }

    const hasInvoiceLot = lots.some(
      (lot) => lot.documentType === PurchaseDocumentType.INVOICE,
    );
    const requirement = hasInvoiceLot
      ? SaleLegalRequirement.ELECTRONIC_INVOICE_REQUIRED
      : SaleLegalRequirement.INTERNAL_DOCUMENT_ALLOWED;

    return {
      saleLegalRequirement: requirement,
      saleLegalStatus: SaleLegalStatus.PENDING,
      saleLegalResolvedAt: new Date(),
      saleLegalTrace: {
        requirement,
        requiredDocumentType: hasInvoiceLot
          ? SaleLegalDocumentType.ELECTRONIC_INVOICE
          : null,
        allowedDocumentTypes: hasInvoiceLot
          ? [SaleLegalDocumentType.ELECTRONIC_INVOICE]
          : [
              SaleLegalDocumentType.ELECTRONIC_INVOICE,
              SaleLegalDocumentType.INTERNAL_DELIVERY_NOTE,
            ],
        lots,
      },
    };
  }

  private validateSaleLegalDocumentType(
    requirement: SaleLegalRequirement,
    documentType: SaleLegalDocumentType,
  ) {
    if (requirement === SaleLegalRequirement.PENDING_STOCK_ASSIGNMENT) {
      throw new BadRequestException(
        'No se puede registrar documento legal antes de asignar stock real por lote',
      );
    }

    if (
      requirement === SaleLegalRequirement.ELECTRONIC_INVOICE_REQUIRED &&
      documentType !== SaleLegalDocumentType.ELECTRONIC_INVOICE
    ) {
      throw new BadRequestException(
        'El stock usado proviene de lote con factura; el cierre exige factura electronica',
      );
    }
  }

  private assertSaleLegalClosureAllowed(order: {
    saleLegalRequirement: SaleLegalRequirement;
    saleLegalStatus: SaleLegalStatus;
  }) {
    if (order.saleLegalStatus === SaleLegalStatus.COMPLETED) {
      return;
    }

    if (
      order.saleLegalRequirement ===
      SaleLegalRequirement.PENDING_STOCK_ASSIGNMENT
    ) {
      throw new ForbiddenException(
        'La orden no puede cerrarse sin asignacion FIFO real de lote',
      );
    }

    throw new ForbiddenException(
      order.saleLegalRequirement ===
        SaleLegalRequirement.ELECTRONIC_INVOICE_REQUIRED
        ? 'La orden usa stock de lote con factura y exige factura electronica antes del cierre'
        : 'La orden usa stock de lote con remision y exige registrar factura o remision interna antes del cierre',
    );
  }

  private parsePositiveMoney(value: DecimalInput, errorMessage: string) {
    let parsed: Decimal;

    try {
      parsed = roundMoney(value);
    } catch {
      throw new BadRequestException('Monto decimal invalido');
    }

    if (!parsed.isFinite() || parsed.lessThanOrEqualTo(0)) {
      throw new BadRequestException(errorMessage);
    }

    return parsed;
  }

  private parseDateOrThrow(value: string, errorMessage: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(errorMessage);
    }

    return parsed;
  }

  private async lockOrderForPayment(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    await tx.$queryRaw`
      SELECT "id"
      FROM "tote-bag"."orders"
      WHERE "id" = ${orderId}
        AND "deleted_at" IS NULL
      FOR UPDATE
    `;
  }

  private async getActiveOrderPaymentTotal(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const aggregate = await tx.orderPayment.aggregate({
      where: {
        orderId,
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    });

    return roundMoney(aggregate._sum.amount ?? 0);
  }

  private getRequiredDepositAmount(totalAmount: Decimal) {
    return roundMoney(totalAmount.mul(0.7));
  }

  private resolveStatusAfterOrderPayment(input: {
    currentStatus: OrderStatus;
    totalAmount: Decimal;
    nextPaid: Decimal;
    nextBalanceDue: Decimal;
  }) {
    if (input.nextBalanceDue.isZero()) {
      return OrderStatus.PAGADA;
    }

    if (
      this.isPendingPaymentStatus(input.currentStatus) &&
      input.nextPaid.greaterThanOrEqualTo(
        this.getRequiredDepositAmount(input.totalAmount),
      )
    ) {
      return OrderStatus.EN_PRODUCCION;
    }

    if (this.isPendingPaymentStatus(input.currentStatus)) {
      return OrderStatus.PENDING_DEPOSIT;
    }

    return input.currentStatus;
  }

  private async buildInventoryConsumption(
    tx: Prisma.TransactionClient,
    item: {
      variantId: string;
      sku: string;
      productId: string;
      quantity: number;
    },
    userId?: string,
  ): Promise<InventoryConsumptionSnapshot> {
    const targetVariant = await this.resolveCommercialVariant(tx, item);
    const stockReduction = await this.inventoryService.reduceStockFIFO(
      targetVariant.id,
      item.quantity,
      userId,
      tx,
    );

    return {
      totalCOGS: stockReduction.totalCOGS,
      reductions: stockReduction.reductions,
    };
  }

  private async assignOrderInventoryAndResolveSaleLegal(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      items: Array<{
        id: string;
        productId: string;
        variantId: string | null;
        sku: string;
        quantity: number;
        pricingJson: Prisma.JsonValue | null;
      }>;
    },
    userId?: string,
  ) {
    const saleLegalItems: Array<{
      id: string;
      sku: string;
      quantity: number;
      inventoryConsumption: InventoryConsumptionSnapshot | null;
    }> = [];

    for (const item of order.items) {
      const existingConsumption = this.extractInventoryConsumption(
        item.pricingJson,
      );

      if (existingConsumption) {
        saleLegalItems.push({
          id: item.id,
          sku: item.sku,
          quantity: item.quantity,
          inventoryConsumption: existingConsumption,
        });
        continue;
      }

      if (this.hasInventoryConsumption(item.pricingJson)) {
        throw new BadRequestException(
          `La orden ${order.id} tiene consumo FIFO legacy sin tipo documental de lote.`,
        );
      }

      if (!item.variantId) {
        throw new BadRequestException(
          `La orden ${order.id} contiene items legacy sin variantId. Debe regularizarse antes de descontar inventario.`,
        );
      }

      if (this.hasInventoryCommitment(item.pricingJson)) {
        await this.inventoryService.releaseCommittedStock(
          item.variantId,
          item.quantity,
          userId,
          order.id,
          tx,
        );
      }

      const inventoryConsumption = await this.buildInventoryConsumption(
        tx,
        {
          ...item,
          variantId: item.variantId,
        },
        userId,
      );
      saleLegalItems.push({
        id: item.id,
        sku: item.sku,
        quantity: item.quantity,
        inventoryConsumption,
      });

      const basePricingJson =
        item.pricingJson &&
        typeof item.pricingJson === 'object' &&
        !Array.isArray(item.pricingJson)
          ? (item.pricingJson as Record<string, unknown>)
          : {};
      const pricingJsonRest = { ...basePricingJson };
      delete pricingJsonRest.inventoryCommitment;

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          pricingJson: {
            ...pricingJsonRest,
            inventoryConsumption,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return this.resolveSaleLegalRequirement(saleLegalItems);
  }

  private buildOrderRequestHash(
    createOrderDto: CreateOrderDto,
    userId?: string,
  ) {
    return generateDeterministicHash({
      createOrderDto,
      userId: userId ?? null,
    });
  }

  private async findOrderByIdempotencyKey(idempotencyKey: string) {
    const record = await this.prisma.orderIdempotencyKey.findUnique({
      where: { idempotencyKey },
      select: { orderId: true, requestHash: true },
    });

    if (!record) {
      return null;
    }

    const order = record.orderId
      ? await this.prisma.order.findUnique({
          where: { id: record.orderId },
          include: {
            items: true,
            statusHistory: { orderBy: { createdAt: 'desc' } },
            shipment: true,
          },
        })
      : null;

    return {
      ...record,
      order,
    };
  }

  private serializeOrderMoney<T extends Record<string, unknown> | null>(
    order: T,
  ): T {
    if (!order) {
      return order;
    }

    const result: Record<string, unknown> = { ...order };

    if ('netAmount' in result) {
      result.netAmount = decimalToNumber(result.netAmount as DecimalInput);
    }

    if ('taxTotal' in result) {
      result.taxTotal = decimalToNumber(result.taxTotal as DecimalInput);
    }

    if ('amountPaid' in result) {
      result.amountPaid = decimalToNumber(result.amountPaid as DecimalInput);
    }

    if ('balanceDue' in result) {
      result.balanceDue = decimalToNumber(result.balanceDue as DecimalInput);
    }

    if (Array.isArray(result.payments)) {
      const payments = result.payments as unknown[];
      result.payments = payments.map((payment): unknown => {
        if (!payment || typeof payment !== 'object') {
          return payment;
        }

        const paymentRecord = { ...(payment as Record<string, unknown>) };

        if ('amount' in paymentRecord) {
          paymentRecord.amount = decimalToNumber(
            paymentRecord.amount as DecimalInput,
          );
        }

        const decimalPaymentFields = [
          'grossAmount',
          'netReceivedAmount',
          'commissionAmount',
          'commissionVatAmount',
          'reteFuenteAmount',
          'reteIvaAmount',
          'reteIcaAmount',
          'packagingCifAmount',
        ] as const;

        for (const field of decimalPaymentFields) {
          if (field in paymentRecord && paymentRecord[field] !== null) {
            paymentRecord[field] = decimalToNumber(
              paymentRecord[field] as DecimalInput,
            );
          }
        }

        return paymentRecord;
      });
    }

    if (Array.isArray(result.items)) {
      const items = result.items as unknown[];
      result.items = items.map((item): unknown => {
        if (!item || typeof item !== 'object') {
          return item;
        }

        const itemRecord = { ...(item as Record<string, unknown>) };

        if ('netUnitPrice' in itemRecord) {
          itemRecord.netUnitPrice = decimalToNumber(
            itemRecord.netUnitPrice as DecimalInput,
          );
        }

        if ('taxAmount' in itemRecord) {
          itemRecord.taxAmount = decimalToNumber(
            itemRecord.taxAmount as DecimalInput,
          );
        }

        return itemRecord;
      });
    }

    return result as T;
  }

  async create(
    createOrderDto: CreateOrderDto,
    userId?: string,
    options?: { idempotencyKey?: string },
  ) {
    const idempotencyKey = options?.idempotencyKey?.trim();
    const requestHash = idempotencyKey
      ? this.buildOrderRequestHash(createOrderDto, userId)
      : null;

    if (idempotencyKey && requestHash) {
      const existingOrderRequest =
        await this.findOrderByIdempotencyKey(idempotencyKey);

      if (existingOrderRequest) {
        if (
          existingOrderRequest.requestHash &&
          existingOrderRequest.requestHash !== requestHash
        ) {
          throw new ConflictException(
            'La llave de idempotencia ya fue usada con un payload diferente.',
          );
        }

        if (existingOrderRequest.order) {
          return this.serializeOrderMoney(existingOrderRequest.order);
        }

        throw new ConflictException(
          'Ya existe una solicitud en proceso con esta llave de idempotencia.',
        );
      }
    }

    const {
      items,
      shippingAddress,
      firstName,
      lastName,
      department,
      shippingProviderId,
      carrier,
      manualDiscountType,
      manualDiscountValue,
      isB2B,
      isManual,
      source,
      initialStatus,
      ...orderData
    } = createOrderDto;

    // Determine initial status
    const statusToSet =
      (initialStatus as OrderStatus) || OrderStatus.PENDIENTE_PAGO;

    // Determine source
    const sourceToSet =
      (source as OrderSource) ||
      (isManual ? OrderSource.MANUAL : OrderSource.ECOMMERCE);
    const shouldReduceInventory =
      sourceToSet === OrderSource.MANUAL ||
      statusToSet !== OrderStatus.PENDIENTE_PAGO;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey && requestHash) {
          await tx.orderIdempotencyKey.create({
            data: {
              idempotencyKey,
              requestHash,
            },
          });
        }

        let resolvedProfileId = orderData.profileId;

        // Ecommerce orders created by an authenticated customer should stay linked
        // to that customer's profile even if the frontend omitted profileId.
        if (
          !resolvedProfileId &&
          userId &&
          sourceToSet === OrderSource.ECOMMERCE
        ) {
          const actorProfile = await tx.profile.findUnique({
            where: { userId },
            select: { id: true },
          });

          resolvedProfileId = actorProfile?.id;
        }

        const processedItems = await Promise.all(
          items.map(async (item) => {
            if (!item.productId) {
              throw new BadRequestException(
                'Cada item debe tener un productId',
              );
            }

            const resolvedVariant = await this.resolveCommercialVariant(
              tx,
              item,
            );

            const baseProduct = await tx.product.findUnique({
              where: { id: item.productId },
              select: {
                id: true,
                images: {
                  select: { url: true },
                  orderBy: { position: 'asc' },
                  take: 1,
                },
              },
            });

            if (!baseProduct) {
              throw new BadRequestException(
                `Producto no encontrado: ${item.productId}`,
              );
            }

            const salePrice = toDecimal(resolvedVariant.salePrice ?? 0);
            const minPrice = toDecimal(resolvedVariant.minPrice ?? 0);
            let unitPrice = salePrice.greaterThan(minPrice)
              ? salePrice
              : minPrice;
            let totalPrice = roundMoney(unitPrice.mul(item.quantity));
            let configurationJson: Prisma.InputJsonValue | undefined =
              undefined;
            let pricingJsonPayload: Record<string, unknown> = {};
            let imageUrl: string | null = null;

            if (item.configuration) {
              const scope = isB2B ? PriceRuleScope.B2B : PriceRuleScope.B2C;
              const quote = await this.pricingService.calculateQuote(
                {
                  ...item.configuration,
                  productId: item.productId,
                  variantId: resolvedVariant.id,
                  size:
                    item.configuration.size ||
                    resolvedVariant.size ||
                    undefined,
                  quantity: item.quantity,
                },
                scope,
              );
              unitPrice = toDecimal(quote.unitPrice);
              totalPrice = roundMoney(unitPrice.mul(item.quantity));

              // Generate Configuration Snapshot
              const configSnapshot: ConfigurationSnapshot = {
                version: '1.1',
                configCode: quote.snapshot.configCode,
                productId: item.productId,
                productName: item.sku || resolvedVariant.sku,
                line: item.configuration.line,
                size: item.configuration.size || resolvedVariant.size || '',
                material: item.configuration.material,
                quality: item.configuration.quality,
                customImageURL: item.configuration.customImageURL,
                personalizations: normalizeSnapshotPersonalizations(
                  item.configuration.personalizations ?? [],
                ),
                timestamp: new Date().toISOString(),
              };

              configurationJson =
                configSnapshot as unknown as Prisma.InputJsonValue;
              pricingJsonPayload = {
                ...(quote.snapshot as unknown as Record<string, unknown>),
              };

              imageUrl = item.configuration.customImageURL ?? null;
            }

            let inventoryConsumption: {
              totalCOGS: number;
              reductions: InventoryConsumptionReduction[];
            } | null = null;

            if (shouldReduceInventory) {
              try {
                inventoryConsumption = await this.buildInventoryConsumption(
                  tx,
                  item,
                  userId,
                );
              } catch (error: unknown) {
                const errorMessage =
                  error instanceof Error ? error.message : 'Unknown error';
                console.warn(
                  `Stock reduction failed for item ${item.sku || item.productId}: ${errorMessage}`,
                );
                if (error instanceof BadRequestException) {
                  throw error;
                }
              }
            }

            const pricingJson =
              inventoryConsumption || Object.keys(pricingJsonPayload).length > 0
                ? ({
                    ...pricingJsonPayload,
                    ...(inventoryConsumption
                      ? {
                          inventoryConsumption,
                        }
                      : {}),
                  } as Prisma.InputJsonValue)
                : (null as unknown as Prisma.InputJsonValue);

            const taxBreakdown = calculateSalesTaxBreakdown({
              grossUnitPrice: unitPrice,
              quantity: item.quantity,
              taxRate: resolvedVariant.taxRate,
            });

            return {
              ...item,
              variantId: resolvedVariant.id,
              sku: resolvedVariant.sku,
              imageUrl:
                imageUrl ??
                resolvedVariant.imageUrl ??
                baseProduct.images[0]?.url ??
                null,
              unitPrice: decimalToNumber(unitPrice),
              totalPrice: decimalToNumber(totalPrice),
              taxRate: resolvedVariant.taxRate,
              grossLineTotal: totalPrice,
              netUnitPrice: taxBreakdown.netUnitPrice,
              netLineTotal: taxBreakdown.netLineTotal,
              taxAmount: taxBreakdown.taxAmount,
              configurationJson:
                configurationJson ?? (null as unknown as Prisma.InputJsonValue),
              pricingJson,
              inventoryConsumption,
            };
          }),
        );

        const subtotalAmount = processedItems.reduce(
          (sum, item) => sum.plus(toDecimal(item.totalPrice)),
          new Decimal(0),
        );

        const normalizedDiscountValue = Decimal.max(
          0,
          toDecimal(manualDiscountValue ?? 0),
        );
        const rawDiscountAmount =
          manualDiscountType === 'percent'
            ? roundMoney(subtotalAmount.mul(normalizedDiscountValue).div(100))
            : normalizedDiscountValue;
        const discountAmount = Decimal.min(rawDiscountAmount, subtotalAmount);
        const totalAmount = roundMoney(subtotalAmount.minus(discountAmount));

        let taxAdjustedItems = processedItems;
        let netAmount = processedItems.reduce(
          (sum, item) => sum.plus(item.netLineTotal),
          new Decimal(0),
        );
        let taxTotal = processedItems.reduce(
          (sum, item) => sum.plus(item.taxAmount),
          new Decimal(0),
        );

        if (discountAmount.greaterThan(0) && subtotalAmount.greaterThan(0)) {
          let accumulatedGross = new Decimal(0);
          taxAdjustedItems = processedItems.map((item, index) => {
            const isLast = index === processedItems.length - 1;
            const discountedGrossLine = isLast
              ? roundMoney(totalAmount.minus(accumulatedGross))
              : roundMoney(
                  toDecimal(item.totalPrice).minus(
                    discountAmount
                      .mul(toDecimal(item.totalPrice))
                      .div(subtotalAmount),
                  ),
                );

            accumulatedGross = accumulatedGross.plus(discountedGrossLine);

            const lineTax = calculateGrossTaxBreakdown({
              grossAmount: discountedGrossLine,
              taxRate: item.taxRate,
            });

            return {
              ...item,
              discountedGrossLine,
              netLineTotal: lineTax.netAmount,
              taxAmount: lineTax.taxAmount,
            };
          });

          netAmount = taxAdjustedItems.reduce(
            (sum, item) => sum.plus(item.netLineTotal),
            new Decimal(0),
          );
          taxTotal = roundMoney(totalAmount.minus(netAmount));
        }

        netAmount = roundMoney(netAmount);
        taxTotal = roundMoney(taxTotal);
        const saleLegalResolution = this.resolveSaleLegalRequirement(
          taxAdjustedItems.map((item) => ({
            sku: item.sku,
            quantity: item.quantity,
            inventoryConsumption: item.inventoryConsumption,
          })),
        );

        if (this.requiresCompletedSaleLegalDocument(statusToSet)) {
          this.assertSaleLegalClosureAllowed(saleLegalResolution);
        }

        const initialAmountPaid = this.isFullyPaidOperationalStatus(statusToSet)
          ? totalAmount
          : new Decimal(0);
        const initialBalanceDue = roundMoney(
          totalAmount.minus(initialAmountPaid),
        );

        let provider: {
          id: string;
          name: string;
        } | null = null;

        if (shippingProviderId) {
          provider = await tx.shippingProvider.findUnique({
            where: { id: shippingProviderId },
            select: { id: true, name: true },
          });

          if (!provider) {
            throw new BadRequestException('Transportadora no encontrada');
          }
        }

        // Prepare shipping address as JSON-compatible object
        const resolvedCarrier = provider?.name ?? carrier ?? null;

        const shippingAddressJson = {
          ...(shippingAddress as object),
          firstName,
          lastName,
          department,
          shippingProviderId: provider?.id ?? null,
          shippingProviderName: resolvedCarrier,
          manualDiscount: normalizedDiscountValue.greaterThan(0)
            ? {
                type: manualDiscountType ?? 'amount',
                value: decimalToNumber(normalizedDiscountValue),
                amount: decimalToNumber(discountAmount),
                subtotal: decimalToNumber(subtotalAmount),
              }
            : null,
        } as Prisma.InputJsonValue;

        const createdOrder = await tx.order.create({
          data: {
            ...orderData,
            profileId: resolvedProfileId,
            carrier: resolvedCarrier,
            isB2B: !!isB2B,
            isManual: !!isManual,
            source: sourceToSet,
            status: statusToSet,
            shippingAddress: shippingAddressJson,
            totalAmount: decimalToNumber(totalAmount),
            netAmount,
            taxTotal,
            amountPaid: initialAmountPaid,
            balanceDue: initialBalanceDue,
            saleLegalRequirement: saleLegalResolution.saleLegalRequirement,
            saleLegalStatus: saleLegalResolution.saleLegalStatus,
            saleLegalTrace: saleLegalResolution.saleLegalTrace,
            saleLegalResolvedAt: saleLegalResolution.saleLegalResolvedAt,
            statusHistory: {
              create: {
                status: statusToSet,
                oldStatus: null,
                newStatus: statusToSet,
                userId: userId ?? null,
              },
            },
            items: {
              create: taxAdjustedItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                netUnitPrice: item.netUnitPrice,
                taxAmount: item.taxAmount,
                sku: item.sku,
                imageUrl: item.imageUrl,
                variantId: item.variantId,
                configurationJson: item.configurationJson,
                pricingJson: item.pricingJson,
              })),
            },
            ...((provider || resolvedCarrier) && {
              shipment: {
                create: {
                  ...(provider ? { providerId: provider.id } : {}),
                },
              },
            }),
          },
          include: { items: true, statusHistory: true, shipment: true },
        });

        if (!shouldReduceInventory) {
          for (const item of createdOrder.items) {
            if (!item.variantId) {
              throw new BadRequestException(
                `La orden ${createdOrder.id} contiene items sin variantId para reservar inventario.`,
              );
            }

            await this.inventoryService.commitStock(
              item.variantId,
              item.quantity,
              userId,
              createdOrder.id,
              tx,
            );

            const basePricingJson =
              item.pricingJson &&
              typeof item.pricingJson === 'object' &&
              !Array.isArray(item.pricingJson)
                ? (item.pricingJson as Record<string, unknown>)
                : {};

            await tx.orderItem.update({
              where: { id: item.id },
              data: {
                pricingJson: {
                  ...basePricingJson,
                  inventoryCommitment: {
                    variantId: item.variantId,
                    quantity: item.quantity,
                    committedAt: new Date().toISOString(),
                  },
                } as Prisma.InputJsonValue,
              },
            });
          }
        }

        if (idempotencyKey) {
          await tx.orderIdempotencyKey.update({
            where: { idempotencyKey },
            data: {
              orderId: createdOrder.id,
            },
          });
        }

        if (statusToSet !== OrderStatus.PENDIENTE_PAGO) {
          await this.shippingSyncService.ensureShipmentForOrder(
            createdOrder.id,
            tx,
          );
        }

        return this.serializeOrderMoney(createdOrder);
      });
    } catch (error) {
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingOrderRequest =
          await this.findOrderByIdempotencyKey(idempotencyKey);

        if (existingOrderRequest?.requestHash !== requestHash) {
          throw new ConflictException(
            'La llave de idempotencia ya fue usada con un payload diferente.',
          );
        }

        if (existingOrderRequest?.order) {
          return this.serializeOrderMoney(existingOrderRequest.order);
        }

        throw new ConflictException(
          'Ya existe una solicitud en proceso con esta llave de idempotencia.',
        );
      }

      throw error;
    }
  }

  async confirmPendingOrderPayment(
    orderId: string,
    userId?: string,
    txClient?: Prisma.TransactionClient,
    proofUrl?: string,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      await this.lockOrderForPayment(tx, orderId);

      const order = await tx.order.findFirst({
        where: { id: orderId, deletedAt: null },
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              variantId: true,
              sku: true,
              quantity: true,
              pricingJson: true,
            },
          },
        },
      });

      if (!order) {
        throw new BadRequestException('Orden no encontrada');
      }

      if (this.isFullyPaidOperationalStatus(order.status)) {
        return order;
      }

      if (!this.isPendingPaymentStatus(order.status)) {
        return order;
      }

      const totalAmount = roundMoney(order.totalAmount);
      const storedPaid = roundMoney(order.amountPaid);
      const recordedPaid = await this.getActiveOrderPaymentTotal(tx, orderId);
      const currentPaid = Decimal.max(storedPaid, recordedPaid);
      const paymentDelta = roundMoney(totalAmount.minus(currentPaid));

      if (currentPaid.greaterThan(totalAmount) || paymentDelta.lessThan(0)) {
        throw new BadRequestException(
          'Los abonos registrados superan el total de la orden',
        );
      }

      if (paymentDelta.greaterThan(0)) {
        const normalizedProofUrl =
          proofUrl?.trim() || order.paymentReceiptUrl?.trim();

        if (!normalizedProofUrl) {
          throw new BadRequestException('Debes adjuntar soporte del pago');
        }

        await tx.orderPayment.create({
          data: {
            orderId,
            amount: paymentDelta,
            paymentDate: new Date(),
            proofUrl: normalizedProofUrl,
            notes: 'Pago completo confirmado por integracion de pagos',
          },
        });
      }

      const saleLegalResolution =
        await this.assignOrderInventoryAndResolveSaleLegal(tx, order, userId);
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAGADA,
          amountPaid: totalAmount,
          balanceDue: new Decimal(0),
          saleLegalRequirement: saleLegalResolution.saleLegalRequirement,
          saleLegalStatus: saleLegalResolution.saleLegalStatus,
          saleLegalTrace: saleLegalResolution.saleLegalTrace,
          saleLegalResolvedAt: saleLegalResolution.saleLegalResolvedAt,
          statusHistory: {
            create: {
              status: OrderStatus.PAGADA,
              oldStatus: order.status,
              newStatus: OrderStatus.PAGADA,
              userId: userId ?? null,
            },
          },
        },
      });

      await this.shippingSyncService.ensureShipmentForOrder(orderId, tx);

      return updatedOrder;
    };

    if (txClient) {
      return execute(txClient);
    }

    return this.prisma.$transaction(async (tx) => execute(tx));
  }

  async expirePendingPaymentOrders(expirationHours = 24, actorUserId?: string) {
    const cutoff = new Date(Date.now() - expirationHours * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const expiredCandidates = await tx.order.findMany({
        where: {
          status: OrderStatus.PENDIENTE_PAGO,
          createdAt: {
            lte: cutoff,
          },
        },
        select: {
          id: true,
          status: true,
          items: {
            select: {
              id: true,
              variantId: true,
              quantity: true,
              pricingJson: true,
            },
          },
        },
      });

      if (expiredCandidates.length === 0) {
        return { expiredCount: 0 };
      }

      for (const order of expiredCandidates) {
        for (const item of order.items) {
          if (item.variantId && this.hasInventoryCommitment(item.pricingJson)) {
            await this.inventoryService.releaseCommittedStock(
              item.variantId,
              item.quantity,
              actorUserId,
              order.id,
              tx,
            );

            const basePricingJson =
              item.pricingJson &&
              typeof item.pricingJson === 'object' &&
              !Array.isArray(item.pricingJson)
                ? (item.pricingJson as Record<string, unknown>)
                : {};
            const pricingJsonRest = { ...basePricingJson };
            delete pricingJsonRest.inventoryCommitment;

            await tx.orderItem.update({
              where: { id: item.id },
              data: {
                pricingJson: Object.keys(pricingJsonRest).length
                  ? (pricingJsonRest as Prisma.InputJsonValue)
                  : (null as unknown as Prisma.InputJsonValue),
              },
            });
          }
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELADA,
            statusHistory: {
              create: {
                status: OrderStatus.CANCELADA,
                oldStatus: order.status,
                newStatus: OrderStatus.CANCELADA,
                userId: actorUserId ?? null,
              },
            },
          },
        });
      }

      return { expiredCount: expiredCandidates.length };
    });
  }

  async findAll(
    filters: {
      status?: string;
      source?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
    } = {},
  ) {
    const { status, source, startDate, endDate, search } = filters;
    const where: Prisma.OrderWhereInput = { deletedAt: null };

    if (status) {
      where.status = status as OrderStatus;
    }

    if (source) {
      where.source = source as OrderSource;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    if (search) {
      where.OR = [
        {
          profile: {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          id: { contains: search, mode: 'insensitive' },
        },
      ];
    }

    return this.prisma.order
      .findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          customerEmail: true,
          city: true,
          totalAmount: true,
          netAmount: true,
          taxTotal: true,
          amountPaid: true,
          balanceDue: true,
          status: true,
          source: true,
          trackingNumber: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              sku: true,
              quantity: true,
              netUnitPrice: true,
              taxAmount: true,
              product: {
                select: {
                  name: true,
                  images: {
                    select: { url: true },
                    orderBy: { position: 'asc' },
                    take: 1,
                  },
                },
              },
            },
          },
          payments: {
            where: { deletedAt: null },
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              proofUrl: true,
              notes: true,
              provider: true,
              externalTransactionId: true,
              externalStatus: true,
              paymentMethodType: true,
              grossAmount: true,
              netReceivedAmount: true,
              commissionAmount: true,
              commissionVatAmount: true,
              reteFuenteAmount: true,
              reteIvaAmount: true,
              reteIcaAmount: true,
              packagingCifAmount: true,
              settlementSource: true,
              settlementMetadata: true,
              reconciledAt: true,
              createdAt: true,
            },
            orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      .then((orders) => orders.map((order) => this.serializeOrderMoney(order)));
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        profile: true,
        payments: {
          where: { deletedAt: null },
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (order?.deletedAt) {
      return null;
    }

    return this.serializeOrderMoney(order);
  }

  async findOneWithDetails(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        profile: true,
      },
    });

    if (order?.deletedAt) {
      return null;
    }

    return this.serializeOrderMoney(order);
  }

  async findByUser(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true, email: true },
    });

    if (!profile) {
      return [];
    }

    const orders = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            profile: {
              userId,
            },
          },
          {
            profileId: null,
            customerEmail: {
              equals: profile.email,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
            variant: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          where: { deletedAt: null },
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map((order) => this.serializeOrderMoney(order));
  }

  async registerOrderPayment(
    orderId: string,
    data: CreateOrderPaymentDto,
    userId?: string,
  ) {
    const amount = this.parsePositiveMoney(
      data.amount,
      'El abono debe ser mayor a cero',
    );
    const paymentDate = this.parseDateOrThrow(
      data.paymentDate,
      'La fecha del abono es invalida',
    );
    const proofUrl = data.proofUrl?.trim();
    if (!proofUrl) {
      throw new BadRequestException('Debes adjuntar soporte del pago');
    }
    const notes = data.notes?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrderForPayment(tx, orderId);

      const order = await tx.order.findFirst({
        where: { id: orderId, deletedAt: null },
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              variantId: true,
              sku: true,
              quantity: true,
              pricingJson: true,
            },
          },
        },
      });

      if (!order) {
        throw new BadRequestException('Orden no encontrada');
      }

      const totalAmount = roundMoney(order.totalAmount);
      const storedPaid = roundMoney(order.amountPaid);
      const recordedPaid = await this.getActiveOrderPaymentTotal(tx, orderId);
      const currentPaid = Decimal.max(storedPaid, recordedPaid);
      const currentBalanceDue = roundMoney(totalAmount.minus(currentPaid));

      if (
        currentPaid.greaterThan(totalAmount) ||
        currentBalanceDue.lessThan(0)
      ) {
        throw new BadRequestException(
          'Los abonos registrados superan el total de la orden',
        );
      }

      if (amount.greaterThan(currentBalanceDue)) {
        throw new BadRequestException(
          'El abono no puede superar el saldo pendiente de la orden',
        );
      }

      const payment = await tx.orderPayment.create({
        data: {
          orderId,
          amount,
          paymentDate,
          proofUrl,
          notes,
        },
      });

      const recordedPaidAfterPayment = await this.getActiveOrderPaymentTotal(
        tx,
        orderId,
      );
      const nextPaid = roundMoney(
        Decimal.max(recordedPaidAfterPayment, currentPaid.plus(amount)),
      );
      const nextBalanceDue = roundMoney(totalAmount.minus(nextPaid));

      if (nextPaid.greaterThan(totalAmount)) {
        throw new BadRequestException(
          'El total abonado no puede superar el total de la orden',
        );
      }

      if (nextBalanceDue.lessThan(0)) {
        throw new BadRequestException(
          'El saldo pendiente no puede quedar negativo',
        );
      }

      const nextStatus = this.resolveStatusAfterOrderPayment({
        currentStatus: order.status,
        totalAmount,
        nextPaid,
        nextBalanceDue,
      });

      const saleLegalResolution = this.isInventoryAssignedOperationalStatus(
        nextStatus,
      )
        ? await this.assignOrderInventoryAndResolveSaleLegal(tx, order, userId)
        : null;

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          amountPaid: nextPaid,
          balanceDue: nextBalanceDue,
          status: nextStatus,
          ...(saleLegalResolution
            ? {
                saleLegalRequirement: saleLegalResolution.saleLegalRequirement,
                saleLegalStatus: saleLegalResolution.saleLegalStatus,
                saleLegalTrace: saleLegalResolution.saleLegalTrace,
                saleLegalResolvedAt: saleLegalResolution.saleLegalResolvedAt,
              }
            : {}),
          statusHistory:
            nextStatus !== order.status
              ? {
                  create: {
                    status: nextStatus,
                    oldStatus: order.status,
                    newStatus: nextStatus,
                    userId: userId ?? null,
                  },
                }
              : undefined,
        },
        include: {
          items: true,
          payments: {
            where: { deletedAt: null },
            orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
          },
          statusHistory: { orderBy: { createdAt: 'desc' } },
          shipment: true,
        },
      });

      if (this.isInventoryAssignedOperationalStatus(nextStatus)) {
        await this.shippingSyncService.ensureShipmentForOrder(orderId, tx);
      }

      return {
        payment: {
          ...payment,
          amount: decimalToNumber(payment.amount),
        },
        order: this.serializeOrderMoney(updatedOrder),
      };
    });
  }

  async getAccountsReceivable() {
    const orders = await this.prisma.order.findMany({
      where: {
        balanceDue: { gt: 0 },
        deletedAt: null,
        status: {
          notIn: [OrderStatus.CANCELADA, OrderStatus.RETURNED_TO_STOCK],
        },
      },
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        customerPhone: true,
        city: true,
        totalAmount: true,
        amountPaid: true,
        balanceDue: true,
        status: true,
        source: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        payments: {
          where: { deletedAt: null },
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            proofUrl: true,
            notes: true,
            provider: true,
            externalTransactionId: true,
            externalStatus: true,
            paymentMethodType: true,
            grossAmount: true,
            netReceivedAmount: true,
            commissionAmount: true,
            commissionVatAmount: true,
            reteFuenteAmount: true,
            reteIvaAmount: true,
            reteIcaAmount: true,
            packagingCifAmount: true,
            settlementSource: true,
            settlementMetadata: true,
            reconciledAt: true,
            createdAt: true,
          },
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const totalBalanceDue = orders.reduce(
      (sum, order) => sum.plus(toDecimal(order.balanceDue)),
      new Decimal(0),
    );
    const totalAmountPaid = orders.reduce(
      (sum, order) => sum.plus(toDecimal(order.amountPaid)),
      new Decimal(0),
    );

    return {
      summary: {
        orderCount: orders.length,
        totalBalanceDue: decimalToNumber(totalBalanceDue),
        totalAmountPaid: decimalToNumber(totalAmountPaid),
      },
      orders: orders.map((order) => this.serializeOrderMoney(order)),
    };
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const {
      status,
      saleLegalDocumentType,
      saleLegalDocumentReference,
      ...data
    } = updateOrderDto;
    const updatesSaleLegalDocument =
      saleLegalDocumentType !== undefined ||
      saleLegalDocumentReference !== undefined;

    if (status || updatesSaleLegalDocument) {
      return this.prisma.$transaction(async (tx) => {
        const currentOrder = await tx.order.findFirst({
          where: { id, deletedAt: null },
          select: {
            status: true,
            balanceDue: true,
            saleLegalRequirement: true,
            saleLegalStatus: true,
            saleLegalDocumentType: true,
            saleLegalDocumentReference: true,
            items: {
              select: {
                id: true,
                variantId: true,
                sku: true,
                quantity: true,
                pricingJson: true,
              },
            },
          },
        });

        if (!currentOrder) {
          throw new BadRequestException('Orden no encontrada');
        }

        const balanceDue = roundMoney(currentOrder.balanceDue);
        if (status === OrderStatus.READY_FOR_DISPATCH && balanceDue.gt(0)) {
          throw new ForbiddenException(
            'La orden no puede quedar lista para despacho con saldo pendiente',
          );
        }

        const saleLegalItems = currentOrder.items.map((item) => ({
          id: item.id,
          sku: item.sku,
          quantity: item.quantity,
          inventoryConsumption: this.extractInventoryConsumption(
            item.pricingJson,
          ),
        }));
        const derivedSaleLegal =
          currentOrder.saleLegalRequirement ===
          SaleLegalRequirement.PENDING_STOCK_ASSIGNMENT
            ? this.resolveSaleLegalRequirement(saleLegalItems)
            : null;
        const effectiveSaleLegal = {
          saleLegalRequirement:
            derivedSaleLegal?.saleLegalRequirement ??
            currentOrder.saleLegalRequirement,
          saleLegalStatus:
            derivedSaleLegal?.saleLegalStatus ?? currentOrder.saleLegalStatus,
          saleLegalDocumentType: currentOrder.saleLegalDocumentType,
          saleLegalDocumentReference: currentOrder.saleLegalDocumentReference,
          saleLegalTrace: derivedSaleLegal?.saleLegalTrace,
          saleLegalResolvedAt: derivedSaleLegal?.saleLegalResolvedAt,
        };

        const saleLegalUpdate: Prisma.OrderUpdateInput = {};

        if (derivedSaleLegal) {
          saleLegalUpdate.saleLegalRequirement =
            derivedSaleLegal.saleLegalRequirement;
          saleLegalUpdate.saleLegalStatus = derivedSaleLegal.saleLegalStatus;
          saleLegalUpdate.saleLegalTrace = derivedSaleLegal.saleLegalTrace;
          saleLegalUpdate.saleLegalResolvedAt =
            derivedSaleLegal.saleLegalResolvedAt;
        }

        if (saleLegalDocumentType) {
          this.validateSaleLegalDocumentType(
            effectiveSaleLegal.saleLegalRequirement,
            saleLegalDocumentType,
          );
          effectiveSaleLegal.saleLegalDocumentType = saleLegalDocumentType;
          effectiveSaleLegal.saleLegalStatus = SaleLegalStatus.COMPLETED;
          saleLegalUpdate.saleLegalDocumentType = saleLegalDocumentType;
          saleLegalUpdate.saleLegalStatus = SaleLegalStatus.COMPLETED;
          saleLegalUpdate.saleLegalCompletedAt = new Date();
        }

        if (saleLegalDocumentReference !== undefined) {
          const normalizedReference = saleLegalDocumentReference.trim();
          effectiveSaleLegal.saleLegalDocumentReference =
            normalizedReference || null;
          saleLegalUpdate.saleLegalDocumentReference =
            normalizedReference || null;
        }

        if (status && this.requiresCompletedSaleLegalDocument(status)) {
          this.assertSaleLegalClosureAllowed(effectiveSaleLegal);
        }

        if (
          status === OrderStatus.CANCELADA &&
          this.isPendingPaymentStatus(currentOrder.status)
        ) {
          for (const item of currentOrder.items) {
            if (
              item.variantId &&
              this.hasInventoryCommitment(item.pricingJson)
            ) {
              await this.inventoryService.releaseCommittedStock(
                item.variantId,
                item.quantity,
                undefined,
                id,
                tx,
              );

              const basePricingJson =
                item.pricingJson &&
                typeof item.pricingJson === 'object' &&
                !Array.isArray(item.pricingJson)
                  ? (item.pricingJson as Record<string, unknown>)
                  : {};
              const pricingJsonRest = { ...basePricingJson };
              delete pricingJsonRest.inventoryCommitment;

              await tx.orderItem.update({
                where: { id: item.id },
                data: {
                  pricingJson: Object.keys(pricingJsonRest).length
                    ? (pricingJsonRest as Prisma.InputJsonValue)
                    : (null as unknown as Prisma.InputJsonValue),
                },
              });
            }
          }
        }

        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            ...(status ? { status } : {}),
            ...data,
            ...saleLegalUpdate,
            statusHistory:
              !status || currentOrder.status === status
                ? undefined
                : {
                    create: {
                      status,
                      oldStatus: currentOrder.status,
                      newStatus: status,
                      userId: null,
                    },
                  },
          },
        });

        if (status || data.trackingNumber || data.carrier) {
          await this.shippingSyncService.ensureShipmentForOrder(id, tx);
        }

        return this.serializeOrderMoney(updatedOrder);
      });
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updateOrderDto,
    });

    if (updateOrderDto.trackingNumber || updateOrderDto.carrier) {
      await this.shippingSyncService.ensureShipmentForOrder(id);
    }

    return updatedOrder;
  }
}
