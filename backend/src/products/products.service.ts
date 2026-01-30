import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from '../generated/client/client';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { variants, ...data } = updateProductDto;
    
    // If variants are present, we might need complex logic (upsert/delete). 
    // For now, let's focus on updating scalar fields like status, prices, etc.
    // If variants update is needed, it should be handled carefully.
    
    return this.prisma.product.update({
      where: { id },
      data: {
        ...data,
      },
      include: { variants: true },
    });
  }


  async remove(id: string) {
    // Check integrity
    const ordersCount = await this.prisma.orderItem.count({
      where: { productId: id }
    });

    if (ordersCount > 0) {
      // Soft Delete if it has history
      return this.prisma.product.update({
        where: { id },
        data: { isActive: false, status: 'BAJO_PEDIDO' } // Or specific archived status
      });
    }

    return this.prisma.product.delete({
      where: { id },
    });
  }

  private validateSku(
    sku: string,
    collection: string,
    design: string,
    color: string,
  ): boolean {
    // Format: TB-[COLECCIÓN]-[DISEÑO]-[COLOR]
    // We normalize inputs to uppercase to compare
    const normalizedCollection = collection.toUpperCase().replace(/\s+/g, '');
    const normalizedDesign = design.toUpperCase().replace(/\s+/g, ''); // Assuming design maps to Product Name
    const normalizedColor = color.toUpperCase().replace(/\s+/g, '');

    // Construct expected prefix and suffix or full SKU
    // Requirement is ensuring the format.
    // Let's check regex: ^TB-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$
    const skuRegex =
      /^TB-[A-Z0-9\u00C0-\u00FF]+-[A-Z0-9\u00C0-\u00FF]+-[A-Z0-9\u00C0-\u00FF]+$/;

    if (!skuRegex.test(sku)) {
      return false;
    }

    // Optional: stricter check matching the actual values
    const parts = sku.split('-');
    if (parts.length !== 4) return false;

    // parts[0] is TB
    // parts[1] should be collection
    // parts[2] should be design (name)
    // parts[3] should be color

    // We allow loose matching or strict? "Validación de SKU que asegure el formato".
    // I will implement strict matching against the provided product details.

    return (
      parts[0] === 'TB' &&
      parts[1] === normalizedCollection &&
      // parts[2] === normalizedDesign && // Name might vary slightly, let's keep it flexible or strict?
      // User prompt: "TB-[COLECCIÓN]-[DISEÑO]-[COLOR]"
      // I'll assume strict consistency is desired to prevent data mess.
      parts[2] === normalizedDesign &&
      parts[3] === normalizedColor
    );
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const { variants, ...productData } = createProductDto;

    // 1. Logic Validation: base_price >= min_price
    if (productData.basePrice < productData.minPrice) {
      throw new BadRequestException(
        `Base price (${productData.basePrice}) cannot be lower than Minimum Price (${productData.minPrice})`,
      );
    }

    // 2. Prepare Variants and Validate SKUs
    // We assume 'name' acts as 'DISEÑO'
    const designName = productData.name;

    for (const variant of variants) {
      const isValid = this.validateSku(
        variant.sku,
        productData.collection,
        designName,
        variant.color,
      );

      if (!isValid) {
        throw new BadRequestException(
          `Invalid SKU format: ${variant.sku}. Expected: TB-${productData.collection.toUpperCase().replace(/\s+/g, '')}-${designName.toUpperCase().replace(/\s+/g, '')}-${variant.color.toUpperCase().replace(/\s+/g, '')}`,
        );
      }
    }

    // 3. Transactional Creation
    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        const product = await prisma.product.create({
          data: {
            ...productData,
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
          },
        });
        return product;
      });

      return result;
    } catch (error) {
      console.error('Error creating product:', error);
      // Handle unique constraint violations (e.g. SKU)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Unique constraint failed: SKU or ID already exists',
        );
      }
      throw new InternalServerErrorException('Failed to create product');
    }
  }

  async findAll(collection?: string) {
    const where: any = {
      isActive: true, // Only active products
    };

    if (collection) {
      where.collection = {
        equals: collection,
        mode: 'insensitive', // Case insensitive search
      };
    }

    return this.prisma.product.findMany({
      where,
      include: { variants: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }
}
