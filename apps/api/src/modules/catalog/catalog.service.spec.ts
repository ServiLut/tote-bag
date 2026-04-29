import { CatalogService } from './catalog.service';
import { BadRequestException } from '@nestjs/common';

describe('CatalogService', () => {
  const tx = {
    variant: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    purchaseBatchLine: {
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const cacheManager = {
    del: jest.fn(),
  };

  const managerApprovalsService = {
    requireApproval: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    $transaction: jest.fn(),
    orderItem: {
      count: jest.fn(),
    },
    b2BQuoteItem: {
      count: jest.fn(),
    },
    purchaseBatch: {
      count: jest.fn(),
    },
    purchaseBatchLine: {
      count: jest.fn(),
    },
    variant: {
      count: jest.fn(),
    },
    personalizationRequest: {
      count: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.purchaseBatch.count.mockResolvedValue(0);
    prisma.purchaseBatchLine.count.mockResolvedValue(0);
    prisma.variant.count.mockResolvedValue(0);
    prisma.product.findMany.mockResolvedValue([]);
    tx.purchaseBatchLine.findMany.mockResolvedValue([]);
    service = new CatalogService(
      prisma as never,
      cacheManager as never,
      managerApprovalsService as never,
    );
  });

  it('previews variant pricing from net price using backend decimal math', () => {
    const preview = service.previewVariantPrice({
      netPrice: 100000,
      taxRate: 0.19,
      costPrice: 60000,
    });

    expect(preview).toEqual({
      netPrice: 100000,
      price: 119000,
      salePrice: 119000,
      taxAmount: 19000,
      marginPercentage: 40,
      taxRate: 0.19,
    });
  });

  it('matches the admin product form gross margin preview', () => {
    const preview = service.previewVariantPrice({
      netPrice: 37209,
      taxRate: 0.19,
      costPrice: 14175,
    });

    expect(preview).toEqual({
      netPrice: 37209,
      price: 44278.71,
      salePrice: 44278.71,
      taxAmount: 7069.71,
      marginPercentage: 61.9,
      taxRate: 0.19,
    });
  });

  it('uses total cost instead of unit cost for margin preview when provided', () => {
    const preview = service.previewVariantPrice({
      netPrice: 100000,
      taxRate: 0.19,
      costPrice: 50000,
      totalCost: 65000,
    });

    expect(preview.marginPercentage).toBe(35);
  });

  it('rejects net price preview when net price is zero', () => {
    expect(() =>
      service.previewVariantPrice({
        netPrice: 0,
        taxRate: 0.19,
      }),
    ).toThrow(BadRequestException);
  });

  it('filters by any selected collection when multiple collection ids are provided', async () => {
    await service.findAllAdmin({
      collectionId: 'collection-deportes,collection-mujeres',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          collectionId: {
            in: ['collection-deportes', 'collection-mujeres'],
          },
        },
      }),
    );
  });

  it('excludes products without active variants from the public catalog', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'product-hidden',
        name: 'Oculto',
        slug: 'oculto',
        description: 'sin variantes activas',
        basePrice: 100,
        comparePrice: null,
        status: 'DISPONIBLE',
        collectionId: 'collection-1',
        collection: null,
        images: [],
        tags: [],
        deliveryTime: '3 dias',
        material: 'Algodon',
        dimensions: null,
        careInstructions: null,
        printType: 'DTF',
        seoTitle: null,
        seoDescription: null,
        attributes: [],
        pricingRules: [],
        variants: [
          {
            id: 'variant-hidden',
            sku: 'SKU-HIDDEN',
            size: null,
            color: 'Negro',
            imageUrl: 'https://example.com/hidden.jpg',
            salePrice: 100,
            comparePrice: null,
            costPrice: 50,
            totalCost: null,
            taxRate: 0.19,
            stock: 0,
            stockCommitted: 0,
            reorderPoint: null,
            isActive: false,
          },
        ],
      },
      {
        id: 'product-visible',
        name: 'Visible',
        slug: 'visible',
        description: 'con variante activa',
        basePrice: 120,
        comparePrice: null,
        status: 'DISPONIBLE',
        collectionId: 'collection-1',
        collection: null,
        images: [],
        tags: [],
        deliveryTime: '3 dias',
        material: 'Algodon',
        dimensions: null,
        careInstructions: null,
        printType: 'DTF',
        seoTitle: null,
        seoDescription: null,
        attributes: [],
        pricingRules: [],
        variants: [
          {
            id: 'variant-visible',
            sku: 'SKU-VISIBLE',
            size: null,
            color: 'Blanco',
            imageUrl: 'https://example.com/visible.jpg',
            salePrice: 120,
            comparePrice: null,
            costPrice: 60,
            totalCost: null,
            taxRate: 0.19,
            stock: 4,
            stockCommitted: 1,
            reorderPoint: null,
            isActive: true,
          },
        ],
      },
    ]);

    const result = await service.findAll({});

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('product-visible');
    expect(result[0]?.variants).toHaveLength(1);
  });

  it('auto-generates the SKU for an existing variant during product updates', async () => {
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.product.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Tote Bag Clasica',
      collection: {
        name: 'Basicos',
      },
    });
    tx.variant.findFirst.mockResolvedValue({
      id: 'variant-1',
    });
    tx.variant.findMany
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
          productId: 'product-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
          size: 'M',
          color: 'Negro',
          isActive: true,
        },
      ]);
    tx.variant.updateMany.mockResolvedValue({ count: 0 });
    tx.variant.update.mockResolvedValue({
      id: 'variant-1',
      sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
    });
    tx.product.update.mockResolvedValue({
      id: 'product-1',
      variants: [{ id: 'variant-1', sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO' }],
    });

    await service.update(
      'product-1',
      {
        variants: [
          {
            id: 'variant-1',
            sku: '',
            size: 'M',
            color: 'Negro',
            imageUrl: 'https://example.com/variant.jpg',
            salePrice: 100,
            minPrice: 90,
            costPrice: 50,
            isActive: true,
          },
        ],
      },
      'admin-1',
    );

    expect(tx.variant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: {
        sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
        size: 'M',
        color: 'Negro',
        imageUrl: 'https://example.com/variant.jpg',
        salePrice: 100,
        minPrice: 90,
        comparePrice: undefined,
        costPrice: 50,
        totalCost: undefined,
        taxRate: undefined,
        isActive: true,
      },
    });
  });

  it('persists salePrice as gross PVP when product updates receive netPrice', async () => {
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.product.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Tote Bag Clasica',
      collection: {
        name: 'Basicos',
      },
    });
    tx.variant.findFirst.mockResolvedValue({
      id: 'variant-1',
    });
    tx.variant.findMany
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
          productId: 'product-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
          size: 'M',
          color: 'Negro',
          isActive: true,
        },
      ]);
    tx.variant.updateMany.mockResolvedValue({ count: 0 });
    tx.variant.update.mockResolvedValue({
      id: 'variant-1',
      sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
    });
    tx.product.update.mockResolvedValue({
      id: 'product-1',
      variants: [
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
          salePrice: 119000,
          costPrice: 60000,
          taxRate: 0.19,
        },
      ],
    });

    await service.update(
      'product-1',
      {
        variants: [
          {
            id: 'variant-1',
            sku: '',
            size: 'M',
            color: 'Negro',
            imageUrl: 'https://example.com/variant.jpg',
            netPrice: 100000,
            minPrice: 90000,
            costPrice: 60000,
            taxRate: 0.19,
            isActive: true,
          },
        ],
      },
      'admin-1',
    );

    expect(tx.variant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: {
        sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
        size: 'M',
        color: 'Negro',
        imageUrl: 'https://example.com/variant.jpg',
        salePrice: 119000,
        minPrice: 90000,
        comparePrice: undefined,
        costPrice: 60000,
        totalCost: undefined,
        taxRate: 0.19,
        isActive: true,
      },
    });
  });

  it('rejects deactivating product variants with active stock during updates', async () => {
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.product.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Tote Bag Clasica',
      collection: {
        name: 'Basicos',
      },
    });
    tx.variant.findFirst.mockResolvedValue({
      id: 'variant-2',
    });
    tx.variant.findMany
      .mockResolvedValueOnce([
        {
          id: 'variant-2',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-BLANCO',
          productId: 'product-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
        },
        {
          id: 'variant-2',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-BLANCO',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
          size: 'M',
          color: 'Negro',
          isActive: true,
        },
        {
          id: 'variant-2',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-BLANCO',
          size: 'M',
          color: 'Blanco',
          isActive: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
        },
      ]);
    tx.purchaseBatchLine.findMany.mockResolvedValueOnce([
      {
        variant: {
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
        },
      },
    ]);

    await expect(
      service.update('product-1', {
        variants: [
          {
            id: 'variant-2',
            sku: '',
            size: 'M',
            color: 'Blanco',
            imageUrl: 'https://example.com/variant.jpg',
            salePrice: 100,
            minPrice: 90,
            costPrice: 50,
            isActive: true,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.variant.updateMany).not.toHaveBeenCalled();
    expect(tx.variant.update).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('rejects updates that leave a product without active variants', async () => {
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.product.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Tote Bag Clasica',
      collection: {
        name: 'Basicos',
      },
    });
    tx.variant.findFirst.mockResolvedValue({
      id: 'variant-1',
    });
    tx.variant.findMany
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
          productId: 'product-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          sku: 'TB-BASICOS-TOTEBAGCLASICA-M-NEGRO',
        },
      ]);

    await expect(
      service.update(
        'product-1',
        {
          variants: [
            {
              id: 'variant-1',
              sku: '',
              size: 'M',
              color: 'Negro',
              imageUrl: 'https://example.com/variant.jpg',
              salePrice: 100,
              minPrice: 90,
              costPrice: 50,
              isActive: false,
            },
          ],
        },
        'admin-1',
      ),
    ).rejects.toThrow('Debes mantener al menos una variante activa vendible.');

    expect(tx.variant.update).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('soft-deletes products with inventory history instead of hard-deleting them', async () => {
    prisma.$transaction.mockResolvedValue([0, 0, 2, 0]);
    prisma.product.update.mockResolvedValue({
      id: 'product-1',
      isActive: false,
      status: 'BAJO_PEDIDO',
    });

    const result = await service.remove('product-1');

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { isActive: false, status: 'BAJO_PEDIDO' },
    });
    expect(prisma.product.delete).not.toHaveBeenCalled();
    expect(cacheManager.del).toHaveBeenCalledWith('products_list');
    expect(result).toEqual({
      id: 'product-1',
      isActive: false,
      status: 'BAJO_PEDIDO',
    });
  });

  it('rejects deleting products with active inventory', async () => {
    prisma.purchaseBatch.count.mockResolvedValueOnce(1);

    await expect(service.remove('product-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.product.delete).not.toHaveBeenCalled();
    expect(cacheManager.del).not.toHaveBeenCalled();
  });

  it('counts legacy product-level batches as active inventory when deleting', async () => {
    prisma.purchaseBatch.count.mockResolvedValueOnce(1);

    await expect(service.remove('product-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.purchaseBatch.count).toHaveBeenCalledWith({
      where: {
        productId: 'product-1',
        deletedAt: null,
        status: 'IN_STOCK',
        quantityRemaining: { gt: 0 },
      },
    });
  });

  it('counts line-linked batches as active inventory when deleting', async () => {
    prisma.purchaseBatchLine.count.mockResolvedValueOnce(1);

    await expect(service.remove('product-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.purchaseBatchLine.count).toHaveBeenCalledWith({
      where: {
        itemType: 'VARIANT',
        status: 'IN_STOCK',
        quantityRemaining: { gt: 0 },
        variant: {
          is: {
            productId: 'product-1',
          },
        },
        purchaseBatch: {
          status: 'IN_STOCK',
          deletedAt: null,
        },
      },
    });
  });

  it('counts line-linked batches as historical references before hard delete', async () => {
    prisma.$transaction.mockResolvedValue([0, 0, 1, 0]);
    prisma.product.update.mockResolvedValue({
      id: 'product-1',
      isActive: false,
      status: 'BAJO_PEDIDO',
    });

    await service.remove('product-1');

    expect(prisma.purchaseBatch.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { productId: 'product-1' },
          {
            lines: {
              some: {
                itemType: 'VARIANT',
                variant: {
                  is: {
                    productId: 'product-1',
                  },
                },
              },
            },
          },
        ],
      },
    });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { isActive: false, status: 'BAJO_PEDIDO' },
    });
  });

  it('hard-deletes products that have no historical references', async () => {
    prisma.$transaction.mockResolvedValue([0, 0, 0, 0]);
    prisma.product.delete.mockResolvedValue({
      id: 'product-2',
    });

    const result = await service.remove('product-2');

    expect(prisma.product.delete).toHaveBeenCalledWith({
      where: { id: 'product-2' },
    });
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(cacheManager.del).toHaveBeenCalledWith('products_list');
    expect(result).toEqual({
      id: 'product-2',
    });
  });
});
