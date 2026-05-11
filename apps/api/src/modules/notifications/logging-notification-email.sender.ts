import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationEmailSender,
  ShipmentDispatchedEmailMessage,
} from './notifications.constants';

@Injectable()
export class LoggingNotificationEmailSender implements NotificationEmailSender {
  readonly providerName = 'log' as const;
  private readonly logger = new Logger(LoggingNotificationEmailSender.name);

  sendShipmentDispatchedEmail(
    message: ShipmentDispatchedEmailMessage,
  ): Promise<void> {
    this.logger.log(
      `[CUSTOMER_EMAIL_PENDING_PROVIDER] event=${message.event} orderId=${message.orderId} orderNumber=${message.orderNumber} email=${message.customerEmail} trackingNumber=${message.trackingNumber ?? 'N/A'} provider=${this.providerName}`,
    );

    return Promise.resolve();
  }
}
