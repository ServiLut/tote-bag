import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShippingProviderDto } from './dto/create-provider.dto';
import { UpdateShippingProviderDto } from './dto/update-provider.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import {
  ShipmentStatus,
  OrderStatus,
  Prisma,
} from '../../generated/client/client';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- Shipping Providers CRUD ---

  async createProvider(dto: CreateShippingProviderDto) {
    return this.prisma.shippingProvider.create({
      data: dto,
    });
  }

  async getProviders() {
    return this.prisma.shippingProvider.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getProviderById(id: string) {
    const provider = await this.prisma.shippingProvider.findUnique({
      where: { id },
    });
    if (!provider) throw new NotFoundException('Proveedor no encontrado');
    return provider;
  }

  async updateProvider(id: string, dto: UpdateShippingProviderDto) {
    return this.prisma.shippingProvider.update({
      where: { id },
      data: dto,
    });
  }

  async deleteProvider(id: string) {
    return this.prisma.shippingProvider.delete({
      where: { id },
    });
  }

  // --- Shipments Management ---

  async getPendingShipments() {
    // Órdenes pagadas que no tienen envío o envío está PENDING o READY_TO_SHIP
    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAGADA,
        OR: [
          { shipment: null },
          {
            shipment: {
              status: {
                in: [ShipmentStatus.PENDING, ShipmentStatus.READY_TO_SHIP],
              },
            },
          },
        ],
      },
      include: {
        shipment: {
          include: { provider: true },
        },
        profile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderAndShipment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { profile: true },
    });

    if (!order) throw new NotFoundException('Orden no encontrada');

    const shipment = await this.prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment) throw new NotFoundException('Envío no encontrado');

    return { order, shipment };
  }

  async getShipments() {
    return this.prisma.shipment.findMany({
      include: {
        order: true,
        provider: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateShipment(orderId: string, dto: UpdateShipmentDto) {
    // Buscar si existe el envío para esta orden
    let shipment = await this.prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment) {
      // Crear envío si no existe
      shipment = await this.prisma.shipment.create({
        data: {
          orderId,
          ...dto,
          status: dto.status || ShipmentStatus.PENDING,
          shippedAt: dto.status === ShipmentStatus.SHIPPED ? new Date() : null,
        },
      });
    } else {
      // Actualizar envío
      const data: Prisma.ShipmentUpdateInput = { ...dto };
      if (
        dto.status === ShipmentStatus.SHIPPED &&
        shipment.status !== ShipmentStatus.SHIPPED
      ) {
        data.shippedAt = new Date();
      }
      if (
        dto.status === ShipmentStatus.DELIVERED &&
        shipment.status !== ShipmentStatus.DELIVERED
      ) {
        data.deliveredAt = new Date();
      }

      shipment = await this.prisma.shipment.update({
        where: { orderId },
        data,
      });
    }

    // Si el estado cambia a SHIPPED, enviar notificación (placeholder)
    if (dto.status === ShipmentStatus.SHIPPED) {
      await this.sendShippingNotification(
        orderId,
        shipment.trackingNumber ?? undefined,
      );
    }

    // Actualizar también el estado de la orden si corresponde
    if (dto.status === ShipmentStatus.SHIPPED) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.ENVIADA },
      });
    } else if (dto.status === ShipmentStatus.DELIVERED) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.ENTREGADA },
      });
    }

    return shipment;
  }

  private async sendShippingNotification(
    orderId: string,
    trackingNumber?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { profile: true },
    });

    if (!order) return;

    const email = order.customerEmail || order.profile?.email;
    if (!email) return;

    this.logger.log(
      `[NOTIFICACIÓN] Enviando correo a ${email} para orden #${order.orderNumber}. Guía: ${trackingNumber || 'N/A'}`,
    );

    // TODO: Integrar con servicio de correo real (SendGrid, AWS SES, etc.)
    // console.log(`Hola, tu pedido #${order.orderNumber} ha sido enviado. Tracking: ${trackingNumber}`);
  }
}
