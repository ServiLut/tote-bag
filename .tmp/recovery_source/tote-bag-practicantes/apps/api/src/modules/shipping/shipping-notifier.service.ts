import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ShippingNotifierService {
  private readonly logger = new Logger(ShippingNotifierService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyShipmentDispatched(orderId: string, trackingNumber?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { profile: true },
    });

    if (!order) {
      this.logger.warn(
        `[SHIPPING_NOTIFICATION_SKIPPED] Order not found for shipment notification. orderId=${orderId}`,
      );
      return;
    }

    const email = order.customerEmail || order.profile?.email;

    if (!email) {
      this.logger.warn(
        `[SHIPPING_NOTIFICATION_SKIPPED] Missing customer email. orderId=${orderId} orderNumber=${order.orderNumber}`,
      );
      return;
    }

    // Noop provider for now. This keeps shipping stable until a real mail provider is configured.
    this.logger.log(
      `[SHIPPING_NOTIFICATION_NOOP] orderId=${orderId} orderNumber=${order.orderNumber} email=${email} trackingNumber=${trackingNumber || 'N/A'}`,
    );
  }
}
