import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Prisma } from '../../generated/client/client';
import { PricingService } from '../pricing/pricing.service';
import { PriceRuleScope } from '../../generated/client/enums';
import { ConfigurationSnapshot } from '../../common/interfaces/snapshots.interface';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    const {
      items,
      shippingAddress,
      firstName,
      lastName,
      department,
      isB2B,
      ...orderData
    } = createOrderDto;

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

    return this.prisma.order.create({
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
  }

  async findAll() {
    return this.prisma.order.findMany({
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
