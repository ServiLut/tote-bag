import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Prisma } from '../generated/client/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    const {
      items,
      shippingAddress,
      firstName,
      lastName,
      department,
      ...orderData
    } = createOrderDto;

    // Calculate total amount
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
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
        shippingAddress: shippingAddressJson,
        totalAmount,
        statusHistory: {
          create: {
            status: 'PENDIENTE_PAGO',
          },
        },
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku,
            variantId: item.variantId,
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
