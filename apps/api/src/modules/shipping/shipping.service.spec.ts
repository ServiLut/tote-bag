/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { OrderStatus, ShipmentStatus } from '../../generated/client/client';
import { ReturnProductCondition, ReturnReason } from './dto/process-return.dto';
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
    user: {
      findFirst: jest.fn(),
    },
    shipment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    supplyItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    purchaseBatch: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    purchaseBatchLine: {
      create: jest.fn(),
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
    variant: {
      update: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
      updateMany: jest.fn(),
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
      saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
      saleLegalStatus: 'COMPLETED',
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
    expect(prisma.shipmentSupplyUsage.findFirst).toHaveBeenCalledWith({
      where: {
        shipmentId: 'shipment-1',
        supplyItemId: 'supply-1',
      },
      select: { id: true },
    });
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

  it('normaliza totalAmount y balanceDue como numeros al listar envios', async () => {
    prisma.shipment.findMany.mockResolvedValue([
      {
        id: 'shipment-1',
        orderId: 'order-1',
        trackingNumber: 'TRK-1',
        status: ShipmentStatus.PENDING,
        weight: null,
        dimensions: null,
        provider: {
          id: 'provider-1',
          name: 'Servientrega',
        },
        order: {
          orderNumber: 1001,
          customerEmail: 'cliente@example.com',
          totalAmount: new Decimal('125000.50'),
          createdAt: new Date('2026-05-10T10:00:00.000Z'),
          shippingAddress: { address: 'Calle 1', city: 'Bogota' },
          balanceDue: new Decimal('5000.25'),
          saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
          saleLegalStatus: 'COMPLETED',
          profile: null,
        },
      },
    ]);
    prisma.auditLog.findMany.mockResolvedValue([]);
    shippingSyncService.getOrdersWithoutShipmentRecords.mockResolvedValue([]);

    const result = await service.getShipments();

    expect(result).toHaveLength(1);
    expect(result[0]?.order.totalAmount).toBe(125000.5);
    expect(result[0]?.order.balanceDue).toBe(5000.25);
  });

  it('rechaza providerId inexistente al actualizar un envio', async () => {
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.PAGADA,
      trackingNumber: null,
      carrier: null,
      balanceDue: 0,
      saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
      saleLegalStatus: 'COMPLETED',
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
      saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
      saleLegalStatus: 'COMPLETED',
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

  it('bloquea despacho logistico si la orden tiene saldo pendiente', async () => {
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.EN_PRODUCCION,
      trackingNumber: null,
      carrier: null,
      balanceDue: 5000,
      saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
      saleLegalStatus: 'COMPLETED',
    });
    prisma.shipment.findUnique.mockResolvedValue({
      id: 'shipment-1',
      orderId: 'order-1',
      status: ShipmentStatus.PENDING,
      shippedAt: null,
    });

    await expect(
      service.updateShipment('order-1', {
        trackingNumber: 'TRK-1',
        status: ShipmentStatus.SHIPPED,
        shippingBagSupplyItemId: 'supply-1',
        shippingBagQuantityUsed: 1,
      }),
    ).rejects.toThrow('La orden no puede despacharse con saldo pendiente');

    expect(prisma.shipment.update).not.toHaveBeenCalled();
    expect(prisma.purchaseBatchLine.updateMany).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('bloquea despacho si falta completar documento legal de venta', async () => {
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.PAGADA,
      trackingNumber: null,
      carrier: null,
      balanceDue: 0,
      saleLegalRequirement: 'ELECTRONIC_INVOICE_REQUIRED',
      saleLegalStatus: 'PENDING',
    });

    await expect(
      service.updateShipment('order-1', {
        trackingNumber: 'TRK-1',
        status: ShipmentStatus.SHIPPED,
        shippingBagSupplyItemId: 'supply-1',
        shippingBagQuantityUsed: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.shipment.update).not.toHaveBeenCalled();
    expect(prisma.purchaseBatchLine.updateMany).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('consume bolsas desde varios lotes en orden FIFO', async () => {
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.PAGADA,
      trackingNumber: null,
      carrier: null,
      balanceDue: 0,
      saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
      saleLegalStatus: 'COMPLETED',
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
      saleLegalRequirement: 'INTERNAL_DOCUMENT_ALLOWED',
      saleLegalStatus: 'COMPLETED',
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

  it('elimina un envio pendiente y limpia guia/transportadora de la orden', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 1001,
      status: OrderStatus.PAGADA,
      trackingNumber: 'TRK-1',
      carrier: 'Servientrega',
      shipment: {
        id: 'shipment-1',
        status: ShipmentStatus.PENDING,
        trackingNumber: 'TRK-1',
        providerId: 'provider-1',
      },
    });
    prisma.shipmentSupplyUsage.findFirst.mockResolvedValue(null);
    prisma.shipment.delete.mockResolvedValue({
      id: 'shipment-1',
      orderId: 'order-1',
      status: ShipmentStatus.PENDING,
      trackingNumber: 'TRK-1',
      providerId: 'provider-1',
    });
    prisma.order.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    await service.deleteShipment('order-1', 'admin-1');

    expect(prisma.shipment.delete).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      select: {
        id: true,
        orderId: true,
        status: true,
        trackingNumber: true,
        providerId: true,
      },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        trackingNumber: null,
        carrier: null,
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DELETE_SHIPMENT',
        entity: 'Shipment',
        entityId: 'shipment-1',
        userId: 'admin-1',
      }) as unknown,
    });
  });

  it('rechaza eliminar un envio despachado', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 1001,
      status: OrderStatus.ENVIADA,
      trackingNumber: 'TRK-1',
      carrier: 'Servientrega',
      shipment: {
        id: 'shipment-1',
        status: ShipmentStatus.SHIPPED,
        trackingNumber: 'TRK-1',
        providerId: 'provider-1',
      },
    });

    await expect(service.deleteShipment('order-1', 'admin-1')).rejects.toThrow(
      'Solo puedes eliminar envios pendientes o listos para etiqueta',
    );

    expect(prisma.shipment.delete).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('reingresa devoluciones con movimientos inmutables y saldo resultante', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 1001,
      status: OrderStatus.ENTREGADA,
      items: [
        {
          productId: 'product-1',
          product: { name: 'Tote Bag' },
          variantId: 'variant-1',
          sku: 'TOT-001',
          quantity: 3,
          pricingJson: {
            inventoryConsumption: {
              reductions: [
                {
                  batchId: 'batch-old-1',
                  supplierId: 'supplier-1',
                  quantity: 1,
                  unitCost: 12000,
                },
                {
                  batchId: 'batch-old-2',
                  supplierId: 'supplier-1',
                  quantity: 2,
                  unitCost: 13000,
                },
              ],
            },
          },
        },
      ],
      shipment: {
        id: 'shipment-1',
        status: ShipmentStatus.RETURNED,
      },
    });
    prisma.purchaseBatch.create
      .mockResolvedValueOnce({ id: 'return-batch-1' })
      .mockResolvedValueOnce({ id: 'return-batch-2' });
    prisma.purchaseBatchLine.create
      .mockResolvedValueOnce({ id: 'return-line-1' })
      .mockResolvedValueOnce({ id: 'return-line-2' });
    prisma.variant.update.mockResolvedValue({ stock: 12 });
    prisma.shipment.update.mockResolvedValue({
      id: 'shipment-1',
      status: ShipmentStatus.RETURNED,
    });
    prisma.order.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.inventoryMovement.create.mockResolvedValue({});

    await service.processReturn(
      'order-1',
      {
        productCondition: ReturnProductCondition.PERFECT,
        restock: true,
        reason: ReturnReason.CUSTOMER_REJECTED,
      },
      'admin-1',
    );

    expect(prisma.variant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: {
        stock: { increment: 3 },
      },
    });
    expect(prisma.inventoryMovement.updateMany).not.toHaveBeenCalled();
    expect(prisma.inventoryMovement.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        reason: 'RETURN_TO_STOCK',
        quantity: 1,
        balanceAfter: 10,
        purchaseBatchId: 'return-batch-1',
        purchaseBatchLineId: 'return-line-1',
        orderId: 'order-1',
      }) as unknown,
    });
    expect(prisma.inventoryMovement.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        reason: 'RETURN_TO_STOCK',
        quantity: 2,
        balanceAfter: 12,
        purchaseBatchId: 'return-batch-2',
        purchaseBatchLineId: 'return-line-2',
        orderId: 'order-1',
      }) as unknown,
    });
  });
});
