import { ShippingNotifierService } from './shipping-notifier.service';

describe('ShippingNotifierService', () => {
  const prisma = {
    order: {
      findUnique: jest.fn(),
    },
  };

  const notificationsService = {
    handleShipmentDispatched: jest.fn(),
  };

  let service: ShippingNotifierService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ShippingNotifierService(
      prisma as never,
      notificationsService as never,
    );
  });

  it('reenvia el despacho al runtime real de notificaciones', async () => {
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
});
