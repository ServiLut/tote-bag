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
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const cacheManager = {
    del: jest.fn(),
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
    variant: {
      count: jest.fn(),
    },
    personalizationRequest: {
      count: jest.fn(),
    },
    product: {
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.purchaseBatch.count.mockResolvedValue(0);
    prisma.variant.count.mockResolvedValue(0);
    service = new CatalogService(prisma as never, cacheManager as never);
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

    await service.update('product-1', {
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
    });

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
        taxRate: undefined,
        isActive: true,
      },
    });
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
