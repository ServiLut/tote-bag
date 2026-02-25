import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductConfigInputDto } from '../../common/dto/product-config.dto';
import { PriceRuleScope } from '../../generated/client/enums';
import { PricingSnapshot } from '../../common/interfaces/snapshots.interface';
import { generateConfigCode } from '../../common/utils/hash.util';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateQuote(
    input: ProductConfigInputDto,
    scope: PriceRuleScope = PriceRuleScope.B2C,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      include: {
        attributes: true,
        pricingRules: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID ${input.productId} not found`,
      );
    }

    // Generate Config Code based on technical attributes
    const configCode = generateConfigCode({
      productId: input.productId,
      size: input.size,
      material: input.material,
      quality: input.quality,
      line: input.line,
      personalizations: input.personalizations?.map((p) => p.code).sort() || [],
    });

    const snapshot: PricingSnapshot = {
      version: '1.2',
      configCode,
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
      { type: 'SIZE', value: input.size },
      { type: 'MATERIAL', value: input.material },
      { type: 'QUALITY', value: input.quality },
      { type: 'LINE', value: input.line },
    ];

    for (const inputAttr of inputAttributes) {
      if (!inputAttr.value) continue;

      const matchingAttr = product.attributes.find(
        (a) => a.type === inputAttr.type && a.value === inputAttr.value,
      );

      if (matchingAttr) {
        unitPrice += matchingAttr.priceModifier;
        snapshot.attributeModifiers.push({
          type: inputAttr.type,
          name: inputAttr.value,
          modifier: matchingAttr.priceModifier,
        });
      }
    }

    // Personalization logic
    if (input.personalizations && input.personalizations.length > 0) {
      const personalizationCodes = input.personalizations.map((p) => p.code);
      const options = await this.prisma.personalizationOption.findMany({
        where: { code: { in: personalizationCodes }, isActive: true },
      });

      for (const p of input.personalizations) {
        const option = options.find((o) => o.code === p.code);
        if (option) {
          // Rule validation & Compatibility Check
          const rule = await this.prisma.personalizationRule.findFirst({
            where: {
              productId: product.id,
              personalizationId: option.id,
              isActive: true,
            },
          });

          if (!rule) {
            throw new BadRequestException(
              `La personalización '${option.name}' no está habilitada para este producto.`,
            );
          }

          // Check material compatibility if rule defines restricted materials
          if (
            rule.allowedMaterialValues &&
            rule.allowedMaterialValues.length > 0 &&
            !rule.allowedMaterialValues.includes(input.material)
          ) {
            throw new BadRequestException(
              `La técnica '${option.name}' no es compatible con el material '${input.material}'.`,
            );
          }

          const surcharge = option.basePrice + rule.extraPrice;
          unitPrice += surcharge;

          snapshot.personalizationSurcharges.push({
            code: p.code,
            surcharge: surcharge,
          });
        }
      }
    }

    // Applying PricingRules (B2C/B2B)
    const applicableRule = product.pricingRules
      .filter(
        (rule) =>
          rule.isActive &&
          rule.scope === scope &&
          input.quantity >= rule.minQty &&
          (!rule.maxQty || input.quantity <= rule.maxQty),
      )
      .sort((a, b) => b.minQty - a.minQty)[0];

    if (applicableRule) {
      if (applicableRule.fixedUnitPrice) {
        unitPrice = applicableRule.fixedUnitPrice;
      } else if (applicableRule.discountPct) {
        unitPrice = unitPrice * (1 - applicableRule.discountPct / 100);
      }

      snapshot.volumeDiscount = {
        minQuantity: applicableRule.minQty,
        percentage: applicableRule.discountPct || 0,
        amount: 0, // Calculated post-hoc if needed
      };
    }

    // REGLA DE ORO: Min Price Guard
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
