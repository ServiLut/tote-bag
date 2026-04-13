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
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
    product: {
      findMany: jest.fn(),
    },
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

  it('solo devuelve productos con lotes activos en inventario detallado', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Tote Bag Crudo',
        slug: 'tote-bag-crudo',
        images: [{ url: 'https://example.com/crudo.jpg' }],
        purchaseBatches: [
          {
            id: 'batch-1',
            quantityRemaining: 60,
            unitCost: 15411,
            supplier: { id: 'supplier-1', name: 'Proveedor A' },
          },
        ],
      },
    ]);

    const result = await service.getDetailedInventory();

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        purchaseBatches: {
          some: {
            status: 'IN_STOCK',
            quantityRemaining: { gt: 0 },
            variantId: { not: null },
          },
        },
      },
      include: {
        purchaseBatches: {
          where: {
            status: 'IN_STOCK',
            quantityRemaining: { gt: 0 },
            variantId: { not: null },
          },
          include: { supplier: true },
          orderBy: { createdAt: 'asc' },
        },
        images: { take: 1 },
      },
    });
    expect(result).toEqual([
      {
        id: 'product-1',
        name: 'Tote Bag Crudo',
        slug: 'tote-bag-crudo',
        image: 'https://example.com/crudo.jpg',
        totalStock: 60,
        totalValuation: 924660,
        weightedAvgCost: 15411,
        batches: [
          {
            id: 'batch-1',
            quantityRemaining: 60,
            unitCost: 15411,
            supplier: { id: 'supplier-1', name: 'Proveedor A' },
          },
        ],
      },
    ]);
  });

  it('actualiza un lote intacto y ajusta stock y saldo del proveedor', async () => {
    tx.purchaseBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      supplierId: 'supplier-1',
      productId: 'product-1',
      variantId: 'variant-1',
      quantityReceived: 10,
      quantityRemaining: 10,
      unitCost: 5000,
      totalCost: 50000,
      status: 'IN_STOCK',
      invoices: [],
    });
    tx.supplier.findUnique.mockResolvedValue({ id: 'supplier-2' });
    tx.variant.findUnique.mockResolvedValue({
      id: 'variant-2',
      productId: 'product-2',
    });
    tx.opexCategory.findUnique.mockResolvedValue({ id: 'opex-1' });
    tx.purchaseBatch.update.mockResolvedValue({
      id: 'batch-1',
      supplier: { id: 'supplier-2', name: 'Proveedor 2' },
      product: { id: 'product-2', name: 'Correa' },
      variant: { id: 'variant-2', sku: 'SKU-2', color: 'Negro' },
    });
    tx.variant.update.mockResolvedValue({});
    tx.supplier.update.mockResolvedValue({});
    tx.financialTransaction.create.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    await service.updatePurchaseBatch('batch-1', {
      supplierId: 'supplier-2',
      productId: 'product-2',
      variantId: 'variant-2',
      quantityReceived: 8,
      unitCost: 6000,
      status: 'RECIBIDO',
      purchaseDate: '2026-04-09',
      userId: 'admin-1',
    });

    expect(tx.variant.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'variant-1' },
      data: {
        stock: { increment: -10 },
      },
    });
    expect(tx.variant.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'variant-2' },
      data: {
        stock: { increment: 8 },
      },
    });
    expect(tx.supplier.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'supplier-1' },
      data: {
        balance: { decrement: 50000 },
      },
    });
    expect(tx.supplier.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'supplier-2' },
      data: {
        balance: { increment: 48000 },
      },
    });
    expect(tx.financialTransaction.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        type: 'INCOME',
        category: 'PURCHASE',
        amount: 50000,
      }) as unknown,
    });
    expect(tx.financialTransaction.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        type: 'EXPENSE',
        category: 'PURCHASE',
        amount: 48000,
      }) as unknown,
    });
  });

  it('borra un lote pendiente sin tocar stock ni crear ajuste financiero', async () => {
    tx.purchaseBatch.findUnique.mockResolvedValue({
      id: 'batch-2',
      supplierId: 'supplier-1',
      productId: 'product-1',
      variantId: 'variant-1',
      quantityReceived: 12,
      quantityRemaining: 0,
      unitCost: 2000,
      totalCost: 24000,
      status: 'PENDING',
      invoices: [],
    });
    tx.purchaseBatch.delete.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    await service.deletePurchaseBatch('batch-2', 'admin-1');

    expect(tx.variant.update).not.toHaveBeenCalled();
    expect(tx.supplier.update).not.toHaveBeenCalled();
    expect(tx.financialTransaction.create).not.toHaveBeenCalled();
    expect(tx.purchaseBatch.delete).toHaveBeenCalledWith({
      where: { id: 'batch-2' },
    });
  });

  it('rechaza editar un lote si el proveedor nuevo no existe', async () => {
    tx.purchaseBatch.findUnique.mockResolvedValue({
      id: 'batch-3',
      supplierId: 'supplier-1',
      productId: 'product-1',
      variantId: 'variant-1',
      quantityReceived: 10,
      quantityRemaining: 10,
      unitCost: 3000,
      totalCost: 30000,
      status: 'IN_STOCK',
      invoices: [],
    });
    tx.supplier.findUnique.mockResolvedValue(null);

    await expect(
      service.updatePurchaseBatch('batch-3', {
        supplierId: 'supplier-missing',
        productId: 'product-1',
        variantId: 'variant-1',
        quantityReceived: 10,
        unitCost: 3000,
        status: 'RECIBIDO',
        purchaseDate: '2026-04-09',
        userId: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.variant.update).not.toHaveBeenCalled();
    expect(tx.purchaseBatch.update).not.toHaveBeenCalled();
  });
});
