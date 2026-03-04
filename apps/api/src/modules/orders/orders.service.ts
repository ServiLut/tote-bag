import { Injectable } from '@nestjs/common';
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
      isB2B,
      ...orderData
    } = createOrderDto;

    return this.prisma.$transaction(async (tx) => {
      const processedItems = await Promise.all(
        items.map(async (item) => {
          let unitPrice = item.price || 0;
          let totalPrice = unitPrice * item.quantity;
          let configurationJson: Prisma.InputJsonValue | undefined = undefined;
          let pricingJson: Prisma.InputJsonValue | undefined = undefined;

          if (item.configuration) {
            const scope = isB2B ? PriceRuleScope.B2B : PriceRuleScope.B2C;
            const quote = await this.pricingService.calculateQuote(
              item.configuration,
              scope,
            );
            unitPrice = quote.unitPrice;
            totalPrice = quote.total;

            // Generate Configuration Snapshot
            const configSnapshot: ConfigurationSnapshot = {
              version: '1.1',
              configCode: quote.snapshot.configCode,
              productId: item.productId,
              productName: item.sku, // Fallback if name not in DTO
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
          // Note: userId is required for audit logs in inventory service
          await this.inventoryService.reduceStockFIFO(
            item.productId,
            item.quantity,
            userId || 'SYSTEM',
            tx,
          );

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

      // Calculate total amount
      const totalAmount = processedItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );

      // Prepare shipping address as JSON-compatible object
      const shippingAddressJson = {
        ...(shippingAddress as object),
        firstName,
        lastName,
        department,
      } as Prisma.InputJsonValue;

      return tx.order.create({
        data: {
          ...orderData,
          isB2B: !!isB2B,
          shippingAddress: shippingAddressJson,
          totalAmount,
          statusHistory: {
            create: {
              status: 'PENDIENTE_PAGO',
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
        },
        include: { items: true, statusHistory: true },
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
      include: {
        items: {
          include: {
            product: {
              include: {
                variants: true,
                images: true,
              },
            },
          },
        },
        statusHistory: true,
        profile: true,
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
