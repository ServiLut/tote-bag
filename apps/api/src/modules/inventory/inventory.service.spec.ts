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
    purchaseBatchLine: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    supplyItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    supplier: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    financialTransaction: {
      create: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
    },
    nonCommercialInventoryOutput: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const prisma = {
    $transaction: jest.fn(),
    product: {
      findMany: jest.fn(),
    },
    purchaseBatch: {
      findMany: jest.fn(),
    },
    purchaseBatchLine: {
      findMany: jest.fn(),
    },
    supplyItem: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    nonCommercialInventoryOutput: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const managerApprovalsService = {
    requireApproval: jest.fn(),
  };

  let service: InventoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    managerApprovalsService.requireApproval.mockResolvedValue({
      id: 'approval-1',
    });
    tx.variant.update.mockResolvedValue({ id: 'variant-1', stock: 100 });
    tx.supplyItem.update.mockResolvedValue({ id: 'supply-1', stock: 100 });
    tx.purchaseBatchLine.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'line-1', ...data }),
    );
    tx.inventoryMovement.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'movement-1', ...data, createdAt: new Date() }),
    );
    service = new InventoryService(
      prisma as never,
      managerApprovalsService as never,
    );
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
  });

  function mockPurchaseBatchCreate() {
    tx.purchaseBatch.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'batch-1',
          ...data,
          product: null,
          supplier: { id: data.supplierId, name: 'Proveedor demo' },
          variant: null,
          lines: [],
        }),
    );
    tx.purchaseBatch.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'batch-1',
          ...data,
          product: null,
          supplier: { id: 'supplier-1', name: 'Proveedor demo' },
          variant: null,
          lines: [],
        }),
    );
  }

  function mockCreateBatchBase() {
    tx.opexCategory.findUnique.mockResolvedValue({ id: 'opex-1' });
    tx.supplier.findUnique.mockResolvedValue({
      id: 'supplier-1',
      name: 'Proveedor demo',
    });
    tx.financialTransaction.create.mockResolvedValue({});
    tx.supplier.update.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});
    mockPurchaseBatchCreate();
  }

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
      documentType: 'INVOICE',
      supportUrl: 'private://support-documents/purchase-batches/test.pdf',
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
        documentType: 'INVOICE',
        supportUrl: 'private://support-documents/purchase-batches/test.pdf',
        items: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloquea ingreso de stock sin soporte del proveedor', async () => {
    await expect(
      service.createPurchaseBatch({
        supplierId: 'supplier-1',
        totalCost: 15000,
        status: 'RECIBIDO',
        purchaseDate: '2026-03-25',
        userId: 'admin-1',
        documentType: 'INVOICE',
        supportUrl: '   ',
        items: [
          {
            nombre: 'Tela base',
            productId: 'product-1',
            variantId: 'variant-1',
            cantidad: 1,
            costoUnitario: 15000,
          },
        ],
      }),
    ).rejects.toThrow(
      'Debes adjuntar soporte PDF/JPG del proveedor para registrar la recepcion.',
    );
  });

  it('crea recepcion de producto vendible y solo actualiza stock de variante', async () => {
    mockCreateBatchBase();
    tx.variant.findUnique.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
    });
    tx.product.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Bolso catalogo',
    });

    await service.createPurchaseBatch({
      supplierId: 'supplier-1',
      totalCost: 5000,
      status: 'RECIBIDO',
      purchaseDate: '2026-04-14',
      userId: 'admin-1',
      documentType: 'INVOICE',
      supportUrl: 'private://support-documents/purchase-batches/test.pdf',
      items: [
        {
          itemType: 'VARIANT',
          productId: 'product-1',
          variantId: 'variant-1',
          cantidad: 5,
          unitOfMeasure: 'und',
          costoUnitario: 1000,
        },
      ],
    });

    expect(tx.purchaseBatchLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemType: 'VARIANT',
        variantId: 'variant-1',
        supplyItemId: null,
        quantity: 5,
        quantityRemaining: 5,
        unitOfMeasure: 'und',
      }) as unknown,
    });
    expect(tx.variant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: {
        stock: { increment: 5 },
        costPrice: 1000,
      },
    });
    expect(tx.supplyItem.update).not.toHaveBeenCalled();
  });

  it('crea recepcion de Supply Bolsa de envio sin tocar stock vendible', async () => {
    mockCreateBatchBase();
    tx.supplyItem.findUnique.mockResolvedValue({
      id: 'supply-1',
      name: 'Bolsa de envio',
      unitOfMeasure: 'und',
    });

    await service.createPurchaseBatch({
      supplierId: 'supplier-1',
      totalCost: 2400,
      status: 'RECIBIDO',
      purchaseDate: '2026-04-14',
      userId: 'admin-1',
      documentType: 'DELIVERY_NOTE',
      supportUrl: 'private://support-documents/purchase-batches/test.jpg',
      items: [
        {
          itemType: 'SUPPLY',
          supplyItemId: 'supply-1',
          cantidad: 12,
          unitOfMeasure: 'und',
          costoUnitario: 200,
        },
      ],
    });

    expect(tx.purchaseBatchLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemType: 'SUPPLY',
        variantId: null,
        supplyItemId: 'supply-1',
        itemName: 'Bolsa de envio',
        quantity: 12,
        unitOfMeasure: 'und',
      }) as unknown,
    });
    expect(tx.supplyItem.update).toHaveBeenCalledWith({
      where: { id: 'supply-1' },
      data: {
        stock: { increment: 12 },
        cost: 200,
      },
    });
    expect(tx.variant.update).not.toHaveBeenCalled();
  });

  it('crea recepcion de Tool descriptiva sin exigir variantId', async () => {
    mockCreateBatchBase();

    await service.createPurchaseBatch({
      supplierId: 'supplier-1',
      totalCost: 45000,
      status: 'RECIBIDO',
      purchaseDate: '2026-04-14',
      userId: 'admin-1',
      documentType: 'INVOICE',
      supportUrl: 'private://support-documents/purchase-batches/test.pdf',
      items: [
        {
          itemType: 'TOOL',
          itemName: 'Tijeras industriales',
          cantidad: 1,
          unitOfMeasure: 'und',
          costoUnitario: 45000,
        },
      ],
    });

    expect(tx.purchaseBatchLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemType: 'TOOL',
        variantId: null,
        supplyItemId: null,
        itemName: 'Tijeras industriales',
        quantity: 1,
      }) as unknown,
    });
    expect(tx.variant.update).not.toHaveBeenCalled();
    expect(tx.supplyItem.update).not.toHaveBeenCalled();
  });

  it('crea recepcion de Other descriptiva sin exigir variantId', async () => {
    mockCreateBatchBase();

    await service.createPurchaseBatch({
      supplierId: 'supplier-1',
      totalCost: 15000,
      status: 'RECIBIDO',
      purchaseDate: '2026-04-14',
      userId: 'admin-1',
      documentType: 'DELIVERY_NOTE',
      supportUrl: 'private://support-documents/purchase-batches/test.jpg',
      items: [
        {
          itemType: 'OTHER',
          description: 'Elemento operativo no catalogado',
          cantidad: 3,
          unitOfMeasure: 'und',
          costoUnitario: 5000,
        },
      ],
    });

    expect(tx.purchaseBatchLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemType: 'OTHER',
        variantId: null,
        supplyItemId: null,
        itemName: null,
        description: 'Elemento operativo no catalogado',
        quantity: 3,
      }) as unknown,
    });
    expect(tx.variant.update).not.toHaveBeenCalled();
    expect(tx.supplyItem.update).not.toHaveBeenCalled();
  });

  it('crea recepcion mixta y aplica stock solo donde corresponde', async () => {
    mockCreateBatchBase();
    tx.variant.findUnique.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
    });
    tx.product.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Bolso catalogo',
    });
    tx.supplyItem.findUnique.mockResolvedValue({
      id: 'supply-1',
      name: 'Bolsa de envio',
      unitOfMeasure: 'und',
    });

    await service.createPurchaseBatch({
      supplierId: 'supplier-1',
      totalCost: 67500,
      status: 'RECIBIDO',
      purchaseDate: '2026-04-14',
      userId: 'admin-1',
      documentType: 'INVOICE',
      supportUrl: 'private://support-documents/purchase-batches/test.pdf',
      items: [
        {
          itemType: 'VARIANT',
          productId: 'product-1',
          variantId: 'variant-1',
          cantidad: 2,
          unitOfMeasure: 'und',
          costoUnitario: 1000,
        },
        {
          itemType: 'SUPPLY',
          supplyItemId: 'supply-1',
          cantidad: 10,
          unitOfMeasure: 'und',
          costoUnitario: 250,
        },
        {
          itemType: 'TOOL',
          itemName: 'Regla metalica',
          cantidad: 1,
          unitOfMeasure: 'und',
          costoUnitario: 18000,
        },
        {
          itemType: 'OTHER',
          itemName: 'Ajuste operativo',
          cantidad: 3,
          unitOfMeasure: 'und',
          costoUnitario: 15000,
        },
      ],
    });

    expect(tx.purchaseBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: null,
          variantId: null,
          quantityReceived: 0,
        }) as unknown,
      }),
    );
    expect(tx.purchaseBatchLine.create).toHaveBeenCalledTimes(4);
    expect(tx.purchaseBatchLine.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        itemType: 'VARIANT',
        variantId: 'variant-1',
        supplyItemId: null,
      }) as unknown,
    });
    expect(tx.purchaseBatchLine.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        itemType: 'SUPPLY',
        variantId: null,
        supplyItemId: 'supply-1',
      }) as unknown,
    });
    expect(tx.purchaseBatchLine.create).toHaveBeenNthCalledWith(3, {
      data: expect.objectContaining({
        itemType: 'TOOL',
        variantId: null,
        supplyItemId: null,
      }) as unknown,
    });
    expect(tx.purchaseBatchLine.create).toHaveBeenNthCalledWith(4, {
      data: expect.objectContaining({
        itemType: 'OTHER',
        variantId: null,
        supplyItemId: null,
      }) as unknown,
    });
    expect(tx.variant.update).toHaveBeenCalledTimes(1);
    expect(tx.variant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: {
        stock: { increment: 2 },
        costPrice: 1000,
      },
    });
    expect(tx.supplyItem.update).toHaveBeenCalledTimes(1);
    expect(tx.supplyItem.update).toHaveBeenCalledWith({
      where: { id: 'supply-1' },
      data: {
        stock: { increment: 10 },
        cost: 250,
      },
    });
  });

  it('solo devuelve productos con lotes activos en inventario detallado', async () => {
    prisma.purchaseBatchLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        purchaseBatchId: 'batch-1',
        quantity: 60,
        quantityRemaining: 60,
        unitCost: 15411,
        lineTotal: 924660,
        status: 'IN_STOCK',
        variant: {
          id: 'variant-1',
          product: {
            id: 'product-1',
            name: 'Tote Bag Crudo',
            slug: 'tote-bag-crudo',
            images: [{ url: 'https://example.com/crudo.jpg' }],
          },
        },
        purchaseBatch: {
          id: 'batch-1',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          supplier: { id: 'supplier-1', name: 'Proveedor A' },
        },
      },
    ]);

    const result = await service.getDetailedInventory();

    expect(prisma.purchaseBatchLine.findMany).toHaveBeenCalledWith({
      where: {
        itemType: 'VARIANT',
        variantId: { not: null },
        status: 'IN_STOCK',
        quantityRemaining: { gt: 0 },
        purchaseBatch: {
          status: 'IN_STOCK',
          deletedAt: null,
        },
      },
      include: {
        variant: {
          include: {
            product: {
              include: {
                images: {
                  take: 1,
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
        purchaseBatch: {
          include: { supplier: true },
        },
      },
      orderBy: [{ purchaseBatch: { createdAt: 'asc' } }, { createdAt: 'asc' }],
    });
    expect(result).toEqual([
      {
        id: 'product-1',
        name: 'Tote Bag Crudo',
        slug: 'tote-bag-crudo',
        image: 'https://example.com/crudo.jpg',
        totalStock: 60,
        stockPhysical: 60,
        stockCommitted: 0,
        stockAvailable: 60,
        totalValuation: 924660,
        weightedAvgCost: 15411,
        batches: [
          {
            id: 'batch-1',
            lineId: 'line-1',
            quantityReceived: 60,
            quantityRemaining: 60,
            unitCost: 15411,
            totalCost: 924660,
            status: 'IN_STOCK',
            createdAt: new Date('2026-04-01T00:00:00.000Z'),
            supplier: { id: 'supplier-1', name: 'Proveedor A' },
          },
        ],
      },
    ]);
  });

  it('incluye el origen documental del lote en la reduccion FIFO', async () => {
    tx.purchaseBatchLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        purchaseBatchId: 'batch-1',
        quantityRemaining: 5,
        unitCost: 12000,
        purchaseBatch: {
          id: 'batch-1',
          supplierId: 'supplier-1',
          variantId: 'variant-1',
          documentType: 'DELIVERY_NOTE',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      },
    ]);
    tx.purchaseBatchLine.update.mockResolvedValue({});
    tx.purchaseBatchLine.count.mockResolvedValue(1);
    tx.purchaseBatchLine.aggregate.mockResolvedValue({
      _sum: { quantityRemaining: 3 },
    });
    tx.purchaseBatch.update.mockResolvedValue({});
    tx.variant.update.mockResolvedValue({ id: 'variant-1', stock: 3 });
    tx.auditLog.create.mockResolvedValue({});

    const result = await service.reduceStockFIFO(
      'variant-1',
      2,
      'admin-1',
      tx as never,
    );

    expect(tx.purchaseBatchLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          purchaseBatch: {
            select: expect.objectContaining({
              documentType: true,
            }) as unknown,
          },
        },
      }) as unknown,
    );
    expect(result.reductions).toEqual([
      {
        purchaseBatchLineId: 'line-1',
        batchId: 'batch-1',
        supplierId: 'supplier-1',
        quantity: 2,
        unitCost: 12000,
        documentType: 'DELIVERY_NOTE',
      },
    ]);
  });

  it('crea una salida no comercial reutilizando FIFO y registra trazabilidad propia', async () => {
    tx.variant.findUnique.mockResolvedValue({
      id: 'variant-1',
      sku: 'SKU-1',
      stock: 10,
      stockCommitted: 2,
      product: {
        id: 'product-1',
        name: 'Bolsa clasica',
        slug: 'bolsa-clasica',
      },
    });
    tx.purchaseBatchLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        purchaseBatchId: 'batch-1',
        quantityRemaining: 8,
        unitCost: 12000,
        purchaseBatch: {
          id: 'batch-1',
          supplierId: 'supplier-1',
          variantId: 'variant-1',
          documentType: 'INVOICE',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      },
    ]);
    tx.purchaseBatchLine.update.mockResolvedValue({});
    tx.purchaseBatchLine.count.mockResolvedValue(1);
    tx.purchaseBatchLine.aggregate.mockResolvedValue({
      _sum: { quantityRemaining: 5 },
    });
    tx.purchaseBatch.update.mockResolvedValue({});
    tx.nonCommercialInventoryOutput.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'output-1',
          ...data,
          createdAt: new Date('2026-04-22T12:00:00.000Z'),
          updatedAt: new Date('2026-04-22T12:00:00.000Z'),
          variant: {
            id: 'variant-1',
            sku: 'SKU-1',
            size: 'M',
            color: 'Natural',
            stock: 7,
            stockCommitted: 2,
            product: {
              id: 'product-1',
              name: 'Bolsa clasica',
              slug: 'bolsa-clasica',
            },
          },
          user: {
            id: 'admin-1',
            email: 'admin@tote-bag.com',
            profile: {
              firstName: 'Admin',
              lastName: 'Uno',
            },
          },
        }),
    );

    const result = await service.createNonCommercialOutput({
      variantId: 'variant-1',
      quantity: 3,
      reason: 'GIFT',
      notes: 'Salida de cortesia',
      supportUrl: 'private://support-documents/non-commercial/gift.pdf',
      userId: 'admin-1',
    });

    const inventoryMovementCalls = tx.inventoryMovement.create.mock
      .calls as Array<
      [
        {
          data: { reason: string; quantity: number; variantId: string };
        },
      ]
    >;
    const nonCommercialOutputCalls = tx.nonCommercialInventoryOutput.create.mock
      .calls as Array<
      [
        {
          data: {
            variantId: string;
            quantity: number;
            reason: string;
            stockBefore: number;
            stockAfter: number;
            userId: string;
            status: string;
          };
        },
      ]
    >;
    const auditLogCalls = tx.auditLog.create.mock.calls as Array<
      [
        {
          data: { action: string; entity: string; entityId: string };
        },
      ]
    >;

    expect(inventoryMovementCalls[0]?.[0]).toMatchObject({
      data: {
        reason: 'NON_COMMERCIAL_OUTPUT',
        quantity: -3,
        variantId: 'variant-1',
      },
    });
    expect(nonCommercialOutputCalls[0]?.[0]).toMatchObject({
      data: {
        variantId: 'variant-1',
        quantity: 3,
        reason: 'GIFT',
        stockBefore: 10,
        stockAfter: 7,
        userId: 'admin-1',
        status: 'COMPLETED',
      },
    });
    expect(auditLogCalls.at(-1)?.[0]).toMatchObject({
      data: {
        action: 'CREATE_NON_COMMERCIAL_INVENTORY_OUTPUT',
        entity: 'NonCommercialInventoryOutput',
        entityId: 'output-1',
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'output-1',
        quantity: 3,
        stockAfter: 7,
      }),
    );
  });

  it('rechaza una salida no comercial si invade stock comprometido', async () => {
    tx.variant.findUnique.mockResolvedValue({
      id: 'variant-1',
      sku: 'SKU-1',
      stock: 5,
      stockCommitted: 4,
      product: {
        id: 'product-1',
        name: 'Bolsa clasica',
        slug: 'bolsa-clasica',
      },
    });

    await expect(
      service.createNonCommercialOutput({
        variantId: 'variant-1',
        quantity: 2,
        reason: 'OTHER',
        notes: 'Uso interno',
        userId: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.purchaseBatchLine.findMany).not.toHaveBeenCalled();
    expect(tx.nonCommercialInventoryOutput.create).not.toHaveBeenCalled();
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
    tx.purchaseBatchLine.updateMany.mockResolvedValue({ count: 1 });
    tx.purchaseBatch.update.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    await service.deletePurchaseBatch('batch-2', 'admin-1');

    expect(tx.variant.update).not.toHaveBeenCalled();
    expect(tx.supplier.update).not.toHaveBeenCalled();
    expect(tx.financialTransaction.create).not.toHaveBeenCalled();
    expect(tx.purchaseBatch.delete).not.toHaveBeenCalled();
    expect(tx.purchaseBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-2' },
      data: {
        quantityRemaining: 0,
        status: 'CANCELLED',
        deletedAt: expect.any(Date) as unknown,
      },
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

  it('usa un timeout extendido para registrar recepciones con varias operaciones', async () => {
    mockCreateBatchBase();

    await service.createPurchaseBatch({
      supplierId: 'supplier-1',
      totalCost: 45000,
      status: 'RECIBIDO',
      purchaseDate: '2026-04-14',
      userId: 'admin-1',
      documentType: 'INVOICE',
      supportUrl: 'private://support-documents/purchase-batches/test.pdf',
      items: [
        {
          itemType: 'TOOL',
          itemName: 'Tijeras industriales',
          cantidad: 1,
          unitOfMeasure: 'und',
          costoUnitario: 45000,
        },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10000,
      timeout: 20000,
    });
  });
});
