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

    // Fetch dynamic wizard options for modifiers
    const wizardOptions = await this.prisma.wizardOption.findMany({
      where: {
        isActive: true,
        OR: [
          { category: 'LINE', code: input.line },
          { category: 'DIMENSION', name: input.size },
          { category: 'MATERIAL', name: input.material },
          input.quality ? { category: 'QUALITY', name: input.quality } : undefined,
        ].filter(Boolean) as any,
      },
    });

    const inputAttributes = [
      { type: 'SIZE', value: input.size },
      { type: 'MATERIAL', value: input.material },
      { type: 'QUALITY', value: input.quality },
      { type: 'LINE', value: input.line },
    ];

    for (const inputAttr of inputAttributes) {
      if (!inputAttr.value) continue;

      // 1. Try to find product-specific attribute first
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
      } else {
        // 2. Fallback to global WizardOption modifier
        const globalOpt = wizardOptions.find((o) => 
          (o.category === inputAttr.type && (o.name === inputAttr.value || o.code === inputAttr.value)) ||
          (o.category === 'DIMENSION' && inputAttr.type === 'SIZE' && o.name === inputAttr.value)
        );

        if (globalOpt && globalOpt.basePriceModifier !== 0) {
          unitPrice += globalOpt.basePriceModifier;
          snapshot.attributeModifiers.push({
            type: inputAttr.type,
            name: inputAttr.value,
            modifier: globalOpt.basePriceModifier,
          });
        }
      }
    }

    // Personalization logic using both systems for compatibility
    if (input.personalizations && input.personalizations.length > 0) {
      const personalizationCodes = input.personalizations.map((p) => p.code);
      
      // Try both tables
      const [pOptions, wOptions] = await Promise.all([
        this.prisma.personalizationOption.findMany({
          where: { code: { in: personalizationCodes }, isActive: true },
        }),
        this.prisma.wizardOption.findMany({
          where: { category: 'TECHNIQUE', code: { in: personalizationCodes }, isActive: true },
        })
      ]);

      for (const p of input.personalizations) {
        const option = pOptions.find((o) => o.code === p.code);
        const wizardOpt = wOptions.find((o) => o.code === p.code);

        if (option) {
          // Legacy logic for PersonalizationOption
          const rule = await this.prisma.personalizationRule.findFirst({
            where: {
              productId: product.id,
              personalizationId: option.id,
              isActive: true,
            },
          });

          if (rule) {
            const effectiveAllowedMaterials =
              rule.allowedMaterialValues && rule.allowedMaterialValues.length > 0
                ? rule.allowedMaterialValues
                : option.allowedMaterialValues;

            if (
              !effectiveAllowedMaterials ||
              effectiveAllowedMaterials.length === 0 ||
              effectiveAllowedMaterials.includes(input.material)
            ) {
              const surcharge = option.basePrice + rule.extraPrice;
              unitPrice += surcharge;
              snapshot.personalizationSurcharges.push({
                code: p.code,
                surcharge: surcharge,
              });
            }
          }
        } else if (wizardOpt) {
          // Dynamic logic for WizardOption (TECHNIQUE)
          if (
            !wizardOpt.allowedMaterialValues ||
            wizardOpt.allowedMaterialValues.length === 0 ||
            wizardOpt.allowedMaterialValues.includes(input.material)
          ) {
            unitPrice += wizardOpt.basePriceModifier;
            snapshot.personalizationSurcharges.push({
              code: p.code,
              surcharge: wizardOpt.basePriceModifier,
            });
          }
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
