import { ShippingNotifierService } from './shipping-notifier.service';

describe('ShippingNotifierService', () => {
  const originalFetch = global.fetch;
  const prisma = {
    order: {
      findUnique: jest.fn(),
    },
  };

  const configService = {
    get: jest.fn(),
  };

  const notificationsService = {
    handleShipmentDispatched: jest.fn(),
  };

  let service: ShippingNotifierService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue(undefined);
    global.fetch = jest.fn();
    service = new ShippingNotifierService(
      prisma as never,
      configService as never,
      notificationsService as never,
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('reenvia el despacho al runtime local cuando no hay webhook configurado', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 1201,
      customerEmail: 'cliente@example.com',
      trackingNumber: 'TRK-DB',
      profile: null,
    });

    await service.notifyShipmentDispatched('order-1', 'TRK-API');

    expect(notificationsService.handleShipmentDispatched).toHaveBeenCalledWith({
      event: 'shipment.dispatched',
      occurredAt: expect.any(String) as unknown,
      order: {
        id: 'order-1',
        orderNumber: 1201,
        trackingNumber: 'TRK-API',
      },
      customer: {
        email: 'cliente@example.com',
      },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('envia el despacho al webhook configurado cuando hay URL y token', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-10',
      orderNumber: 1210,
      customerEmail: 'cliente@example.com',
      trackingNumber: 'TRK-DB',
      profile: null,
    });
    configService.get.mockImplementation((key: string) => {
      if (key === 'SHIPPING_NOTIFICATIONS_WEBHOOK_URL') {
        return 'https://hooks.example.com/api/v1/internal/shipping-notifications';
      }

      if (key === 'SHIPPING_NOTIFICATIONS_WEBHOOK_TOKEN') {
        return 'shipping-secret';
      }

      return undefined;
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
    });

    await service.notifyShipmentDispatched('order-10', 'TRK-API');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, requestOptions] = (global.fetch as jest.Mock).mock
      .calls[0] as [string, RequestInit];

    expect(requestUrl).toBe(
      'https://hooks.example.com/api/v1/internal/shipping-notifications',
    );
    expect(requestOptions.method).toBe('POST');
    expect(requestOptions.headers).toEqual({
      authorization: 'Bearer shipping-secret',
      'content-type': 'application/json',
    });
    expect(typeof requestOptions.body).toBe('string');
    expect(JSON.parse(requestOptions.body as string)).toMatchObject({
      event: 'shipment.dispatched',
      order: {
        id: 'order-10',
        orderNumber: 1210,
        trackingNumber: 'TRK-API',
      },
      customer: {
        email: 'cliente@example.com',
      },
    });
    expect(
      notificationsService.handleShipmentDispatched,
    ).not.toHaveBeenCalled();
  });

  it('omite la notificacion si la orden no tiene email resolvible', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-2',
      orderNumber: 1202,
      customerEmail: '',
      trackingNumber: null,
      profile: {
        email: null,
      },
    });

    await service.notifyShipmentDispatched('order-2');

    expect(
      notificationsService.handleShipmentDispatched,
    ).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('no rompe el flujo si el runtime de notificaciones falla', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-3',
      orderNumber: 1203,
      customerEmail: 'cliente@example.com',
      trackingNumber: 'TRK-3',
      profile: null,
    });
    notificationsService.handleShipmentDispatched.mockRejectedValue(
      new Error('provider unavailable'),
    );

    await expect(
      service.notifyShipmentDispatched('order-3'),
    ).resolves.toBeUndefined();
  });

  it('no rompe el flujo si el webhook configurado falla', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-4',
      orderNumber: 1204,
      customerEmail: 'cliente@example.com',
      trackingNumber: 'TRK-4',
      profile: null,
    });
    configService.get.mockImplementation((key: string) => {
      if (key === 'SHIPPING_NOTIFICATIONS_WEBHOOK_URL') {
        return 'https://hooks.example.com/api/v1/internal/shipping-notifications';
      }

      if (key === 'SHIPPING_NOTIFICATIONS_WEBHOOK_TOKEN') {
        return 'shipping-secret';
      }

      return undefined;
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue('provider unavailable'),
    });

    await expect(
      service.notifyShipmentDispatched('order-4'),
    ).resolves.toBeUndefined();
  });
});
