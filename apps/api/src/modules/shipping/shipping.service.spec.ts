/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    supplyItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    purchaseBatch: {
      update: jest.fn(),
    },
    purchaseBatchLine: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    shipmentSupplyUsage: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    shipmentSupplyUsageAllocation: {
      create: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const shippingNotifier = {
    notifyShipmentDispatched: jest.fn(),
  };

  const shippingSyncService = {
    getOrdersWithoutShipmentRecords: jest.fn(),
  };

  let service: ShippingService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(prisma),
    );
    service = new ShippingService(
      prisma as never,
      shippingNotifier as never,
      shippingSyncService as never,
    );
  });

  function mockShippingBagStock(quantityRemaining = 2) {
    prisma.shipmentSupplyUsage.findFirst.mockResolvedValue(null);
    prisma.supplyItem.findUnique.mockResolvedValue({
      id: 'supply-1',
      name: 'Bolsa envio',
      sku: 'SHIP-BAG-1',
      supplyType: 'SHIPPING_BAG',
      isActive: true,
    });
    prisma.purchaseBatchLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        purchaseBatchId: 'batch-1',
        quantityRemaining,
        purchaseBatch: {
          id: 'batch-1',
          supplierId: 'supplier-1',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          variantId: null,
        },
      },
    ]);
    prisma.shipmentSupplyUsage.create.mockResolvedValue({ id: 'usage-1' });
    prisma.purchaseBatchLine.updateMany.mockResolvedValue({ count: 1 });
    prisma.purchaseBatchLine.findUnique.mockResolvedValue({
      quantityRemaining: 0,
    });
    prisma.purchaseBatchLine.update.mockResolvedValue({});
    prisma.shipmentSupplyUsageAllocation.create.mockResolvedValue({});
    prisma.purchaseBatchLine.count.mockResolvedValue(0);
    prisma.purchaseBatchLine.aggregate.mockResolvedValue({
      _sum: { quantityRemaining: 0 },
    });
    prisma.purchaseBatch.update.mockResolvedValue({});
    prisma.supplyItem.updateMany.mockResolvedValue({ count: 1 });
    prisma.auditLog.create.mockResolvedValue({});
  }

  it('marca la orden como ENVIADA y consume bolsas al despachar', async () => {
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
    mockShippingBagStock(2);

    await service.updateShipment(
      'order-1',
      {
        providerId: 'provider-1',
        trackingNumber: 'TRK-1',
        status: ShipmentStatus.IN_TRANSIT,
        shippingBagSupplyItemId: 'supply-1',
        shippingBagQuantityUsed: 2,
      },
      'admin-1',
    );

    const shipmentCreateCall = prisma.shipment.create.mock.calls[0]?.[0];
    const orderUpdateCall = prisma.order.update.mock.calls[0]?.[0];

    expect(shipmentCreateCall?.data.orderId).toBe('order-1');
    expect(shipmentCreateCall?.data.providerId).toBe('provider-1');
    expect(shipmentCreateCall?.data.trackingNumber).toBe('TRK-1');
    expect(shipmentCreateCall?.data.status).toBe(ShipmentStatus.IN_TRANSIT);
    expect(shipmentCreateCall?.data.shippedAt).toBeInstanceOf(Date);
    expect(orderUpdateCall?.where.id).toBe('order-1');
    expect(orderUpdateCall?.data.status).toBe(OrderStatus.ENVIADA);
    expect(orderUpdateCall?.data.trackingNumber).toBe('TRK-1');
    expect(orderUpdateCall?.data.carrier).toBe('Servientrega');
    expect(prisma.shipmentSupplyUsage.create).toHaveBeenCalledWith({
      data: {
        shipmentId: 'shipment-1',
        supplyItemId: 'supply-1',
        quantityUsed: expect.anything(),
      },
      select: { id: true },
    });
    expect(prisma.purchaseBatchLine.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'line-1',
        quantityRemaining: { gte: expect.anything() },
        status: 'IN_STOCK',
      },
      data: {
        quantityRemaining: { decrement: expect.anything() },
      },
    });
    expect(prisma.shipmentSupplyUsageAllocation.create).toHaveBeenCalledWith({
      data: {
        shipmentSupplyUsageId: 'usage-1',
        purchaseBatchLineId: 'line-1',
        quantityAllocated: expect.anything(),
      },
    });
    expect(prisma.supplyItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'supply-1',
        stock: { gte: expect.anything() },
      },
      data: { stock: { decrement: expect.anything() } },
    });
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
        shippingBagSupplyItemId: 'supply-1',
        shippingBagQuantityUsed: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.shipment.update).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.supplyItem.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza despacho cuando no hay stock suficiente de bolsas', async () => {
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
    prisma.shipment.update.mockResolvedValue({
      id: 'shipment-1',
      orderId: 'order-1',
      status: ShipmentStatus.SHIPPED,
      trackingNumber: 'TRK-1',
    });
    mockShippingBagStock(1);

    await expect(
      service.updateShipment('order-1', {
        trackingNumber: 'TRK-1',
        status: ShipmentStatus.SHIPPED,
        shippingBagSupplyItemId: 'supply-1',
        shippingBagQuantityUsed: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.shipmentSupplyUsage.create).not.toHaveBeenCalled();
    expect(prisma.purchaseBatchLine.updateMany).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('consume bolsas desde varios lotes en orden FIFO', async () => {
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
    prisma.shipment.update.mockResolvedValue({
      id: 'shipment-1',
      orderId: 'order-1',
      status: ShipmentStatus.SHIPPED,
      trackingNumber: 'TRK-1',
    });
    mockShippingBagStock(1);
    prisma.purchaseBatchLine.findMany.mockResolvedValue([
      {
        id: 'line-old',
        purchaseBatchId: 'batch-old',
        quantityRemaining: 1,
        purchaseBatch: {
          id: 'batch-old',
          supplierId: 'supplier-old',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          variantId: null,
        },
      },
      {
        id: 'line-new',
        purchaseBatchId: 'batch-new',
        quantityRemaining: 5,
        purchaseBatch: {
          id: 'batch-new',
          supplierId: 'supplier-new',
          createdAt: new Date('2026-04-10T00:00:00.000Z'),
          variantId: null,
        },
      },
    ]);
    prisma.purchaseBatchLine.findUnique
      .mockResolvedValueOnce({ quantityRemaining: 0 })
      .mockResolvedValueOnce({ quantityRemaining: 3 });
    prisma.purchaseBatchLine.count
      .mockResolvedValueOnce(0)
      .mockResolvedValue(1);
    prisma.purchaseBatchLine.aggregate
      .mockResolvedValueOnce({ _sum: { quantityRemaining: 0 } })
      .mockResolvedValue({ _sum: { quantityRemaining: 3 } });

    await service.updateShipment('order-1', {
      trackingNumber: 'TRK-1',
      status: ShipmentStatus.SHIPPED,
      shippingBagSupplyItemId: 'supply-1',
      shippingBagQuantityUsed: 3,
    });

    expect(prisma.purchaseBatchLine.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'line-old',
        quantityRemaining: { gte: expect.anything() },
        status: 'IN_STOCK',
      },
      data: {
        quantityRemaining: { decrement: expect.anything() },
      },
    });
    expect(prisma.purchaseBatchLine.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'line-new',
        quantityRemaining: { gte: expect.anything() },
        status: 'IN_STOCK',
      },
      data: {
        quantityRemaining: { decrement: expect.anything() },
      },
    });
    expect(prisma.shipmentSupplyUsageAllocation.create).toHaveBeenCalledTimes(
      2,
    );
    expect(prisma.shipmentSupplyUsageAllocation.create).toHaveBeenNthCalledWith(
      1,
      {
        data: {
          shipmentSupplyUsageId: 'usage-1',
          purchaseBatchLineId: 'line-old',
          quantityAllocated: expect.anything(),
        },
      },
    );
    expect(prisma.shipmentSupplyUsageAllocation.create).toHaveBeenNthCalledWith(
      2,
      {
        data: {
          shipmentSupplyUsageId: 'usage-1',
          purchaseBatchLineId: 'line-new',
          quantityAllocated: expect.anything(),
        },
      },
    );
  });

  it('evita doble descuento si el envio ya tiene consumo registrado', async () => {
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
    prisma.shipment.update.mockResolvedValue({
      id: 'shipment-1',
      orderId: 'order-1',
      status: ShipmentStatus.SHIPPED,
      trackingNumber: 'TRK-1',
    });
    prisma.shipmentSupplyUsage.findFirst.mockResolvedValue({ id: 'usage-1' });

    await expect(
      service.updateShipment('order-1', {
        trackingNumber: 'TRK-1',
        status: ShipmentStatus.SHIPPED,
        shippingBagSupplyItemId: 'supply-1',
        shippingBagQuantityUsed: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.supplyItem.findUnique).not.toHaveBeenCalled();
    expect(prisma.purchaseBatchLine.updateMany).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
