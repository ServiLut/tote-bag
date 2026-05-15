import { ConfigService } from '@nestjs/config';
import { ResendNotificationEmailSender } from './resend-notification-email.sender';

describe('ResendNotificationEmailSender', () => {
  const originalFetch = global.fetch;

  const configValues = {
    RESEND_API_KEY: 're_test_123',
    NOTIFICATIONS_FROM_EMAIL: 'notificaciones@example.com',
    NOTIFICATIONS_FROM_NAME: 'Tote Bag',
    NOTIFICATIONS_REPLY_TO_EMAIL: 'soporte@example.com',
  } satisfies Record<string, string>;

  const configService = {
    get: jest.fn(
      (key: string) => configValues[key as keyof typeof configValues],
    ),
  } as unknown as ConfigService;

  let sender: ResendNotificationEmailSender;

  beforeEach(() => {
    jest.clearAllMocks();
    sender = new ResendNotificationEmailSender(configService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends shipment dispatched emails through the Resend API', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'email-123' }),
    } as unknown as Response);
    global.fetch = fetchMock;

    await sender.sendShipmentDispatchedEmail({
      event: 'shipment.dispatched',
      occurredAt: '2026-05-07T12:30:00.000Z',
      orderId: 'order-1',
      orderNumber: 1234,
      trackingNumber: 'TRK-001',
      customerEmail: 'cliente@correo.com',
      subject: 'Tu pedido #1234 ya fue despachado',
      html: '<p>Despachado</p>',
      text: 'Despachado',
    });

    const firstCallUnknown: unknown = fetchMock.mock.calls[0];
    const firstCall = firstCallUnknown as Parameters<typeof fetch> | undefined;
    expect(firstCall).toBeDefined();

    const [requestUrl, requestInit] = firstCall as Parameters<typeof fetch>;
    const requestHeaders = requestInit?.headers as
      | Record<string, string>
      | undefined;

    expect(requestUrl).toBe('https://api.resend.com/emails');
    expect(requestInit?.method).toBe('POST');
    expect(requestHeaders).toMatchObject({
      Authorization: 'Bearer re_test_123',
      'Content-Type': 'application/json',
      'User-Agent': 'tote-bag-api/notifications-resend',
      'Idempotency-Key': 'shipment-dispatched:order-1:2026-05-07T12:30:00.000Z',
    });

    const parsedBody = JSON.parse(
      (requestInit as RequestInit).body as string,
    ) as {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
      reply_to: string;
    };

    expect(parsedBody).toMatchObject({
      from: 'Tote Bag <notificaciones@example.com>',
      to: ['cliente@correo.com'],
      subject: 'Tu pedido #1234 ya fue despachado',
      html: '<p>Despachado</p>',
      text: 'Despachado',
      reply_to: 'soporte@example.com',
    });
  });

  it('throws when the Resend API rejects the request', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ message: 'Invalid API key' }),
    } as unknown as Response);
    global.fetch = fetchMock;

    await expect(
      sender.sendShipmentDispatchedEmail({
        event: 'shipment.dispatched',
        occurredAt: '2026-05-07T12:30:00.000Z',
        orderId: 'order-1',
        orderNumber: 1234,
        trackingNumber: 'TRK-001',
        customerEmail: 'cliente@correo.com',
        subject: 'Tu pedido #1234 ya fue despachado',
        html: '<p>Despachado</p>',
        text: 'Despachado',
      }),
    ).rejects.toThrow(
      'Resend API request failed with status 403: Invalid API key',
    );
  });
});
