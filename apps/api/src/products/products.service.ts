import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Product, Prisma } from '../generated/client/client';
import { UpdateProductDto } from './dto/update-product.dto';

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { variants: true; images: true; collection: true };
}>;

@Injectable()
export class ProductsService {
  private readonly CACHE_KEY = 'products_list';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductWithRelations> {
    const { variants, images, collectionId, collectionName, ...data } =
      updateProductDto;

    console.log(`Updating product ${id}`);

    if (variants) {
      console.log('Received variants for update:', variants.length);
      console.log('Sample variant SKU:', variants[0]?.sku);
    } else {
      console.log('No variants provided in update DTO');
    }

    // Resolve Collection if needed
    let activeCollectionId: string | undefined = collectionId;

    if (collectionName) {
      const slug = collectionName
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');

      let collection = await this.prisma.collection.findFirst({
        where: { OR: [{ name: collectionName }, { slug }] },
      });

      if (!collection) {
        collection = await this.prisma.collection.create({
          data: { name: collectionName, slug },
        });
      }

      activeCollectionId = collection.id;
    }

    // Prepare update data
    const updateData: Prisma.ProductUpdateInput = {
      ...data,
      ...(activeCollectionId && { collectionId: activeCollectionId }), // Only add if resolved
    };

    // Handle images update if provided
    if (images) {
      updateData.images = {
        deleteMany: {}, // Clear existing images
        create: images.map((img) => ({
          url: img.url,
          alt: img.alt,
          position: img.position,
        })),
      };
    }

    const updatedProduct = await this.prisma.$transaction(async (prisma) => {
      // 1. Update Variants if provided
      if (variants) {
        console.log(`[ProductsService] Processing ${variants.length} variants`);
        const currentVariants = await prisma.variant.findMany({
          where: { productId: id },
          select: { id: true, sku: true },
        });

        console.log(
          `[ProductsService] Found ${currentVariants.length} existing variants`,
        );
        const currentSkuSet = new Set(currentVariants.map((v) => v.sku.trim()));
        console.log(
          `[ProductsService] Existing SKUs: ${Array.from(currentSkuSet).join(', ')}`,
        );

        const incomingSkuSet = new Set(variants.map((v) => v.sku.trim()));
        console.log(
          `[ProductsService] Incoming SKUs: ${Array.from(incomingSkuSet).join(', ')}`,
        );

        // Delete removed variants
        const variantsToDelete = currentVariants.filter(
          (v) => !incomingSkuSet.has(v.sku.trim()),
        );

        if (variantsToDelete.length > 0) {
          console.log(
            '[ProductsService] Deleting variants:',
            variantsToDelete.length,
          );

          await prisma.variant.deleteMany({
            where: { id: { in: variantsToDelete.map((v) => v.id) } },
          });
        }

        // Update or Create
        for (const v of variants) {
          const sku = v.sku.trim();
          if (currentSkuSet.has(sku)) {
            console.log(
              `[ProductsService] Updating variant SKU: ${sku} Stock: ${v.stock}`,
            );

            await prisma.variant.update({
              where: { sku: sku },
              data: {
                color: v.color,
                imageUrl: v.imageUrl,
                stock: v.stock,
              },
            });
          } else {
            console.log(`[ProductsService] Creating variant SKU: ${sku}`);

            await prisma.variant.create({
              data: {
                sku: sku,
                color: v.color,
                imageUrl: v.imageUrl,
                stock: v.stock,
                productId: id,
              },
            });
          }
        }
      }

      // 2. Update Product (and images via nested write)
      return prisma.product.update({
        where: { id },
        data: updateData,
        include: { variants: true, images: true, collection: true },
      });
    });

    // Invalidate Cache
    await this.cacheManager.del(this.CACHE_KEY);
    return updatedProduct;
  }

