import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ShippingNotifierService {
  private readonly logger = new Logger(ShippingNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
    const payload = {
      event: 'shipment.dispatched' as const,
      occurredAt: new Date().toISOString(),
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        trackingNumber: resolvedTrackingNumber,
      },
      customer: {
        email,
      },
    };
    const webhookUrl = this.configService
      .get<string>('SHIPPING_NOTIFICATIONS_WEBHOOK_URL')
      ?.trim();
    const webhookToken = this.configService
      .get<string>('SHIPPING_NOTIFICATIONS_WEBHOOK_TOKEN')
      ?.trim();

    try {
      if (webhookUrl && webhookToken) {
        await this.dispatchToWebhook(webhookUrl, webhookToken, payload);
        return;
      }

      await this.notificationsService.handleShipmentDispatched(payload);
    } catch (error) {
      const provider = webhookUrl && webhookToken ? 'webhook' : 'runtime';
      this.logger.error(
        `[SHIPPING_NOTIFICATION_FAILED] orderId=${orderId} orderNumber=${order.orderNumber} provider=${provider} reason=${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async dispatchToWebhook(
    webhookUrl: string,
    webhookToken: string,
    payload: {
      event: 'shipment.dispatched';
      occurredAt: string;
      order: {
        id: string;
        orderNumber: number;
        trackingNumber: string | null;
      };
      customer: {
        email: string;
      };
    },
  ) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${webhookToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return;
    }

    const responseBody = await response.text();
    throw new Error(
      `Shipping notifications webhook responded with ${response.status}${responseBody ? `: ${responseBody}` : ''}`,
    );
  }
}
