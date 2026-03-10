import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Prisma } from '../../generated/client/client';
import { PricingService } from '../pricing/pricing.service';
import { InventoryService } from '../inventory/inventory.service';
import { PriceRuleScope, OrderStatus } from '../../generated/client/enums';
import { ConfigurationSnapshot } from '../../common/interfaces/snapshots.interface';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly inventoryService: InventoryService,
  ) {}

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
      initialStatus,
      ...orderData
    } = createOrderDto;

    // Determine initial status
    const statusToSet =
      (initialStatus as OrderStatus) || OrderStatus.PENDIENTE_PAGO;

    // Ensure we have a valid user for audit/transactions
    let finalUserId = userId;
    if (!finalUserId) {
      // For guest checkout or if no userId is provided, we try to find a system user or use a default
      const systemUser = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });
      finalUserId = systemUser?.id;

      if (!finalUserId) {
        // Fallback: create a system user if none exists (should only happen in fresh dev env)
        const newUser = await this.prisma.user.create({
          data: {
            id: 'SYSTEM_ADMIN_ID',
            email: 'system@totebag.com',
            role: 'ADMIN',
          },
        });
        finalUserId = newUser.id;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const processedItems = await Promise.all(
        items.map(async (item) => {
          if (!item.productId) {
            throw new BadRequestException('Cada item debe tener un productId');
          }

          const baseProduct = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, basePrice: true, minPrice: true },
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
          let pricingJson: Prisma.InputJsonValue | undefined = undefined;

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
              personalizations: item.configuration.personalizations,
              timestamp: new Date().toISOString(),
            };

            configurationJson =
              configSnapshot as unknown as Prisma.InputJsonValue;
            pricingJson = quote.snapshot as unknown as Prisma.InputJsonValue;
          }

          // 1. Reduce stock for each item
          try {
            // Priority: variantId from DTO
            let targetVariantId = item.variantId;

            // Fallback: If no variantId provided, try to find it by SKU
            if (!targetVariantId && item.sku) {
              const variant = await tx.variant.findUnique({
                where: { sku: item.sku },
                select: { id: true },
              });
              targetVariantId = variant?.id;
            }

            if (!targetVariantId) {
              throw new BadRequestException(
                `No se pudo identificar la variante para el producto ${item.sku || item.productId}`,
              );
            }

            await this.inventoryService.reduceStockFIFO(
              targetVariantId,
              item.quantity,
              finalUserId,
              tx,
            );
          } catch (error: unknown) {
            // If stock reduction fails (e.g. insufficient stock), we catch it
            // and decide whether to fail the whole order or just log it.
            // Requirement says: "maneja el error de forma controlada"
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            console.warn(
              `Stock reduction failed for item ${item.sku || item.productId}: ${errorMessage}`,
            );
            // If it's "Stock insuficiente", we probably WANT to fail the order to avoid overselling
            if (error instanceof BadRequestException) {
              throw error;
            }
          }

          return {
            ...item,
            unitPrice,
            totalPrice,
            configurationJson:
              configurationJson ?? (null as unknown as Prisma.InputJsonValue),
            pricingJson:
              pricingJson ?? (null as unknown as Prisma.InputJsonValue),
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

      return tx.order.create({
        data: {
          ...orderData,
          carrier: resolvedCarrier,
          isB2B: !!isB2B,
          isManual: !!isManual,
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
              variantId: item.variantId,
              configurationJson: item.configurationJson,
              pricingJson: item.pricingJson,
            })),
          },
          ...(provider && {
            shipment: {
              create: {
                providerId: provider.id,
              },
            },
          }),
        },
        include: { items: true, statusHistory: true, shipment: true },
      });
    });
  }

  async findAll(
    filters: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
    } = {},
  ) {
    const { status, startDate, endDate, search } = filters;
    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status as OrderStatus;
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
    return this.prisma.order.findMany({
      where: {
        profile: {
          userId: userId,
        },
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
      return this.prisma.order.update({
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
    }

    return this.prisma.order.update({
      where: { id },
      data: updateOrderDto,
    });
  }
}
