import { ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  OrderStatus,
  PurchaseDocumentType,
  SaleLegalDocumentType,
  SaleLegalRequirement,
  SaleLegalStatus,
} from '../../generated/client/enums';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    orderPayment: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    orderItem: {
      update: jest.fn(),
    },
    variant: {
      findUnique: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    order: {
      update: jest.fn(),
    },
  };
  const pricingService = {};
  const inventoryService = {
    releaseCommittedStock: jest.fn(),
    reduceStockFIFO: jest.fn(),
  };
  const shippingSyncService = {
    ensureShipmentForOrder: jest.fn(),
  };
  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    tx.order.update.mockResolvedValue({
      id: 'order-1',
      amountPaid: 0,
      balanceDue: 0,
      items: [],
      payments: [],
    });
    tx.orderPayment.create.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      amount: 0,
      proofUrl: 'https://cdn.example.com/support.jpg',
    });
    tx.orderPayment.aggregate.mockResolvedValue({
      _sum: {
        amount: 0,
      },
    });
    tx.variant.findUnique.mockResolvedValue({
      id: 'variant-1',
      sku: 'SKU-1',
      productId: 'product-1',
      imageUrl: null,
      salePrice: 1000,
      minPrice: 0,
      comparePrice: null,
      costPrice: 100,
      taxRate: 0.19,
      size: 'M',
      isActive: true,
    });
    inventoryService.reduceStockFIFO.mockResolvedValue({
      totalCOGS: 100,
      reductions: [
        {
          purchaseBatchLineId: 'line-1',
          batchId: 'batch-1',
          supplierId: 'supplier-1',
          quantity: 1,
          unitCost: 100,
          documentType: PurchaseDocumentType.DELIVERY_NOTE,
        },
      ],
    });
    shippingSyncService.ensureShipmentForOrder.mockResolvedValue({});
    service = new OrdersService(
      prisma as never,
      pricingService as never,
      inventoryService as never,
      shippingSyncService as never,
    );
  });

  it('bloquea cierre operativo si el lote exige factura electronica pendiente', async () => {
    tx.order.findFirst.mockResolvedValue({
      status: OrderStatus.PAGADA,
      balanceDue: 0,
      saleLegalRequirement: SaleLegalRequirement.ELECTRONIC_INVOICE_REQUIRED,
      saleLegalStatus: SaleLegalStatus.PENDING,
      saleLegalDocumentType: null,
      saleLegalDocumentReference: null,
      items: [],
    });

    await expect(
      service.update('order-1', { status: OrderStatus.READY_FOR_DISPATCH }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(shippingSyncService.ensureShipmentForOrder).not.toHaveBeenCalled();
  });

  it('permite cerrar lote de remision con remision interna registrada', async () => {
    tx.order.findFirst.mockResolvedValue({
      status: OrderStatus.PAGADA,
      balanceDue: 0,
      saleLegalRequirement: SaleLegalRequirement.INTERNAL_DOCUMENT_ALLOWED,
      saleLegalStatus: SaleLegalStatus.PENDING,
      saleLegalDocumentType: null,
      saleLegalDocumentReference: null,
      items: [],
    });

    await service.update('order-1', {
      status: OrderStatus.READY_FOR_DISPATCH,
      saleLegalDocumentType: SaleLegalDocumentType.INTERNAL_DELIVERY_NOTE,
      saleLegalDocumentReference: 'REM-001',
    });

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: OrderStatus.READY_FOR_DISPATCH,
        saleLegalDocumentType: SaleLegalDocumentType.INTERNAL_DELIVERY_NOTE,
        saleLegalDocumentReference: 'REM-001',
        saleLegalStatus: SaleLegalStatus.COMPLETED,
        saleLegalCompletedAt: expect.any(Date) as unknown,
      }) as unknown,
    });
    expect(shippingSyncService.ensureShipmentForOrder).toHaveBeenCalledWith(
      'order-1',
      tx,
    );
  });

  it('rechaza remision interna cuando el lote usado proviene de factura', async () => {
    tx.order.findFirst.mockResolvedValue({
      status: OrderStatus.PAGADA,
      balanceDue: 0,
      saleLegalRequirement: SaleLegalRequirement.ELECTRONIC_INVOICE_REQUIRED,
      saleLegalStatus: SaleLegalStatus.PENDING,
      saleLegalDocumentType: null,
      saleLegalDocumentReference: null,
      items: [],
    });

    await expect(
      service.update('order-1', {
        saleLegalDocumentType: SaleLegalDocumentType.INTERNAL_DELIVERY_NOTE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('traza la obligacion legal hasta la linea real de lote consumida', async () => {
    tx.order.findFirst.mockResolvedValue({
      status: OrderStatus.PAGADA,
      balanceDue: 0,
      saleLegalRequirement: SaleLegalRequirement.PENDING_STOCK_ASSIGNMENT,
      saleLegalStatus: SaleLegalStatus.PENDING,
      saleLegalDocumentType: null,
      saleLegalDocumentReference: null,
      items: [
        {
          id: 'item-1',
          variantId: 'variant-1',
          sku: 'SKU-1',
          quantity: 2,
          pricingJson: {
            inventoryConsumption: {
              totalCOGS: 24000,
              reductions: [
                {
                  purchaseBatchLineId: 'line-1',
                  batchId: 'batch-1',
                  supplierId: 'supplier-1',
                  quantity: 2,
                  unitCost: 12000,
                  documentType: PurchaseDocumentType.INVOICE,
                },
              ],
            },
          },
        },
      ],
    });

    await service.update('order-1', {
      saleLegalDocumentType: SaleLegalDocumentType.ELECTRONIC_INVOICE,
      saleLegalDocumentReference: 'FE-001',
    });

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        saleLegalRequirement: SaleLegalRequirement.ELECTRONIC_INVOICE_REQUIRED,
        saleLegalStatus: SaleLegalStatus.COMPLETED,
        saleLegalDocumentType: SaleLegalDocumentType.ELECTRONIC_INVOICE,
        saleLegalDocumentReference: 'FE-001',
        saleLegalTrace: expect.objectContaining({
          requirement: SaleLegalRequirement.ELECTRONIC_INVOICE_REQUIRED,
          lots: [
            expect.objectContaining({
              orderItemId: 'item-1',
              sku: 'SKU-1',
              purchaseBatchLineId: 'line-1',
              batchId: 'batch-1',
              documentType: PurchaseDocumentType.INVOICE,
            }),
          ],
        }) as unknown,
      }) as unknown,
    });
  });

  it('registra abono de 70%, exige soporte y pasa la orden a produccion', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PENDIENTE_PAGO,
      totalAmount: 1000,
      amountPaid: 0,
      balanceDue: 1000,
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: 'variant-1',
          sku: 'SKU-1',
          quantity: 1,
          pricingJson: {
            inventoryCommitment: {
              variantId: 'variant-1',
              quantity: 1,
              committedAt: '2026-04-20T00:00:00.000Z',
            },
          },
        },
      ],
    });
    tx.orderPayment.create.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      amount: 700,
      proofUrl: 'https://cdn.example.com/support.jpg',
    });
    tx.order.update.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.EN_PRODUCCION,
      amountPaid: 700,
      balanceDue: 300,
      items: [],
      payments: [],
    });

    const result = await service.registerOrderPayment(
      'order-1',
      {
        amount: '700',
        paymentDate: '2026-04-20T12:00:00.000Z',
        proofUrl: 'https://cdn.example.com/support.jpg',
      },
      'user-1',
    );

    expect(tx.orderPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        amount: expect.any(Object) as unknown,
        proofUrl: 'https://cdn.example.com/support.jpg',
      }) as unknown,
    });
    expect(inventoryService.releaseCommittedStock).toHaveBeenCalledWith(
      'variant-1',
      1,
      'user-1',
      'order-1',
      tx,
    );
    expect(inventoryService.reduceStockFIFO).toHaveBeenCalledWith(
      'variant-1',
      1,
      'user-1',
      tx,
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        amountPaid: expect.any(Object) as unknown,
        balanceDue: expect.any(Object) as unknown,
        status: OrderStatus.EN_PRODUCCION,
        saleLegalRequirement: SaleLegalRequirement.INTERNAL_DOCUMENT_ALLOWED,
        saleLegalStatus: SaleLegalStatus.PENDING,
        saleLegalTrace: expect.objectContaining({
          requirement: SaleLegalRequirement.INTERNAL_DOCUMENT_ALLOWED,
        }) as unknown,
      }) as unknown,
      include: expect.any(Object) as unknown,
    });
    expect(shippingSyncService.ensureShipmentForOrder).toHaveBeenCalledWith(
      'order-1',
      tx,
    );
    expect(result.payment).toEqual(
      expect.objectContaining({
        id: 'payment-1',
        amount: 700,
        proofUrl: 'https://cdn.example.com/support.jpg',
      }),
    );
  });

  it('rechaza pagos manuales sin soporte visual', async () => {
    await expect(
      service.registerOrderPayment('order-1', {
        amount: '700',
        paymentDate: '2026-04-20T12:00:00.000Z',
        proofUrl: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.order.findFirst).not.toHaveBeenCalled();
    expect(tx.orderPayment.create).not.toHaveBeenCalled();
  });

  it('rechaza sobrepagos y no altera la orden', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PENDING_DEPOSIT,
      totalAmount: 1000,
      amountPaid: 400,
      balanceDue: 600,
      items: [],
    });

    await expect(
      service.registerOrderPayment('order-1', {
        amount: '700',
        paymentDate: '2026-04-20T12:00:00.000Z',
        proofUrl: 'https://cdn.example.com/support.jpg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.orderPayment.create).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('confirma pago por integracion con soporte de transaccion', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PENDIENTE_PAGO,
      totalAmount: 1000,
      amountPaid: 0,
      balanceDue: 1000,
      paymentReceiptUrl: null,
      items: [],
    });
    tx.order.update.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PAGADA,
      amountPaid: 1000,
      balanceDue: 0,
    });

    await service.confirmPendingOrderPayment(
      'order-1',
      undefined,
      tx as never,
      'https://wompi.com/transactions/txn-1',
    );

    expect(tx.orderPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        amount: expect.any(Object) as unknown,
        proofUrl: 'https://wompi.com/transactions/txn-1',
      }) as unknown,
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: OrderStatus.PAGADA,
        amountPaid: expect.any(Object) as unknown,
        balanceDue: expect.any(Object) as unknown,
      }) as unknown,
    });
  });

  it('rechaza confirmacion por integracion sin soporte de pago', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PENDIENTE_PAGO,
      totalAmount: 1000,
      amountPaid: 0,
      balanceDue: 1000,
      paymentReceiptUrl: null,
      items: [],
    });

    await expect(
      service.confirmPendingOrderPayment('order-1', undefined, tx as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.orderPayment.create).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('registra saldo final y cambia de produccion a pagada sin descontar stock de nuevo', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.EN_PRODUCCION,
      totalAmount: 1000,
      amountPaid: 700,
      balanceDue: 300,
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: 'variant-1',
          sku: 'SKU-1',
          quantity: 1,
          pricingJson: {
            inventoryConsumption: {
              totalCOGS: 100,
              reductions: [
                {
                  purchaseBatchLineId: 'line-1',
                  batchId: 'batch-1',
                  supplierId: 'supplier-1',
                  quantity: 1,
                  unitCost: 100,
                  documentType: PurchaseDocumentType.INVOICE,
                },
              ],
            },
          },
        },
      ],
    });
    tx.orderPayment.create.mockResolvedValue({
      id: 'payment-2',
      orderId: 'order-1',
      amount: 300,
      proofUrl: 'https://cdn.example.com/final-support.jpg',
    });
    tx.order.update.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PAGADA,
      amountPaid: 1000,
      balanceDue: 0,
      items: [],
      payments: [],
    });

    await service.registerOrderPayment('order-1', {
      amount: '300',
      paymentDate: '2026-04-20T12:00:00.000Z',
      proofUrl: 'https://cdn.example.com/final-support.jpg',
    });

    expect(inventoryService.reduceStockFIFO).not.toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        amountPaid: expect.any(Object) as unknown,
        balanceDue: expect.any(Object) as unknown,
        status: OrderStatus.PAGADA,
        saleLegalRequirement: SaleLegalRequirement.ELECTRONIC_INVOICE_REQUIRED,
        saleLegalStatus: SaleLegalStatus.PENDING,
      }) as unknown,
      include: expect.any(Object) as unknown,
    });
  });
});
