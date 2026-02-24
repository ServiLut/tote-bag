import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductConfigInputDto } from '../../common/dto/product-config.dto';
import { PricingScope } from '../../generated/client/enums';
import { PricingSnapshot } from '../../common/interfaces/snapshots.interface';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateQuote(input: ProductConfigInputDto, scope: PricingScope = PricingScope.B2C) {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      include: {
        attributes: true,
        pricingRules: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${input.productId} not found`);
    }

    const snapshot: PricingSnapshot = {
      version: '1.0',
      basePrice: product.basePrice,
      attributeModifiers: [],
      personalizationSurcharges: [],
      minPriceGuardApplied: false,
      finalUnitPrice: 0,
      quantity: input.quantity,
      totalPrice: 0,
      currency: 'COP',
      timestamp: new Date().toISOString(),
    };

    let unitPrice = product.basePrice;

    const inputAttributes = [
      { type: 'SIZE', name: input.size },
      { type: 'MATERIAL', name: input.material },
      { type: 'QUALITY', name: input.quality },
      { type: 'LINE', name: input.line }
    ];

    for (const inputAttr of inputAttributes) {
      const matchingAttr = product.attributes.find(
        a => a.type === inputAttr.type && a.name === inputAttr.name
      );
      
      if (matchingAttr) {
        unitPrice += matchingAttr.priceModifier;
        snapshot.attributeModifiers.push({
          type: inputAttr.type,
          name: inputAttr.name,
          modifier: matchingAttr.priceModifier,
        });
      }
    }

    if (input.personalizations && input.personalizations.length > 0) {
      const personalizationCodes = input.personalizations.map(p => p.code);
      const options = await this.prisma.personalizationOption.findMany({
        where: { code: { in: personalizationCodes } }
      });

      for (const p of input.personalizations) {
        const option = options.find(o => o.code === p.code);
        if (option) {
          unitPrice += option.basePrice;
          snapshot.personalizationSurcharges.push({
            code: p.code,
            surcharge: option.basePrice,
          });
        } else {
          throw new BadRequestException(`Invalid personalization code: ${p.code}`);
        }
      }
    }

    if (scope === PricingScope.B2B) {
      const applicableRule = product.pricingRules
        .filter(rule => rule.scope === PricingScope.B2B && input.quantity >= rule.minQuantity)
        .sort((a, b) => b.minQuantity - a.minQuantity)[0];

      if (applicableRule) {
        const discountPercentage = applicableRule.discountPercentage;
        const discountAmount = unitPrice * (discountPercentage / 100);
        unitPrice -= discountAmount;
        
        snapshot.volumeDiscount = {
          minQuantity: applicableRule.minQuantity,
          percentage: discountPercentage,
          amount: discountAmount,
        };
      }
    }

    if (unitPrice < product.minPrice) {
      unitPrice = product.minPrice;
      snapshot.minPriceGuardApplied = true;
    }

    const total = unitPrice * input.quantity;
    snapshot.finalUnitPrice = unitPrice;
    snapshot.totalPrice = total;

    return {
      unitPrice,
      quantity: input.quantity,
      total,
      currency: 'COP',
      snapshot,
    };
  }
}
