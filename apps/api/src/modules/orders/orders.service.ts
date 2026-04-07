import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
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

type InventoryConsumptionReduction = {
  batchId: string;
  supplierId: string;
  quantity: number;
  unitCost: number;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly inventoryService: InventoryService,
    private readonly shippingSyncService: ShippingSyncService,
  ) {}

  private async resolveVariantId(
    tx: Prisma.TransactionClient,
    item: {
      variantId?: string | null;
      sku: string;
      productId: string;
    },
  ) {
    if (item.variantId) {
      return item.variantId;
    }

    if (!item.sku) {
      throw new BadRequestException(
        `No se pudo identificar la variante para el producto ${item.productId}`,
      );
    }

    const variant = await tx.variant.findUnique({
      where: { sku: item.sku },
      select: { id: true },
    });

    if (!variant?.id) {
      throw new BadRequestException(
        `No se pudo identificar la variante para el producto ${item.sku || item.productId}`,
      );
    }

    return variant.id;
  }

  private hasInventoryConsumption(pricingJson: Prisma.JsonValue | null) {
    return (
      !!pricingJson &&
      typeof pricingJson === 'object' &&
      !Array.isArray(pricingJson) &&
      'inventoryConsumption' in pricingJson
    );
  }

  private async buildInventoryConsumption(
    tx: Prisma.TransactionClient,
    item: {
      variantId?: string | null;
      sku: string;
      productId: string;
      quantity: number;
    },
    userId?: string,
  ) {
    const targetVariantId = await this.resolveVariantId(tx, item);
    const stockReduction = await this.inventoryService.reduceStockFIFO(
      targetVariantId,
      item.quantity,
      userId,
      tx,
    );

    return {
      totalCOGS: stockReduction.totalCOGS,
      reductions: stockReduction.reductions,
    };
  }

  async create(createOrderDto: CreateOrderDto, userId?: string) {
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

    return this.prisma.$transaction(async (tx) => {
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
            throw new BadRequestException('Cada item debe tener un productId');
          }

          const baseProduct = await tx.product.findUnique({
            where: { id: item.productId },
            select: {
              id: true,
              basePrice: true,
              minPrice: true,
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

          // Never trust client-side price; start from server-side product price.
          let unitPrice = Math.max(baseProduct.basePrice, baseProduct.minPrice);
          let totalPrice = unitPrice * item.quantity;
          let configurationJson: Prisma.InputJsonValue | undefined = undefined;
          let pricingJsonPayload: Record<string, unknown> = {};
          let imageUrl: string | null = null;

          if (item.configuration) {
            const scope = isB2B ? PriceRuleScope.B2B : PriceRuleScope.B2C;
            const quote = await this.pricingService.calculateQuote(
              {
                ...item.configuration,
                productId: item.productId,
                quantity: item.quantity,
              },
              scope,
            );
            unitPrice = quote.unitPrice;
            totalPrice = quote.total;

            // Generate Configuration Snapshot
            const configSnapshot: ConfigurationSnapshot = {
              version: '1.1',
              configCode: quote.snapshot.configCode,
              productId: item.productId,
              productName: item.sku,
              line: item.configuration.line,
              size: item.configuration.size,
              material: item.configuration.material,
              quality: item.configuration.quality,
              customImageURL: item.configuration.customImageURL,
              personalizations: normalizeSnapshotPersonalizations(
                item.configuration.personalizations,
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

          return {
            ...item,
            imageUrl: imageUrl ?? baseProduct.images[0]?.url ?? null,
            unitPrice,
            totalPrice,
            configurationJson:
              configurationJson ?? (null as unknown as Prisma.InputJsonValue),
            pricingJson,
          };
        }),
      );

      const subtotalAmount = processedItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );

      const normalizedDiscountValue = Math.max(0, manualDiscountValue ?? 0);
      const discountAmount =
        manualDiscountType === 'percent'
          ? (subtotalAmount * normalizedDiscountValue) / 100
          : normalizedDiscountValue;
      const totalAmount = Math.max(0, subtotalAmount - discountAmount);

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
        manualDiscount:
          normalizedDiscountValue > 0
            ? {
                type: manualDiscountType ?? 'amount',
                value: normalizedDiscountValue,
                amount: discountAmount,
                subtotal: subtotalAmount,
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
          totalAmount,
          statusHistory: {
            create: {
              status: statusToSet,
            },
          },
          items: {
            create: processedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
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

      if (statusToSet !== OrderStatus.PENDIENTE_PAGO) {
        await this.shippingSyncService.ensureShipmentForOrder(
          createdOrder.id,
          tx,
        );
      }

      return createdOrder;
    });
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

      if (order.status === OrderStatus.PAGADA) {
        return order;
      }

      if (order.status !== OrderStatus.PENDIENTE_PAGO) {
        return order;
      }

      for (const item of order.items) {
        if (this.hasInventoryConsumption(item.pricingJson)) {
          continue;
        }

        const inventoryConsumption = await this.buildInventoryConsumption(
          tx,
          item,
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
          statusHistory: {
            create: {
              status: OrderStatus.PAGADA,
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

    return this.prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        city: true,
        totalAmount: true,
        status: true,
        source: true,
        trackingNumber: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            sku: true,
            quantity: true,
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.order.findUnique({
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
      },
    });
  }

  async findOneWithDetails(id: string) {
    return this.prisma.order.findUnique({
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
  }

  async findByUser(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true, email: true },
    });

    if (!profile) {
      return [];
    }

    return this.prisma.order.findMany({
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const { status, ...data } = updateOrderDto;

    if (status) {
      // If status changes, add to history
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: {
          status,
          ...data,
          statusHistory: {
            create: {
              status,
            },
          },
        },
      });

      await this.shippingSyncService.ensureShipmentForOrder(id);

      return updatedOrder;
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
