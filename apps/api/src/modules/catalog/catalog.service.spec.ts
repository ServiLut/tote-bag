import { BadRequestException } from '@nestjs/common';
import { ProductStatus, Prisma } from '../../generated/client/client';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const cacheManager = {
    del: jest.fn(),
  };

  const prisma = {
    collection: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    variant: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    orderItem: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    service = new CatalogService(prisma as never, cacheManager as never);
  });

  it('preserva el id de la variante al cambiar SKU y color durante update', async () => {
    prisma.variant.findMany.mockResolvedValue([
      {
        id: 'variant-1',
        sku: 'TB-LINEA-TOTE-NEGRO',
      },
    ]);
    prisma.product.update.mockResolvedValue({
      id: 'product-1',
      name: 'Tote clasico',
      description: 'Demo',
      status: ProductStatus.BAJO_PEDIDO,
      collectionId: 'collection-1',
      slug: 'tote-clasico',
      tags: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveryTime: '5 dias',
      variants: [
        {
          id: 'variant-1',
          sku: 'TB-LINEA-TOTE-BLANCO',
          color: 'Blanco',
          imageUrl: 'https://example.com/variant.jpg',
          unitCost: new Prisma.Decimal(12000),
          price: new Prisma.Decimal(20000),
          stock: 8,
          productId: 'product-1',
        },
      ],
      images: [],
      collection: {
        id: 'collection-1',
        name: 'Linea',
        slug: 'linea',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      attributes: [],
      pricingRules: [],
    });

    await service.update('product-1', {
      variants: [
        {
          id: 'variant-1',
          sku: 'tb-linea-tote-blanco',
          color: 'Blanco',
          imageUrl: 'https://example.com/variant.jpg',
          unitCost: 12000,
          price: 20000,
          stock: 8,
        },
      ],
    });

    expect(prisma.variant.create).not.toHaveBeenCalled();
    expect(prisma.variant.deleteMany).not.toHaveBeenCalled();
    expect(prisma.variant.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'variant-1' },
      data: { sku: 'TMP-variant-1' },
    });
    const variantUpdateCalls = prisma.variant.update.mock.calls as Array<
      [
        {
          where: { id: string };
          data: {
            sku: string;
            color?: string;
            imageUrl?: string;
            unitCost?: Prisma.Decimal;
            price?: Prisma.Decimal;
            stock?: number;
          };
        },
      ]
    >;
    const finalUpdateCall = variantUpdateCalls[1]?.[0] as {
      where: { id: string };
      data: {
        sku: string;
        color: string;
        imageUrl: string;
        unitCost: Prisma.Decimal;
        price: Prisma.Decimal;
        stock: number;
      };
    };

    expect(finalUpdateCall.where).toEqual({ id: 'variant-1' });
    expect(finalUpdateCall.data.sku).toBe('TB-LINEA-TOTE-BLANCO');
    expect(finalUpdateCall.data.color).toBe('Blanco');
    expect(finalUpdateCall.data.imageUrl).toBe(
      'https://example.com/variant.jpg',
    );
    expect(finalUpdateCall.data.stock).toBe(8);
    expect(finalUpdateCall.data.unitCost).toBeInstanceOf(Prisma.Decimal);
    expect(finalUpdateCall.data.price).toBeInstanceOf(Prisma.Decimal);
  });

  it('acepta en create SKUs normalizados desde nombres con acentos', async () => {
    prisma.collection.findFirst.mockResolvedValue({
      id: 'collection-1',
      name: 'Línea Niño',
    });
    prisma.product.create.mockResolvedValue({
      id: 'product-1',
      name: 'Diseño Único',
      description: 'Demo',
      status: ProductStatus.BAJO_PEDIDO,
      collectionId: 'collection-1',
      slug: 'diseno-unico',
      tags: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveryTime: '7 dias',
      variants: [
        {
          id: 'variant-1',
          sku: 'TB-LINEANINO-DISENOUNICO-AZUL1',
          color: 'Azúl #1',
          imageUrl: 'https://example.com/variant.jpg',
          unitCost: new Prisma.Decimal(10000),
          price: new Prisma.Decimal(18000),
          stock: 4,
          productId: 'product-1',
        },
      ],
      images: [],
      collection: {
        id: 'collection-1',
        name: 'Línea Niño',
        slug: 'linea-nino',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      attributes: [],
      pricingRules: [],
    });

    await expect(
      service.create({
        name: 'Diseño Único',
        slug: 'diseno-unico',
        description: 'Demo',
        deliveryTime: '7 dias',
        collectionName: 'Línea Niño',
        variants: [
          {
            sku: 'tb-linea niño-diseño único-azúl #1',
            color: 'Azúl #1',
            imageUrl: 'https://example.com/variant.jpg',
            unitCost: 10000,
            price: 18000,
            stock: 4,
          },
        ],
      }),
    ).resolves.toMatchObject({
      id: 'product-1',
      variants: [
        expect.objectContaining({
          sku: 'TB-LINEANINO-DISENOUNICO-AZUL1',
        }),
      ],
    });

    const productCreateCalls = prisma.product.create.mock.calls as Array<
      [
        {
          data: {
            variants: {
              create: Array<{
                sku: string;
              }>;
            };
          };
        },
      ]
    >;
    const productCreateCall = productCreateCalls[0]?.[0] as {
      data: {
        variants: {
          create: Array<{
            sku: string;
          }>;
        };
      };
    };

    expect(productCreateCall.data.variants.create[0]?.sku).toBe(
      'TB-LINEANINO-DISENOUNICO-AZUL1',
    );
  });

  it('traduce conflicto unico de slug en update a bad request', async () => {
    prisma.product.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['slug'] },
      }),
    );

    const updatePromise = service.update('product-1', {
      name: 'Producto repetido',
      slug: 'producto-repetido',
    });

    await expect(updatePromise).rejects.toThrow(BadRequestException);
    await expect(updatePromise).rejects.toThrow(
      'Ya existe un producto con ese slug.',
    );
  });
});
