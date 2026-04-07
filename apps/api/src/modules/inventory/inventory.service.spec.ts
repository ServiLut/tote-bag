import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  type PurchaseBatchCreateInput = {
    productId: string;
    variantId: string;
    supplierId: string;
    quantityReceived: number;
  };

  const tx = {
    opexCategory: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    variant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    purchaseBatch: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    supplier: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    financialTransaction: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(),
    purchaseBatch: {
      findMany: jest.fn(),
    },
  };

  let service: InventoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InventoryService(prisma as never);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
  });

  it('recalcula el total financiero desde los items y no confia en totalCost del cliente', async () => {
    tx.opexCategory.findUnique.mockResolvedValue({
      id: 'opex-1',
    });
    tx.product.findUnique
      .mockResolvedValueOnce({ id: 'product-1', name: 'Tela base' })
      .mockResolvedValueOnce({ id: 'product-2', name: 'Correa' });
    tx.variant.findUnique
      .mockResolvedValueOnce({ id: 'variant-1', productId: 'product-1' })
      .mockResolvedValueOnce({ id: 'variant-2', productId: 'product-2' });
    tx.purchaseBatch.create.mockImplementation(
      ({ data }: { data: PurchaseBatchCreateInput }) =>
        Promise.resolve({
          id: `batch-${data.variantId}`,
          ...data,
          product: { id: data.productId, name: data.productId },
          supplier: { id: data.supplierId, name: 'Proveedor demo' },
          variant: {
            id: data.variantId,
            sku: `SKU-${data.variantId}`,
            color: 'Natural',
          },
        }),
    );
    tx.supplier.findUnique.mockResolvedValue({
      id: 'supplier-1',
      name: 'Proveedor demo',
    });
    tx.financialTransaction.create.mockResolvedValue({});
    tx.supplier.update.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    await service.createPurchaseBatch({
      supplierId: 'supplier-1',
      totalCost: 1,
      status: 'RECIBIDO',
      purchaseDate: '2026-03-25',
      userId: 'admin-1',
      items: [
        {
          nombre: 'Tela base',
          productId: 'product-1',
          variantId: 'variant-1',
          cantidad: 2,
          costoUnitario: 5000,
        },
        {
          nombre: 'Correa',
          productId: 'product-2',
          variantId: 'variant-2',
          cantidad: 3,
          costoUnitario: 4000,
        },
      ],
    });

    const financialTransactionCalls = tx.financialTransaction.create.mock
      .calls as Array<[{ data: { amount: number } }]>;
    const supplierUpdateCalls = tx.supplier.update.mock.calls as Array<
      [{ data: { balance: { increment: number } } }]
    >;
    const auditLogCalls = tx.auditLog.create.mock.calls as Array<
      [{ data: { payload: { totalCost: number } } }]
    >;

    const financialTransactionCall = financialTransactionCalls[0]?.[0];
    const supplierUpdateCall = supplierUpdateCalls[0]?.[0];
    const auditLogCall = auditLogCalls[0]?.[0];

    expect(financialTransactionCall?.data.amount).toBe(22000);
    expect(supplierUpdateCall?.data.balance.increment).toBe(22000);
    expect(auditLogCall?.data.payload.totalCost).toBe(22000);
  });

  it('rechaza crear lotes sin items', async () => {
    await expect(
      service.createPurchaseBatch({
        supplierId: 'supplier-1',
        totalCost: 0,
        status: 'RECIBIDO',
        purchaseDate: '2026-03-25',
        userId: 'admin-1',
        items: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
