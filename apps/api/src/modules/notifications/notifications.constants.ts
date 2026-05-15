export const NOTIFICATION_EMAIL_SENDER = Symbol('NOTIFICATION_EMAIL_SENDER');

export const SUPPORTED_NOTIFICATION_EMAIL_PROVIDERS = [
  'log',
  'resend',
] as const;

export type NotificationEmailProvider =
  (typeof SUPPORTED_NOTIFICATION_EMAIL_PROVIDERS)[number];

export type ShipmentDispatchedEmailMessage = {
  event: 'shipment.dispatched';
  occurredAt: string;
  orderId: string;
  orderNumber: number;
  trackingNumber: string | null;
  customerEmail: string;
  subject: string;
  html: string;
  text: string;
};

export interface NotificationEmailSender {
  readonly providerName: NotificationEmailProvider;

  sendShipmentDispatchedEmail(
    message: ShipmentDispatchedEmailMessage,
  ): Promise<void>;
}
