import { NotFoundException } from '@nestjs/common';
import { OrderStatus, ShipmentStatus } from '../../generated/client/client';
import { ShippingService } from './shipping.service';

describe('ShippingService', () => {
  type ShipmentCreateInput = {
    orderId: string;
    providerId: string;
    trackingNumber: string;
    status: ShipmentStatus;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
  };

  const prisma = {
    shippingProvider: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    shipment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(prisma),
    ),
  };

  const shippingNotifier = {
    notifyShipmentDispatched: jest.fn(),
  };

  const shippingSyncService = {
    getOrdersWithoutShipmentRecords: jest.fn(),
  };

  const inventoryService = {
    reduceStockFIFO: jest.fn(),
  };

  let service: ShippingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ShippingService(
      prisma as never,
      shippingNotifier as never,
      shippingSyncService as never,
      inventoryService as never,
    );
  });

  it('marca la orden como ENVIADA cuando el despacho entra directo a IN_TRANSIT', async () => {
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.PAGADA,
      trackingNumber: null,
      carrier: null,
      balanceDue: 0,
    });
    prisma.shipment.findUnique.mockResolvedValue(null);
    prisma.shippingProvider.findUnique.mockResolvedValue({
      name: 'Servientrega',
    });
    prisma.shipment.create.mockImplementation(
      ({ data }: { data: ShipmentCreateInput }) =>
        Promise.resolve({
          id: 'shipment-1',
          orderId: data.orderId,
          providerId: data.providerId,
          trackingNumber: data.trackingNumber,
          status: data.status,
          shippedAt: data.shippedAt,
          deliveredAt: data.deliveredAt,
        }),
    );
    prisma.order.update.mockResolvedValue({});

    await service.updateShipment('order-1', {
      providerId: 'provider-1',
      trackingNumber: 'TRK-1',
      status: ShipmentStatus.IN_TRANSIT,
    });

    const shipmentCreateCalls = prisma.shipment.create.mock.calls as Array<
      [
        {
          data: {
            orderId: string;
            providerId: string;
            trackingNumber: string;
            status: ShipmentStatus;
            shippedAt?: Date;
          };
        },
      ]
    >;
    const orderUpdateCalls = prisma.order.update.mock.calls as Array<
      [
        {
          where: { id: string };
          data: {
            status: OrderStatus;
            trackingNumber: string;
            carrier: string;
          };
        },
      ]
    >;

    const shipmentCreateCall = shipmentCreateCalls[0]?.[0];
    const orderUpdateCall = orderUpdateCalls[0]?.[0];

    expect(shipmentCreateCall?.data.orderId).toBe('order-1');
    expect(shipmentCreateCall?.data.providerId).toBe('provider-1');
    expect(shipmentCreateCall?.data.trackingNumber).toBe('TRK-1');
    expect(shipmentCreateCall?.data.status).toBe(ShipmentStatus.IN_TRANSIT);
    expect(shipmentCreateCall?.data.shippedAt).toBeInstanceOf(Date);
    expect(orderUpdateCall?.where.id).toBe('order-1');
    expect(orderUpdateCall?.data.status).toBe(OrderStatus.ENVIADA);
    expect(orderUpdateCall?.data.trackingNumber).toBe('TRK-1');
    expect(orderUpdateCall?.data.carrier).toBe('Servientrega');
    expect(shippingNotifier.notifyShipmentDispatched).toHaveBeenCalledWith(
      'order-1',
      'TRK-1',
    );
  });

  it('rechaza providerId inexistente al actualizar un envio', async () => {
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.PAGADA,
      trackingNumber: null,
      carrier: null,
      balanceDue: 0,
    });
    prisma.shipment.findUnique.mockResolvedValue({
      id: 'shipment-1',
      orderId: 'order-1',
      status: ShipmentStatus.PENDING,
      shippedAt: null,
    });
    prisma.shippingProvider.findUnique.mockResolvedValue(null);

    await expect(
      service.updateShipment('order-1', {
        providerId: 'missing-provider',
        trackingNumber: 'TRK-404',
        status: ShipmentStatus.SHIPPED,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.shipment.update).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
