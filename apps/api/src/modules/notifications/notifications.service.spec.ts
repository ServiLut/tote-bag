import {
  NotificationEmailSender,
  ShipmentDispatchedEmailMessage,
} from './notifications.constants';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const sendShipmentDispatchedEmail = jest.fn<
    Promise<void>,
    [ShipmentDispatchedEmailMessage]
  >();

  const emailSender: NotificationEmailSender = {
    providerName: 'log',
    sendShipmentDispatchedEmail,
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(emailSender);
  });

  it('prepares and forwards shipment.dispatched emails to the sender', async () => {
    await expect(
      service.handleShipmentDispatched({
        event: 'shipment.dispatched',
        occurredAt: '2026-05-07T12:30:00.000Z',
        order: {
          id: ' order-1 ',
          orderNumber: 1234,
          trackingNumber: ' TRK-001 ',
        },
        customer: {
          email: 'Cliente@Correo.com ',
        },
      }),
    ).resolves.toEqual({
      accepted: true,
      processed: true,
      channel: 'email',
      provider: 'log',
    });

    const sentMessage = sendShipmentDispatchedEmail.mock.calls[0]?.[0];

    expect(sentMessage).toMatchObject({
      event: 'shipment.dispatched',
      occurredAt: '2026-05-07T12:30:00.000Z',
      orderId: 'order-1',
      orderNumber: 1234,
      trackingNumber: 'TRK-001',
      customerEmail: 'cliente@correo.com',
      subject: 'Tu pedido #1234 ya fue despachado',
    });
    expect(sentMessage?.html).toContain(
      'Tu pedido <strong>#1234</strong> ya fue despachado.',
    );
    expect(sentMessage?.text).toContain('Tu pedido #1234 ya fue despachado.');
  });

  it('keeps null tracking numbers when preparing the message', async () => {
    await service.handleShipmentDispatched({
      event: 'shipment.dispatched',
      occurredAt: '2026-05-07T12:30:00.000Z',
      order: {
        id: 'order-1',
        orderNumber: 1234,
        trackingNumber: null,
      },
      customer: {
        email: 'cliente@correo.com',
      },
    });

    expect(sendShipmentDispatchedEmail.mock.calls[0]?.[0]?.trackingNumber).toBe(
      null,
    );
  });

  it('rethrows provider errors so the caller can mark the webhook as failed', async () => {
    sendShipmentDispatchedEmail.mockRejectedValue(
      new Error('provider unavailable'),
    );

    await expect(
      service.handleShipmentDispatched({
        event: 'shipment.dispatched',
        occurredAt: '2026-05-07T12:30:00.000Z',
        order: {
          id: 'order-1',
          orderNumber: 1234,
          trackingNumber: 'TRK-001',
        },
        customer: {
          email: 'cliente@correo.com',
        },
      }),
    ).rejects.toThrow('provider unavailable');
  });
});
