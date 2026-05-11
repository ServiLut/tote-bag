/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  OrderStatus,
  ShipmentStatus,
} from '../../generated/client/client';
import { ShippingSyncService } from './shipping-sync.service';

describe('ShippingSyncService', () => {
  const prisma = {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    shippingProvider: {
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
      shippingMethod: 'PICKUP',
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
      shippingMethod: 'SHIPPING',
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

  it('filtra ordenes PICKUP al construir la cola operativa', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'pickup-1',
        orderNumber: 3000,
        customerEmail: 'pickup@example.com',
        totalAmount: 30000,
        balanceDue: 0,
        createdAt: new Date('2026-05-04T10:00:00.000Z'),
        city: 'Medellin',
        status: OrderStatus.PAGADA,
        saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
        saleLegalStatus: 'COMPLETED',
        trackingNumber: null,
        carrier: null,
        shippingAddress: { type: 'PICKUP', city: 'Medellin' },
        profile: null,
      },
      {
        id: 'shipping-1',
        orderNumber: 3001,
        customerEmail: 'shipping@example.com',
        totalAmount: 45000,
        balanceDue: 0,
        createdAt: new Date('2026-05-04T12:00:00.000Z'),
        city: 'Bogota',
        status: OrderStatus.PAGADA,
        saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
        saleLegalStatus: 'COMPLETED',
        trackingNumber: null,
        carrier: null,
        shippingAddress: { shippingMethod: 'SHIPPING', city: 'Bogota' },
        profile: null,
      },
    ]);

    const result = await service.getOrdersWithoutShipmentRecords();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shipment: null,
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('shipping-1');
  });

  it('asume SHIPPING para ordenes legacy sin shippingMethod explicito', async () => {
    prisma.order.findMany.mockResolvedValue([
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

    expect(prisma.order.findMany).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].order.saleLegalRequirement).toBe(
      'INTERNAL_DOCUMENT_ALLOWED',
    );
    expect(result[0].order.saleLegalStatus).toBe('COMPLETED');
  });
});
