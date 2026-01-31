import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Product, Prisma } from '../generated/client/client';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async update(id: string, updateProductDto: UpdateProductDto) {
    const {
      variants: _variants,
      images,
      collectionId,
      collectionName,
      ...data
    } = updateProductDto;
    void _variants;

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

    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: { variants: true, images: true, collection: true },
    });
  }

  async remove(id: string) {
    // Check integrity
    const ordersCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });

    if (ordersCount > 0) {
      // Soft Delete if it has history
      return this.prisma.product.update({
        where: { id },
        data: { isActive: false, status: 'BAJO_PEDIDO' }, // Or specific archived status
      });
    }

    return this.prisma.product.delete({
      where: { id },
    });
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

  async create(createProductDto: CreateProductDto): Promise<Product> {
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
      const result = await this.prisma.$transaction(async (prisma) => {
        const product = await prisma.product.create({
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
        return product;
      });

      return result;
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

  async findAll(collectionId?: string) {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (collectionId) {
      where.collectionId = collectionId;
    }

    return this.prisma.product.findMany({
      where,
      include: { variants: true, images: true, collection: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true, images: true, collection: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async findBySlug(slug: string) {
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
