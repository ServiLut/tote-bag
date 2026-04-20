import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductConfig(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { salePrice: 'asc' },
        },
        attributes: {
          where: { isActive: true, deletedAt: null },
        },
        pricingRules: {
          where: { isActive: true, deletedAt: null },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }

    const referenceVariant = product.variants[0];
    const hasVariantSizes = product.variants.some((variant) => !!variant.size);
    const activeCommercialVariantCount = product.variants.length;

    return {
      productId: product.id,
      name: product.name,
      // Transitional compatibility for consumers that still expect a top-level price.
      basePrice: referenceVariant?.salePrice ?? product.basePrice,
      minPrice: referenceVariant?.minPrice ?? product.minPrice,
      referenceVariantId: referenceVariant?.id ?? null,
      requiresVariantSelection: activeCommercialVariantCount > 1,
      variants: product.variants,
      attributes: hasVariantSizes
        ? product.attributes.filter((attribute) => attribute.type !== 'SIZE')
        : product.attributes,
      pricingRules: product.pricingRules,
    };
  }

  async getAvailableOptions(productId: string) {
    const [attributes, personalizationOptions] = await Promise.all([
      this.prisma.productAttribute.findMany({
        where: { productId, deletedAt: null },
      }),
      this.prisma.personalizationOption.findMany({
        where: { deletedAt: null },
      }),
    ]);

    // Group attributes by type for better frontend consumption
    const groupedAttributes = attributes.reduce(
      (acc, attr) => {
        if (!acc[attr.type]) {
          acc[attr.type] = [];
        }
        acc[attr.type].push({
          id: attr.id,
          value: attr.value,
          priceModifier: attr.priceModifier,
          isActive: attr.isActive,
        });
        return acc;
      },
      {} as Record<string, any[]>,
    );

    return {
      productId,
      attributes: groupedAttributes,
      personalizationOptions: personalizationOptions.map((opt) => ({
        id: opt.id,
        name: opt.name,
        code: opt.code,
        basePrice: opt.basePrice,
      })),
    };
  }
}
