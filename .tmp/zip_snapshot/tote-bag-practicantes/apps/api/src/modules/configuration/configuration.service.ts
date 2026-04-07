import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductConfig(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        attributes: true,
        pricingRules: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }

    return {
      productId: product.id,
      name: product.name,
      basePrice: product.basePrice,
      minPrice: product.minPrice,
      attributes: product.attributes,
      pricingRules: product.pricingRules,
    };
  }

  async getAvailableOptions(productId: string) {
    const [attributes, personalizationOptions] = await Promise.all([
      this.prisma.productAttribute.findMany({
        where: { productId },
      }),
      this.prisma.personalizationOption.findMany(),
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
