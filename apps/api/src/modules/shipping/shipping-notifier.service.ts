import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ShippingNotifierService {
  private readonly logger = new Logger(ShippingNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

    const resolvedTrackingNumber =
      trackingNumber?.trim() || order.trackingNumber?.trim() || null;

    try {
      await this.notificationsService.handleShipmentDispatched({
        event: 'shipment.dispatched',
        occurredAt: new Date().toISOString(),
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          trackingNumber: resolvedTrackingNumber,
        },
        customer: {
          email,
        },
      });
    } catch (error) {
      this.logger.error(
        `[SHIPPING_NOTIFICATION_FAILED] orderId=${orderId} orderNumber=${order.orderNumber} provider=runtime reason=${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
