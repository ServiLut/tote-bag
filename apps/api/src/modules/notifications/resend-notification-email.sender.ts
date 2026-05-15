import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationEmailSender,
  ShipmentDispatchedEmailMessage,
} from './notifications.constants';

type ResendEmailResponse = {
  id?: string;
  message?: string;
  name?: string;
};

@Injectable()
export class ResendNotificationEmailSender implements NotificationEmailSender {
  readonly providerName = 'resend' as const;
  private readonly logger = new Logger(ResendNotificationEmailSender.name);
  private readonly resendApiUrl = 'https://api.resend.com/emails';
  private readonly requestTimeoutMs = 10_000;
  private readonly userAgent = 'tote-bag-api/notifications-resend';

  constructor(private readonly configService: ConfigService) {}

  async sendShipmentDispatchedEmail(
    message: ShipmentDispatchedEmailMessage,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY')?.trim();
    const fromEmail = this.configService
      .get<string>('NOTIFICATIONS_FROM_EMAIL')
      ?.trim();
    const fromName =
      this.configService.get<string>('NOTIFICATIONS_FROM_NAME')?.trim() ||
      'Tote Bag';
    const replyTo = this.configService
      .get<string>('NOTIFICATIONS_REPLY_TO_EMAIL')
      ?.trim();

    if (!apiKey || !fromEmail) {
      throw new Error(
        'Resend notifications sender is missing RESEND_API_KEY or NOTIFICATIONS_FROM_EMAIL.',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(this.resendApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
          'Idempotency-Key': `shipment-dispatched:${message.orderId}:${message.occurredAt}`,
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [message.customerEmail],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
          tags: [
            { name: 'event', value: 'shipment_dispatched' },
            { name: 'order_id', value: message.orderId },
            { name: 'order_number', value: String(message.orderNumber) },
          ],
        }),
        signal: controller.signal,
      });

      const responseBody =
        ((await response
          .json()
          .catch(() => null)) as ResendEmailResponse | null) ?? null;

      if (!response.ok) {
        throw new Error(
          `Resend API request failed with status ${response.status}: ${
            responseBody?.message || responseBody?.name || 'unknown error'
          }`,
        );
      }

      this.logger.log(
        `[CUSTOMER_EMAIL_SENT] provider=${this.providerName} orderId=${message.orderId} orderNumber=${message.orderNumber} email=${message.customerEmail} resendEmailId=${responseBody?.id ?? 'N/A'}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
