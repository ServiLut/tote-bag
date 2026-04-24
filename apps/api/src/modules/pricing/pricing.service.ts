import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductConfigInputDto } from '../../common/dto/product-config.dto';
import {
  AttributeType,
  PriceRuleScope,
  WizardCategory,
} from '../../generated/client/enums';
import { PricingSnapshot } from '../../common/interfaces/snapshots.interface';
import { generateConfigCode } from '../../common/utils/hash.util';
import {
  calculateSalesTaxBreakdown,
  decimalToNumber,
  DecimalInput,
  roundMoney,
  toDecimal,
} from '../../common/utils/sales-tax.util';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeLabel(value?: string | null) {
    return value?.trim().toLowerCase() ?? '';
  }

  private isAllowedValue(allowedValues: string[], value?: string | null) {
    if (allowedValues.length === 0) {
      return true;
    }

    if (!value?.trim()) {
      return false;
    }

    return allowedValues.some(
      (allowedValue) =>
        this.normalizeLabel(allowedValue) === this.normalizeLabel(value),
    );
  }

  private getVariantCommercialPricing(
    variant: {
      salePrice: DecimalInput;
      minPrice: DecimalInput;
      taxRate?: DecimalInput;
    } | null,
    product: {
      basePrice: DecimalInput;
      minPrice: DecimalInput;
    },
  ) {
    if (!variant) {
      return {
        baseUnitPrice: product.basePrice,
        baseMinPrice: product.minPrice,
        taxRate: undefined,
      };
    }

    return {
      baseUnitPrice: variant.salePrice ?? product.basePrice,
      baseMinPrice: variant.minPrice ?? product.minPrice,
      taxRate: variant.taxRate,
    };
  }

  private async resolveCommercialVariant(input: ProductConfigInputDto) {
    if (input.variantId) {
      const variant = await this.prisma.variant.findUnique({
        where: { id: input.variantId },
      });

      if (!variant || variant.productId !== input.productId) {
        throw new BadRequestException(
          'La variante seleccionada no existe o no pertenece al producto.',
        );
      }

      if (!variant.isActive) {
        throw new BadRequestException(
          'La variante seleccionada no se encuentra activa para la venta.',
        );
      }

      return variant;
    }

    const activeVariants = await this.prisma.variant.findMany({
      where: {
        productId: input.productId,
        isActive: true,
      },
      orderBy: { salePrice: 'asc' },
    });

    if (activeVariants.length === 0) {
      return null;
    }

    if (input.size) {
      const matchedBySize = activeVariants.find(
        (variant) =>
          this.normalizeLabel(variant.size) === this.normalizeLabel(input.size),
      );

      if (matchedBySize) {
        return matchedBySize;
      }
    }

    if (activeVariants.length === 1) {
      return activeVariants[0];
    }

    const uniqueCommercialProfiles = new Set(
      activeVariants.map((variant) =>
        [
          variant.salePrice ?? 'null',
          variant.minPrice ?? 'null',
          variant.comparePrice ?? 'null',
          variant.costPrice ?? 'null',
          this.normalizeLabel(variant.size),
        ].join('::'),
      ),
    );

    if (uniqueCommercialProfiles.size > 1) {
      throw new BadRequestException(
        'Debes indicar una variante para cotizar un producto con variantes comerciales diferenciadas.',
      );
    }

    return activeVariants[0];
  }

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

    const variant = await this.resolveCommercialVariant(input);
    const effectiveSize = variant?.size ?? input.size ?? '';
    const { baseUnitPrice, baseMinPrice, taxRate } =
      this.getVariantCommercialPricing(variant, product);
    const baseUnitPriceDecimal =
      input.simulatedPvp !== undefined && input.simulatedPvp !== null
        ? toDecimal(input.simulatedPvp)
        : toDecimal(baseUnitPrice);
    const baseMinPriceDecimal = toDecimal(baseMinPrice);

    const configCode = generateConfigCode({
      productId: input.productId,
      variantId: variant?.id ?? input.variantId ?? null,
      size: effectiveSize,
      material: input.material,
      quality: input.quality,
      line: input.line,
      personalizations: input.personalizations?.map((p) => p.code).sort() || [],
    });

    const snapshot: PricingSnapshot = {
      version: '2.0',
      configCode,
      variantId: variant?.id ?? input.variantId ?? undefined,
      size: effectiveSize || undefined,
      basePrice: decimalToNumber(baseUnitPriceDecimal),
      attributeModifiers: [],
      personalizationSurcharges: [],
      minPriceGuardApplied: false,
      finalUnitPrice: 0,
      quantity: input.quantity,
      totalPrice: 0,
      currency: 'COP',
      timestamp: new Date().toISOString(),
    };

    let unitPrice = baseUnitPriceDecimal;

    const wizardOptions = await this.prisma.wizardOption.findMany({
      where: {
        isActive: true,
        OR: [
          { category: WizardCategory.LINE, code: input.line },
          { category: WizardCategory.MATERIAL, name: input.material },
          ...(input.quality
            ? [{ category: WizardCategory.QUALITY, name: input.quality }]
            : []),
        ],
      },
    });

    const inputAttributes = [
      { type: AttributeType.MATERIAL, value: input.material },
      { type: AttributeType.QUALITY, value: input.quality },
      { type: AttributeType.LINE, value: input.line },
    ];

    for (const inputAttribute of inputAttributes) {
      if (!inputAttribute.value) continue;

      const matchingAttr = product.attributes.find(
        (attribute) =>
          attribute.type === inputAttribute.type &&
          attribute.value === inputAttribute.value,
      );

      if (matchingAttr) {
        unitPrice = unitPrice.plus(toDecimal(matchingAttr.priceModifier));
        snapshot.attributeModifiers.push({
          type: inputAttribute.type,
          name: inputAttribute.value,
          modifier: decimalToNumber(matchingAttr.priceModifier),
        });
        continue;
      }

      const globalOption = wizardOptions.find(
        (option) =>
          (option.category === inputAttribute.type &&
            (option.name === inputAttribute.value ||
              option.code === inputAttribute.value)) ||
          (option.category === WizardCategory.LINE &&
            inputAttribute.type === AttributeType.LINE &&
            option.code === inputAttribute.value),
      );

      if (globalOption && !toDecimal(globalOption.basePriceModifier).isZero()) {
        unitPrice = unitPrice.plus(toDecimal(globalOption.basePriceModifier));
        snapshot.attributeModifiers.push({
          type: inputAttribute.type,
          name: inputAttribute.value,
          modifier: decimalToNumber(globalOption.basePriceModifier),
        });
      }
    }

    if (input.personalizations && input.personalizations.length > 0) {
      const personalizationCodes = input.personalizations.map((p) => p.code);

      const [personalizationOptions, wizardPersonalizations] =
        await Promise.all([
          this.prisma.personalizationOption.findMany({
            where: { code: { in: personalizationCodes }, isActive: true },
          }),
          this.prisma.wizardOption.findMany({
            where: {
              category: WizardCategory.TECHNIQUE,
              code: { in: personalizationCodes },
              isActive: true,
            },
          }),
        ]);
      const personalizationRules =
        await this.prisma.personalizationRule.findMany({
          where: {
            productId: product.id,
            personalizationId: {
              in: personalizationOptions.map((option) => option.id),
            },
            isActive: true,
          },
        });

      for (const personalization of input.personalizations) {
        const option = personalizationOptions.find(
          (candidate) => candidate.code === personalization.code,
        );
        const wizardOption = wizardPersonalizations.find(
          (candidate) => candidate.code === personalization.code,
        );

        if (option) {
          const rule = personalizationRules.find(
            (candidate) => candidate.personalizationId === option.id,
          );

          if (!rule) {
            throw new BadRequestException(
              `La configuracion ${personalization.code} no esta habilitada para este producto.`,
            );
          }

          const effectiveAllowedMaterials =
            rule.allowedMaterialValues.length > 0
              ? rule.allowedMaterialValues
              : option.allowedMaterialValues;

          if (!this.isAllowedValue(effectiveAllowedMaterials, input.material)) {
            throw new BadRequestException(
              `La configuracion ${personalization.code} no aplica al material seleccionado.`,
            );
          }

          if (!this.isAllowedValue(rule.allowedSizeValues, effectiveSize)) {
            throw new BadRequestException(
              `La configuracion ${personalization.code} no aplica al tamano seleccionado.`,
            );
          }

          if (!this.isAllowedValue(rule.allowedQualityValues, input.quality)) {
            throw new BadRequestException(
              `La configuracion ${personalization.code} no aplica a la calidad seleccionada.`,
            );
          }

          const surcharge = toDecimal(option.basePrice).plus(
            toDecimal(rule.extraPrice),
          );
          unitPrice = unitPrice.plus(surcharge);
          snapshot.personalizationSurcharges.push({
            code: personalization.code,
            surcharge: decimalToNumber(surcharge),
          });
          continue;
        }

        if (!wizardOption) {
          throw new BadRequestException(
            `La configuracion ${personalization.code} no existe o no esta activa.`,
          );
        }

        if (
          !this.isAllowedValue(
            wizardOption.allowedMaterialValues,
            input.material,
          )
        ) {
          throw new BadRequestException(
            `La configuracion ${personalization.code} no aplica al material seleccionado.`,
          );
        }

        unitPrice = unitPrice.plus(toDecimal(wizardOption.basePriceModifier));
        snapshot.personalizationSurcharges.push({
          code: personalization.code,
          surcharge: decimalToNumber(wizardOption.basePriceModifier),
        });
      }
    }

    const applicableRule = product.pricingRules
      .filter(
        (rule) =>
          rule.isActive &&
          rule.scope === scope &&
          input.quantity >= rule.minQty &&
          (!rule.maxQty || input.quantity <= rule.maxQty),
      )
      .sort((left, right) => right.minQty - left.minQty)[0];

    if (applicableRule) {
      if (
        applicableRule.fixedUnitPrice !== null &&
        applicableRule.fixedUnitPrice !== undefined
      ) {
        unitPrice = toDecimal(applicableRule.fixedUnitPrice);
      } else if (
        applicableRule.discountPct !== null &&
        applicableRule.discountPct !== undefined
      ) {
        unitPrice = unitPrice.mul(
          new Decimal(1).minus(toDecimal(applicableRule.discountPct).div(100)),
        );
      }

      snapshot.volumeDiscount = {
        minQuantity: applicableRule.minQty,
        percentage: applicableRule.discountPct || 0,
        amount: 0,
      };
    }

    if (unitPrice.lessThan(baseMinPriceDecimal)) {
      unitPrice = baseMinPriceDecimal;
      snapshot.minPriceGuardApplied = true;
    }

    const finalUnitPrice = roundMoney(unitPrice);
    const total = roundMoney(finalUnitPrice.mul(input.quantity));
    const taxBreakdown = calculateSalesTaxBreakdown({
      grossUnitPrice: finalUnitPrice,
      quantity: input.quantity,
      taxRate,
    });
    snapshot.finalUnitPrice = decimalToNumber(finalUnitPrice);
    snapshot.totalPrice = decimalToNumber(total);

    return {
      unitPrice: decimalToNumber(finalUnitPrice),
      quantity: input.quantity,
      total: decimalToNumber(total),
      taxRate: toDecimal(taxBreakdown.taxRate).toNumber(),
      netUnitPrice: decimalToNumber(taxBreakdown.netUnitPrice),
      taxAmount: decimalToNumber(taxBreakdown.taxAmount),
      currency: 'COP',
      snapshot: {
        ...snapshot,
      },
    };
  }
}