  async remove(id: string): Promise<Product> {
    // Check integrity
    const ordersCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });

    let result: Product;
    if (ordersCount > 0) {
      // Soft Delete if it has history
      result = await this.prisma.product.update({
        where: { id },
        data: { isActive: false, status: 'BAJO_PEDIDO' }, // Or specific archived status
      });
    } else {
      result = await this.prisma.product.delete({
        where: { id },
      });
    }

    // Invalidate Cache
    await this.cacheManager.del(this.CACHE_KEY);
    return result;
  }

  private validateSku(
    sku: string,
    collectionName: string, // Name from DB
    design: string,
    color: string,
  ): boolean {
    // Format: TB-[COLECCIÓN]-[DISEÑO]-[COLOR]
    const normalizedCollection = collectionName
      .toUpperCase()
      .replace(/\s+/g, '');
    const normalizedDesign = design.toUpperCase().replace(/\s+/g, '');
    const normalizedColor = color.toUpperCase().replace(/\s+/g, '');

    const parts = sku.split('-');
    if (parts.length !== 4) return false;

    return (
      parts[0] === 'TB' &&
      parts[1] === normalizedCollection &&
      parts[2] === normalizedDesign &&
      parts[3] === normalizedColor
    );
  }

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductWithRelations> {
    const { variants, collectionId, collectionName, images, ...productData } =
      createProductDto;

    // 1. Logic Validation: base_price >= min_price
    if (productData.basePrice < productData.minPrice) {
      throw new BadRequestException(
        `Base price (${productData.basePrice}) cannot be lower than Minimum Price (${productData.minPrice})`,
      );
    }

    // 2. Fetch or Create Collection for SKU validation
    let collection: { id: string; name: string } | null = null;

    if (collectionId) {
      collection = await this.prisma.collection.findUnique({
        where: { id: collectionId },
      });
      if (!collection) {
        throw new NotFoundException(
          `Collection with ID ${collectionId} not found`,
        );
      }
    } else if (collectionName) {
      const slug = collectionName
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');
      collection = await this.prisma.collection.findFirst({
        where: { OR: [{ name: collectionName }, { slug }] },
      });

      if (!collection) {
        collection = await this.prisma.collection.create({
          data: { name: collectionName, slug },
        });
      }
    } else {
      throw new BadRequestException(
        'Either collectionId or collectionName is required',
      );
    }

    // 3. Prepare Variants and Validate SKUs
    const designName = productData.name;

    for (const variant of variants) {
      const isValid = this.validateSku(
        variant.sku,
        collection.name,
        designName,
        variant.color,
      );

      if (!isValid) {
        throw new BadRequestException(
          `Invalid SKU format: ${variant.sku}. Expected: TB-${collection.name.toUpperCase().replace(/\s+/g, '')}-${designName.toUpperCase().replace(/\s+/g, '')}-${variant.color.toUpperCase().replace(/\s+/g, '')}`,
        );
      }
    }

    // 4. Transactional Creation
    try {
      const activeCollectionId = collection.id;
      const product = await this.prisma.$transaction(async (prisma) => {
        return prisma.product.create({
          data: {
            ...productData,
            collectionId: activeCollectionId,
            images: {
              create: images?.map((img) => ({
                url: img.url,
                alt: img.alt,
                position: img.position,
              })),
            },
            variants: {
              create: variants.map((v) => ({
                sku: v.sku,
                color: v.color,
                imageUrl: v.imageUrl,
                stock: v.stock,
              })),
            },
          },
          include: {
            variants: true,
            images: true,
            collection: true,
          },
        });
      });

      // Invalidate Cache
      await this.cacheManager.del(this.CACHE_KEY);
      return product;
    } catch (error: unknown) {
      console.error('Error creating product:', error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Unique constraint failed: SKU or ID already exists',
        );
      }
      throw new InternalServerErrorException('Failed to create product');
    }
  }

  async findAll(collectionId?: string): Promise<ProductWithRelations[]> {
    if (!collectionId) {
      const cachedProducts = await this.cacheManager.get<
        ProductWithRelations[]
      >(this.CACHE_KEY);
      if (cachedProducts) {
        return cachedProducts;
      }
    }

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (collectionId) {
      where.collectionId = collectionId;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: { variants: true, images: true, collection: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!collectionId) {
      await this.cacheManager.set(this.CACHE_KEY, products);
    }

    return products;
  }

  async findOne(id: string): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true, images: true, collection: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async findBySlug(slug: string): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { variants: true, images: true, collection: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }
    return product;
  }
}
