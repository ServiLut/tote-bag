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
  batchId: string;
  supplierId: string;
  quantity: number;
  unitCost: number;
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
      OrderStatus.EN_PRODUCCION,
      OrderStatus.IN_PRODUCTION,
      OrderStatus.READY_FOR_DISPATCH,
      OrderStatus.ENVIADA,
      OrderStatus.ENTREGADA,
    ];

    return fullyPaidOperationalStatuses.includes(status);
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

  private async buildInventoryConsumption(
    tx: Prisma.TransactionClient,
    item: {
      variantId: string;
      sku: string;
      productId: string;
      quantity: number;
    },
    userId?: string,
  ) {
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
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
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
      const amountPaid = roundMoney(order.amountPaid);
      const balanceDue = roundMoney(order.balanceDue);
      const paymentDelta = balanceDue.greaterThan(0)
        ? balanceDue
        : Decimal.max(totalAmount.minus(amountPaid), 0);

      if (paymentDelta.greaterThan(0)) {
        await tx.orderPayment.create({
          data: {
            orderId,
            amount: paymentDelta,
            paymentDate: new Date(),
            notes: 'Pago completo confirmado por integracion de pagos',
          },
        });
      }

      for (const item of order.items) {
        if (this.hasInventoryConsumption(item.pricingJson)) {
          continue;
        }

        if (!item.variantId) {
          throw new BadRequestException(
            `La orden ${order.id} contiene items legacy sin variantId. Debe regularizarse antes de descontar inventario.`,
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
              inventoryConsumption,
            } as Prisma.InputJsonValue,
          },
        });
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAGADA,
          amountPaid: totalAmount,
          balanceDue: new Decimal(0),
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
        },
      });

      if (expiredCandidates.length === 0) {
        return { expiredCount: 0 };
      }

      for (const order of expiredCandidates) {
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
    const where: Prisma.OrderWhereInput = {};

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
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              proofUrl: true,
              notes: true,
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
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

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
    const proofUrl = data.proofUrl?.trim() || null;
    const notes = data.notes?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
          balanceDue: true,
        },
      });

      if (!order) {
        throw new BadRequestException('Orden no encontrada');
      }

      const totalAmount = roundMoney(order.totalAmount);
      const currentPaid = roundMoney(order.amountPaid);
      const currentBalanceDue = roundMoney(order.balanceDue);

      if (amount.greaterThan(currentBalanceDue)) {
        throw new BadRequestException(
          'El abono no puede superar el saldo pendiente de la orden',
        );
      }

      const nextPaid = roundMoney(currentPaid.plus(amount));
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

      const payment = await tx.orderPayment.create({
        data: {
          orderId,
          amount,
          paymentDate,
          proofUrl,
          notes,
        },
      });

      const nextStatus =
        nextBalanceDue.isZero() || !this.isPendingPaymentStatus(order.status)
          ? order.status
          : OrderStatus.PENDING_FINAL_PAYMENT;

      await tx.order.update({
        where: { id: orderId },
        data: {
          amountPaid: nextPaid,
          balanceDue: nextBalanceDue,
          status: nextStatus,
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
      });

      const updatedOrder = nextBalanceDue.isZero()
        ? await this.confirmPendingOrderPayment(orderId, userId, tx)
        : await tx.order.findUnique({
            where: { id: orderId },
            include: {
              items: true,
              payments: {
                orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
              },
              statusHistory: { orderBy: { createdAt: 'desc' } },
              shipment: true,
            },
          });

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
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            proofUrl: true,
            notes: true,
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
    const { status, ...data } = updateOrderDto;

    if (status) {
      return this.prisma.$transaction(async (tx) => {
        const currentOrder = await tx.order.findUnique({
          where: { id },
          select: { status: true, balanceDue: true },
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

        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            status,
            ...data,
            statusHistory:
              currentOrder.status === status
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

        await this.shippingSyncService.ensureShipmentForOrder(id, tx);

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
