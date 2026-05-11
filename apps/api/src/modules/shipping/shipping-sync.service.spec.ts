/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  OrderStatus,
  ShippingMethod,
  ShipmentStatus,
} from '../../generated/client/client';
import { ShippingSyncService } from './shipping-sync.service';

describe('ShippingSyncService', () => {
  const prisma = {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    shipment: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: ShippingSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ShippingSyncService(prisma as never);
  });

  it('ignora ordenes PICKUP al sincronizar shipment automatico', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-pickup',
      status: OrderStatus.PAGADA,
      shippingMethod: ShippingMethod.PICKUP,
      trackingNumber: null,
      carrier: null,
      shippingAddress: {
        type: 'PICKUP',
      },
      shipment: null,
    });

    await expect(
      service.ensureShipmentForOrder('order-pickup'),
    ).resolves.toBeNull();

    expect(prisma.shipment.create).not.toHaveBeenCalled();
    expect(prisma.shipment.update).not.toHaveBeenCalled();
  });

  it('crea shipment para ordenes SHIPPING elegibles', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-shipping',
      status: OrderStatus.PAGADA,
      shippingMethod: ShippingMethod.SHIPPING,
      trackingNumber: 'TRK-1',
      carrier: 'Servientrega',
      shippingAddress: {
        city: 'Medellin',
      },
      shipment: null,
    });
    prisma.shipment.create.mockResolvedValue({
      id: 'shipment-1',
      orderId: 'order-shipping',
      status: ShipmentStatus.PENDING,
    });

    await service.ensureShipmentForOrder('order-shipping');

    expect(prisma.shipment.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-shipping',
        providerId: null,
        trackingNumber: 'TRK-1',
        status: ShipmentStatus.PENDING,
        shippedAt: null,
        deliveredAt: null,
      },
    });
  });

  it('consulta solo ordenes SHIPPING sin shipment para la cola operativa', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await service.getOrdersWithoutShipmentRecords();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shipment: null,
          shippingMethod: ShippingMethod.SHIPPING,
        }),
      }),
    );
  });

  it('reintenta en modo legacy si falta shipping_method en orders', async () => {
    prisma.order.findMany
      .mockRejectedValueOnce(
        new Error('column "shipping_method" does not exist'),
      )
      .mockRejectedValueOnce(
        new Error('column "shipping_method" does not exist'),
      )
      .mockResolvedValueOnce([
        {
          id: 'order-legacy',
          orderNumber: 3001,
          customerEmail: 'legacy@example.com',
          totalAmount: 45000,
          balanceDue: 0,
          createdAt: new Date('2026-05-04T12:00:00.000Z'),
          city: 'Bogota',
          status: OrderStatus.PAGADA,
          saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
          saleLegalStatus: 'COMPLETED',
          trackingNumber: null,
          carrier: null,
          shippingAddress: { city: 'Bogota' },
          profile: null,
        },
      ]);

    const result = await service.getOrdersWithoutShipmentRecords();

    expect(prisma.order.findMany).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(1);
    expect(result[0].order.saleLegalRequirement).toBe(
      'INTERNAL_DOCUMENT_ALLOWED',
    );
    expect(result[0].order.saleLegalStatus).toBe('COMPLETED');
  });
});
