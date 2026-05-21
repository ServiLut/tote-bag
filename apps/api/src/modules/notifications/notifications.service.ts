import { Inject, Injectable, Logger } from '@nestjs/common';
import { ShippingNotificationDto } from './dto/shipping-notification.dto';
import {
  NOTIFICATION_EMAIL_SENDER,
  NotificationEmailSender,
  ShipmentDispatchedEmailMessage,
} from './notifications.constants';
import { redactEmail } from '../../common/logger/log-sanitization';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATION_EMAIL_SENDER)
    private readonly emailSender: NotificationEmailSender,
  ) {}

  async handleShipmentDispatched(payload: ShippingNotificationDto) {
    const preparedMessage = this.buildShipmentDispatchedEmailMessage(payload);

    this.logger.log(
      `[SHIPMENT_DISPATCH_NOTIFICATION_PROCESSING] orderId=${preparedMessage.orderId} orderNumber=${preparedMessage.orderNumber} email=${redactEmail(preparedMessage.customerEmail)} trackingNumber=${preparedMessage.trackingNumber ?? 'N/A'} provider=${this.emailSender.providerName}`,
    );

    try {
      await this.emailSender.sendShipmentDispatchedEmail(preparedMessage);

      this.logger.log(
        `[SHIPMENT_DISPATCH_NOTIFICATION_PROCESSED] orderId=${preparedMessage.orderId} orderNumber=${preparedMessage.orderNumber} channel=email provider=${this.emailSender.providerName}`,
      );

      return {
        accepted: true,
        processed: true,
        channel: 'email' as const,
        provider: this.emailSender.providerName,
      };
    } catch (error) {
      this.logger.error(
        `[SHIPMENT_DISPATCH_NOTIFICATION_FAILED] orderId=${preparedMessage.orderId} orderNumber=${preparedMessage.orderNumber} provider=${this.emailSender.providerName} reason=${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw error;
    }
  }

  private buildShipmentDispatchedEmailMessage(
    payload: ShippingNotificationDto,
  ): ShipmentDispatchedEmailMessage {
    const orderId = payload.order.id.trim();
    const orderNumber = payload.order.orderNumber;
    const trackingNumber = payload.order.trackingNumber?.trim() || null;
    const customerEmail = payload.customer.email.trim().toLowerCase();
    const subject = `Tu pedido #${orderNumber} ya fue despachado`;
    const trackingSummary = trackingNumber
      ? `Numero de guia: ${trackingNumber}`
      : 'Tu pedido ya va en camino. Te compartiremos mas novedades por este medio.';
    const text = [
      `Hola,`,
      ``,
      `Tu pedido #${orderNumber} ya fue despachado.`,
      trackingSummary,
      ``,
      `Gracias por comprar con Tote Bag.`,
    ].join('\n');
    const html = [
      '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">',
      '<p>Hola,</p>',
      `<p>Tu pedido <strong>#${orderNumber}</strong> ya fue despachado.</p>`,
      trackingNumber
        ? `<p><strong>Numero de guia:</strong> ${trackingNumber}</p>`
        : '<p>Tu pedido ya va en camino. Te compartiremos mas novedades por este medio.</p>',
      '<p>Gracias por comprar con Tote Bag.</p>',
      '</div>',
    ].join('');

    return {
      event: 'shipment.dispatched' as const,
      occurredAt: payload.occurredAt,
      orderId,
      orderNumber,
      trackingNumber,
      customerEmail,
      subject,
      html,
      text,
    };
  }
}
