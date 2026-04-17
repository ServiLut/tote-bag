import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProductAttributeDto,
  CreateProductDto,
  CreatePricingRuleDto,
  CreateVariantDto,
} from './dto/create-product.dto';
import { Product, Prisma } from '../../generated/client/client';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  AttributeType,
  BatchStatus,
  ProductStatus,
} from '../../generated/client/enums';
import {
  calculateSalesTaxFromNet,
  calculateSalesTaxBreakdown,
  decimalToNumber,
  DecimalInput,
  roundMoney,
  toDecimal,
} from '../../common/utils/sales-tax.util';

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    variants: true;
    images: true;
    collection: true;
    attributes: true;
    pricingRules: true;
  };
}>;

type ProductVariantWithFinancialBreakdown =
  ProductWithRelations['variants'][number] & {
    price: number | null;
    netSalePrice: number | null;
    netPrice: number | null;
    taxAmount: number | null;
    marginPercentage: number | null;
  };

export type ProductWithCalculatedVariantPricing = Omit<
  ProductWithRelations,
  'variants'
> & {
  variants: ProductVariantWithFinancialBreakdown[];
};

export interface CatalogSearchSuggestion {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  collection: {
    name: string;
  } | null;
  images: {
    url: string;
    alt: string | null;
  }[];
}

type PreparedVariant = {
  id?: string;
  sku: string;
  size?: string;
  color: string;
  imageUrl: string;
  salePrice: number;
  netPrice?: number;
  minPrice: number;
  comparePrice?: number;
  costPrice?: number;
  totalCost?: number;
  taxRate?: number;
  stock: number;
  isActive: boolean;
};

type ProductCommercialSnapshot = {
  basePrice: number;
  minPrice: number;
  comparePrice?: number;
  costPrice?: number;
};

type PreparedPricingRule = {
  scope: CreatePricingRuleDto['scope'];
  minQty: number;
  maxQty?: number;
  discountPct?: number;
  fixedUnitPrice?: number;
  isActive: boolean;
};

type ResolvedCollection = {
  id: string;
  name: string;
};

type CatalogFilters = {
  collectionId?: string;
  line?: string;
  size?: string;
  quality?: string;
  material?: string;
  status?: string;
  isCustomizable?: boolean;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
};

type PublicVariant = {
  id: string;
  sku: string;
  size: string | null;
  color: string;
  imageUrl: string;
  salePrice: number | null;
  comparePrice: number | null;
  stock: number;
  isActive: boolean;
};

type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  comparePrice: number | null;
  status: ProductStatus;
  collectionId: string;
  collection: ProductWithRelations['collection'];
  images: ProductWithRelations['images'];
  tags: string[];
  deliveryTime: string;
  material: string;
  dimensions: string | null;
  careInstructions: string | null;
  printType: ProductWithRelations['printType'];
  seoTitle: string | null;
  seoDescription: string | null;
  variants: PublicVariant[];
  attributes: ProductWithRelations['attributes'];
  pricingRules: ProductWithRelations['pricingRules'];
};

@Injectable()
export class CatalogService {
  private readonly CACHE_KEY = 'products_list';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private normalizeLabel(value?: string | null) {
    return value?.trim().toLowerCase() ?? '';
  }

  private normalizeSkuToken(value?: string | null) {
    return (
      value
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '')
        .toUpperCase() ?? ''
    );
  }

  private splitFilterValues(value?: string) {
    return (
      value
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean) ?? []
    );
  }

  private buildAutomaticSku(
    productName: string,
    collectionName: string,
    variant: { size?: string; color: string },
  ) {
    const tokens = [
      'TB',
      this.normalizeSkuToken(collectionName) || 'COL',
      this.normalizeSkuToken(productName) || 'PROD',
    ];

    const normalizedSize = this.normalizeSkuToken(variant.size);
    if (normalizedSize) {
      tokens.push(normalizedSize);
    }

    tokens.push(this.normalizeSkuToken(variant.color) || 'BASE');

    return tokens.join('-');
  }

  private async generateUniqueSku(
    tx: Prisma.TransactionClient,
    baseSku: string,
    reservedSkus: Set<string>,
    currentVariantId?: string,
  ) {
    let attempt = 0;

    while (true) {
      const candidate = attempt === 0 ? baseSku : `${baseSku}-${attempt + 1}`;
      const normalizedCandidate = this.normalizeLabel(candidate);

      if (reservedSkus.has(normalizedCandidate)) {
        attempt += 1;
        continue;
      }

      const existing = await tx.variant.findFirst({
        where: {
          sku: {
            equals: candidate,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (!existing || existing.id === currentVariantId) {
        reservedSkus.add(normalizedCandidate);
        return candidate;
      }

      attempt += 1;
    }
  }

  private async assignAutomaticSkus(
    tx: Prisma.TransactionClient,
    variants: PreparedVariant[],
    productName: string,
    collectionName: string,
  ) {
    const reservedSkus = new Set<string>();

    return Promise.all(
      variants.map(async (variant) => {
        const baseSku = this.buildAutomaticSku(
          productName,
          collectionName,
          variant,
        );

        return {
          ...variant,
          sku: await this.generateUniqueSku(
            tx,
            baseSku,
            reservedSkus,
            variant.id,
          ),
        };
      }),
    );
  }

  private buildVariantCombinationKey(variant: {
    size?: string | null;
    color: string;
  }) {
    return [
      this.normalizeLabel(variant.size),
      this.normalizeLabel(variant.color),
    ].join('::');
  }

  private hasVariantBasedSizing(
    variants: PreparedVariant[],
    attributes?: CreateProductAttributeDto[],
  ) {
    return (
      variants.some((variant) => !!variant.size) ||
      (attributes ?? []).some(
        (attribute) => attribute.type === AttributeType.SIZE,
      )
    );
  }

  private calculateVariantPricePreview(input: {
    netPrice: DecimalInput;
    taxRate?: DecimalInput;
    costPrice?: DecimalInput;
    totalCost?: DecimalInput;
  }) {
    const netPrice = roundMoney(input.netPrice);
    const taxRate =
      input.taxRate === null || input.taxRate === undefined
        ? undefined
        : toDecimal(input.taxRate);

    if (netPrice.lessThanOrEqualTo(0)) {
      throw new BadRequestException('La venta neta debe ser mayor a 0.');
    }

    if (taxRate && taxRate.lessThan(0)) {
      throw new BadRequestException('La tarifa IVA no puede ser negativa.');
    }

    if (taxRate && taxRate.greaterThan(1)) {
      throw new BadRequestException('La tarifa IVA debe estar entre 0 y 1.');
    }

    if (input.costPrice !== null && input.costPrice !== undefined) {
      const costPrice = toDecimal(input.costPrice);
      if (costPrice.lessThan(0)) {
        throw new BadRequestException(
          'El costo unitario no puede ser negativo.',
        );
      }
    }

    if (input.totalCost !== null && input.totalCost !== undefined) {
      const totalCost = toDecimal(input.totalCost);
      if (totalCost.lessThan(0)) {
        throw new BadRequestException('El costo total no puede ser negativo.');
      }
    }

    const taxBreakdown = calculateSalesTaxFromNet({
      netUnitPrice: netPrice,
      taxRate,
    });

    const marginCost = input.totalCost ?? input.costPrice;
    const marginPercentage =
      marginCost === null || marginCost === undefined
        ? null
        : decimalToNumber(
            roundMoney(
              taxBreakdown.netUnitPrice
                .minus(toDecimal(marginCost))
                .div(taxBreakdown.netUnitPrice)
                .mul(new Decimal(100)),
            ),
          );

    const grossPrice = decimalToNumber(taxBreakdown.grossUnitPrice);

    return {
      netPrice: decimalToNumber(taxBreakdown.netUnitPrice),
      price: grossPrice,
      salePrice: grossPrice,
      taxAmount: decimalToNumber(taxBreakdown.taxAmount),
      marginPercentage,
      taxRate: taxBreakdown.taxRate.toNumber(),
    };
  }

  previewVariantPrice(input: {
    netPrice: DecimalInput;
    taxRate?: DecimalInput;
    costPrice?: DecimalInput;
    totalCost?: DecimalInput;
  }) {
    return this.calculateVariantPricePreview(input);
  }

  private resolveVariantSalePrice(variant: CreateVariantDto) {
    if (variant.netPrice !== undefined && variant.netPrice !== null) {
      return this.calculateVariantPricePreview({
        netPrice: variant.netPrice,
        taxRate: variant.taxRate,
        costPrice: variant.costPrice,
        totalCost: variant.totalCost,
      }).salePrice;
    }

    if (variant.salePrice === undefined || variant.salePrice === null) {
      throw new BadRequestException(
        `La variante ${variant.sku || variant.color || 'sin SKU'} debe incluir venta neta o precio de venta.`,
      );
    }

    return variant.salePrice;
  }

  private prepareVariants(variants: CreateVariantDto[]) {
    if (!variants.length) {
      throw new BadRequestException(
        'Debes registrar al menos una variante vendible.',
      );
    }

    return variants.map((variant) => {
      const salePrice = this.resolveVariantSalePrice(variant);

      return {
        id: variant.id?.trim() || undefined,
        sku: variant.sku?.trim() || '',
        size: variant.size?.trim() || undefined,
        color: variant.color.trim(),
        imageUrl: variant.imageUrl.trim(),
        salePrice,
        netPrice: variant.netPrice,
        minPrice: variant.minPrice,
        comparePrice: variant.comparePrice,
        costPrice: variant.costPrice,
        totalCost: variant.totalCost,
        taxRate: variant.taxRate,
        stock: variant.stock ?? 0,
        isActive: variant.isActive ?? true,
      };
    });
  }

  private calculateVariantFinancialBreakdown(variant: {
    salePrice: number | null;
    costPrice?: number | null;
    totalCost?: number | null;
    taxRate?: DecimalInput;
  }) {
    if (variant.salePrice === null || variant.salePrice === undefined) {
      return {
        price: null,
        netSalePrice: null,
        netPrice: null,
        taxAmount: null,
        marginPercentage: null,
      };
    }

    const taxBreakdown = calculateSalesTaxBreakdown({
      grossUnitPrice: variant.salePrice,
      quantity: 1,
      taxRate: variant.taxRate,
    });
    const netPrice = taxBreakdown.netUnitPrice;
    const taxAmount = taxBreakdown.taxAmount;

    let marginPercentage: number | null = null;
    const marginCost = variant.totalCost ?? variant.costPrice;
    if (marginCost !== null && marginCost !== undefined) {
      marginPercentage = netPrice.isZero()
        ? // Zero net revenue cannot express a meaningful percentage margin.
          0
        : decimalToNumber(
            roundMoney(
              netPrice
                .minus(toDecimal(marginCost))
                .div(netPrice)
                .mul(new Decimal(100)),
            ),
          );
    }

    return {
      price: variant.salePrice,
      netSalePrice: decimalToNumber(netPrice),
      netPrice: decimalToNumber(netPrice),
      taxAmount: decimalToNumber(taxAmount),
      marginPercentage,
    };
  }

  private withCalculatedVariantPricing<T extends ProductWithRelations>(
    product: T,
  ): Omit<T, 'variants'> & {
    variants: ProductVariantWithFinancialBreakdown[];
  } {
    return {
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        ...this.calculateVariantFinancialBreakdown(variant),
      })),
    };
  }

  private toPublicVariant(variant: {
    id: string;
    sku: string;
    size: string | null;
    color: string;
    imageUrl: string;
    salePrice: number | null;
    comparePrice: number | null;
    stock: number;
    isActive: boolean;
  }): PublicVariant {
    return {
      id: variant.id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      imageUrl: variant.imageUrl,
      salePrice: variant.salePrice,
      comparePrice: variant.comparePrice,
      stock: variant.stock,
      isActive: variant.isActive,
    };
  }

  private toPublicProduct(
    product: ProductWithCalculatedVariantPricing,
  ): PublicProduct {
    const publicVariants = product.variants
      .filter((variant) => variant.isActive)
      .map((variant) => this.toPublicVariant(variant));
    const referenceVariant =
      publicVariants
        .filter((variant) => typeof variant.salePrice === 'number')
        .sort(
          (left, right) => (left.salePrice ?? 0) - (right.salePrice ?? 0),
        )[0] ?? publicVariants[0];

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: referenceVariant?.salePrice ?? product.basePrice,
      comparePrice: referenceVariant?.comparePrice ?? product.comparePrice,
      status: product.status,
      collectionId: product.collectionId,
      collection: product.collection,
      images: product.images,
      tags: product.tags,
      deliveryTime: product.deliveryTime,
      material: product.material,
      dimensions: product.dimensions,
      careInstructions: product.careInstructions,
      printType: product.printType,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      variants: publicVariants,
      attributes: product.attributes.filter((attribute) => attribute.isActive),
      pricingRules: product.pricingRules.filter((rule) => rule.isActive),
    };
  }

  private preparePricingRules(rules?: CreatePricingRuleDto[]) {
    return (rules ?? []).map((rule) => ({
      scope: rule.scope,
      minQty: rule.minQty,
      maxQty: rule.maxQty,
      discountPct: rule.discountPct,
      fixedUnitPrice: rule.fixedUnitPrice,
      isActive: rule.isActive ?? true,
    }));
  }

  private validateVariants(
    variants: PreparedVariant[],
    attributes?: CreateProductAttributeDto[],
  ) {
    const duplicateSkuCheck = new Set<string>();
    const duplicateCombinationCheck = new Set<string>();
    const requiresSize = this.hasVariantBasedSizing(variants, attributes);

    for (const variant of variants) {
      if (!variant.sku) {
        throw new BadRequestException('Cada variante debe tener SKU.');
      }

      if (!variant.color) {
        throw new BadRequestException('Cada variante debe tener color.');
      }

      if (!variant.imageUrl) {
        throw new BadRequestException('Cada variante debe tener imagen.');
      }

      if (requiresSize && !variant.size) {
        throw new BadRequestException(
          'El tamaño es obligatorio cuando el producto maneja variantes por tamaño.',
        );
      }

      if (variant.costPrice === undefined) {
        throw new BadRequestException(
          `La variante ${variant.sku} debe incluir costo unitario.`,
        );
      }

      if (variant.costPrice < 0) {
        throw new BadRequestException(
          `El costo de la variante ${variant.sku} no puede ser negativo.`,
        );
      }

      if (variant.totalCost !== undefined && variant.totalCost < 0) {
        throw new BadRequestException(
          `El costo total de la variante ${variant.sku} no puede ser negativo.`,
        );
      }

      if (variant.netPrice !== undefined && variant.netPrice <= 0) {
        throw new BadRequestException(
          `La venta neta de la variante ${variant.sku} debe ser mayor a 0.`,
        );
      }

      if (variant.salePrice < 0) {
        throw new BadRequestException(
          `El precio de venta de la variante ${variant.sku} no puede ser negativo.`,
        );
      }

      if (
        variant.taxRate !== undefined &&
        (variant.taxRate < 0 || variant.taxRate > 1)
      ) {
        throw new BadRequestException(
          `La tarifa IVA de la variante ${variant.sku} debe estar entre 0 y 1.`,
        );
      }

      if (variant.minPrice < 0) {
        throw new BadRequestException(
          `El precio minimo de la variante ${variant.sku} no puede ser negativo.`,
        );
      }

      if (variant.minPrice > variant.salePrice) {
        throw new BadRequestException(
          `El precio minimo de la variante ${variant.sku} no puede superar su precio de venta.`,
        );
      }

      if (
        variant.comparePrice !== undefined &&
        variant.comparePrice < variant.salePrice
      ) {
        throw new BadRequestException(
          `El precio compare/tachado de la variante ${variant.sku} no puede ser menor al precio de venta.`,
        );
      }

      const normalizedSku = this.normalizeLabel(variant.sku);
      if (duplicateSkuCheck.has(normalizedSku)) {
        throw new BadRequestException(
          `SKU duplicado en el payload: ${variant.sku}.`,
        );
      }
      duplicateSkuCheck.add(normalizedSku);

      const duplicateKey = this.buildVariantCombinationKey(variant);

      if (variant.isActive) {
        if (duplicateCombinationCheck.has(duplicateKey)) {
          throw new BadRequestException(
            `No se permiten variantes activas duplicadas con la misma combinacion size/color (${variant.size || 'sin-size'} / ${variant.color}).`,
          );
        }
        duplicateCombinationCheck.add(duplicateKey);
      }
    }
  }

  private validatePricingRules(rules: PreparedPricingRule[]) {
    if (!rules.length) {
      return;
    }

    const duplicateRuleCheck = new Set<string>();

    for (const rule of rules) {
      if (rule.maxQty !== undefined && rule.maxQty < rule.minQty) {
        throw new BadRequestException(
          `La regla ${rule.scope} con minimo ${rule.minQty} no puede tener maximo menor al minimo.`,
        );
      }

      if (rule.discountPct === undefined && rule.fixedUnitPrice === undefined) {
        throw new BadRequestException(
          `La regla ${rule.scope} con minimo ${rule.minQty} debe definir descuento o precio fijo.`,
        );
      }

      if (rule.discountPct !== undefined && rule.fixedUnitPrice !== undefined) {
        throw new BadRequestException(
          `La regla ${rule.scope} con minimo ${rule.minQty} no puede mezclar descuento porcentual y precio fijo.`,
        );
      }

      const duplicateKey = [
        rule.scope,
        rule.minQty,
        rule.maxQty ?? 'open',
      ].join('::');

      if (duplicateRuleCheck.has(duplicateKey)) {
        throw new BadRequestException(
          `La regla ${rule.scope} con minimo ${rule.minQty} esta duplicada.`,
        );
      }

      duplicateRuleCheck.add(duplicateKey);
    }
  }

  private async assertSkuAvailability(
    tx: Prisma.TransactionClient,
    variants: PreparedVariant[],
    currentProductId?: string,
  ) {
    if (!variants.length) {
      return;
    }

    const existingMatches = await tx.variant.findMany({
      where: {
        OR: variants.map((variant) => ({
          sku: {
            equals: variant.sku,
            mode: 'insensitive',
          },
        })),
      },
      select: {
        id: true,
        sku: true,
        productId: true,
      },
    });

    const currentProductVariants = currentProductId
      ? await tx.variant.findMany({
          where: { productId: currentProductId },
          select: { id: true, sku: true },
        })
      : [];

    const currentProductVariantIdBySku = new Map(
      currentProductVariants.map((variant) => [
        this.normalizeLabel(variant.sku),
        variant.id,
      ]),
    );

    for (const existing of existingMatches) {
      const normalizedSku = this.normalizeLabel(existing.sku);
      const incomingVariant = variants.find(
        (variant) => this.normalizeLabel(variant.sku) === normalizedSku,
      );

      const belongsToCurrentProduct =
        !!incomingVariant &&
        !!currentProductId &&
        existing.productId === currentProductId &&
        (incomingVariant.id === existing.id ||
          (!incomingVariant.id &&
            currentProductVariantIdBySku.get(normalizedSku) === existing.id));

      if (!belongsToCurrentProduct) {
        throw new BadRequestException(
          `El SKU ${existing.sku} ya existe y no puede reutilizarse.`,
        );
      }
    }
  }

  private assertVariantCombinationAvailability(
    currentVariants: Array<{
      id: string;
      sku: string;
      size: string | null;
      color: string;
      isActive: boolean;
    }>,
    variants: PreparedVariant[],
  ) {
    const currentVariantById = new Map(
      currentVariants.map((variant) => [variant.id, variant]),
    );
    const currentVariantBySku = new Map(
      currentVariants.map((variant) => [
        this.normalizeLabel(variant.sku),
        variant,
      ]),
    );
    const projectedVariants = new Map<
      string,
      {
        id: string;
        sku: string;
        size: string | null;
        color: string;
        isActive: boolean;
      }
    >();
    const matchedCurrentVariantIds = new Set<string>();

    for (const currentVariant of currentVariants) {
      if (currentVariant.isActive) {
        projectedVariants.set(currentVariant.id, currentVariant);
      }
    }

    variants.forEach((variant, index) => {
      const existingVariant = variant.id
        ? currentVariantById.get(variant.id)
        : currentVariantBySku.get(this.normalizeLabel(variant.sku));

      if (existingVariant) {
        matchedCurrentVariantIds.add(existingVariant.id);
        projectedVariants.set(existingVariant.id, {
          ...existingVariant,
          sku: variant.sku,
          size: variant.size ?? null,
          color: variant.color,
          isActive: variant.isActive,
        });
        return;
      }

      projectedVariants.set(`new-${index}`, {
        id: `new-${index}`,
        sku: variant.sku,
        size: variant.size ?? null,
        color: variant.color,
        isActive: variant.isActive,
      });
    });

    for (const currentVariant of currentVariants) {
      if (!matchedCurrentVariantIds.has(currentVariant.id)) {
        projectedVariants.delete(currentVariant.id);
      }
    }

    const activeCombinationCheck = new Set<string>();

    for (const variant of projectedVariants.values()) {
      if (!variant.isActive) {
        continue;
      }

      const duplicateKey = this.buildVariantCombinationKey(variant);
      if (activeCombinationCheck.has(duplicateKey)) {
        throw new BadRequestException(
          `Ya existe una variante activa para ${variant.size || 'sin-size'} / ${variant.color}.`,
        );
      }

      activeCombinationCheck.add(duplicateKey);
    }
  }

  private mapCatalogWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const duplicateTargetMeta = error.meta?.target;
      const duplicateTarget = Array.isArray(duplicateTargetMeta)
        ? duplicateTargetMeta.join('::').toLowerCase()
        : typeof duplicateTargetMeta === 'string'
          ? duplicateTargetMeta.toLowerCase()
          : error.message.toLowerCase();

      if (duplicateTarget.includes('sku')) {
        throw new BadRequestException(
          'No fue posible generar un SKU unico para la variante. Ajusta nombre, coleccion, tamano o color.',
        );
      }

      throw new BadRequestException(
        'Ya existe una variante con la misma combinacion de atributos. Revisa tamano y color.',
      );
    }

    throw error;
  }

  private sanitizeAttributes(
    attributes: CreateProductAttributeDto[] | undefined,
    variants: PreparedVariant[],
  ) {
    if (!attributes?.length) {
      return [];
    }

    const usesVariantSizing = this.hasVariantBasedSizing(variants, attributes);

    return attributes
      .filter((attribute) => {
        if (attribute.type !== AttributeType.SIZE) {
          return true;
        }

        if (attribute.priceModifier !== 0) {
          throw new BadRequestException(
            'Tamaño no puede seguir modelado como atributo configurable con modificador de precio.',
          );
        }

        return !usesVariantSizing;
      })
      .map((attribute, index) => ({
        ...attribute,
        value: attribute.value.trim(),
        sortOrder: attribute.sortOrder ?? index,
        isActive: attribute.isActive ?? true,
      }));
  }

  private getProductCommercialSnapshot(
    variants: PreparedVariant[],
    fallback?: Partial<ProductCommercialSnapshot>,
  ): ProductCommercialSnapshot {
    // Keep product-level pricing only as a compatibility snapshot for older
    // consumers. Variant pricing remains the operational source of truth.
    const sourceVariants = variants.filter((variant) => variant.isActive);
    const ordered = (
      sourceVariants.length > 0 ? sourceVariants : variants
    ).sort((left, right) => left.salePrice - right.salePrice);
    const referenceVariant = ordered[0];

    return {
      basePrice: referenceVariant?.salePrice ?? fallback?.basePrice ?? 0,
      minPrice: referenceVariant?.minPrice ?? fallback?.minPrice ?? 0,
      comparePrice:
        referenceVariant?.comparePrice ?? fallback?.comparePrice ?? undefined,
      costPrice:
        referenceVariant?.costPrice ?? fallback?.costPrice ?? undefined,
    };
  }

  private getReferencePrice(product: {
    basePrice: number;
    variants: Array<{ salePrice: number | null; isActive: boolean }>;
  }) {
    const activeVariantPrice = product.variants
      .filter((variant) => variant.isActive && variant.salePrice !== null)
      .map((variant) => variant.salePrice as number)
      .sort((left, right) => left - right)[0];

    return activeVariantPrice ?? product.basePrice;
  }

  private buildLegacySizeFilter(values: string[]): Prisma.ProductWhereInput {
    return {
      AND: [
        {
          NOT: {
            variants: {
              some: {
                isActive: true,
                size: { not: null },
              },
            },
          },
        },
        {
          attributes: {
            some: { type: 'SIZE', value: { in: values, mode: 'insensitive' } },
          },
        },
      ],
    };
  }

  private async resolveCollection(input: {
    collectionId?: string;
    collectionName?: string;
  }): Promise<ResolvedCollection> {
    const { collectionId, collectionName } = input;

    if (collectionId) {
      const collection = await this.prisma.collection.findUnique({
        where: { id: collectionId },
      });

      if (!collection) {
        throw new NotFoundException(
          `Collection with ID ${collectionId} not found`,
        );
      }

      return collection;
    }

    if (!collectionName) {
      throw new BadRequestException(
        'Either collectionId or collectionName is required',
      );
    }

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

    return {
      id: collection.id,
      name: collection.name,
    };
  }

  private async hasHistoricalReferences(productId: string) {
    const [
      orderItemsCount,
      b2bQuoteItemsCount,
      purchaseBatchesCount,
      personalizationRequestsCount,
    ] = await this.prisma.$transaction([
      this.prisma.orderItem.count({
        where: { productId },
      }),
      this.prisma.b2BQuoteItem.count({
        where: { productId },
      }),
      this.prisma.purchaseBatch.count({
        where: { productId },
      }),
      this.prisma.personalizationRequest.count({
        where: { productId },
      }),
    ]);

    return (
      orderItemsCount > 0 ||
      b2bQuoteItemsCount > 0 ||
      purchaseBatchesCount > 0 ||
      personalizationRequestsCount > 0
    );
  }

  private async hasActiveInventory(productId: string) {
    const [activeBatchesCount, variantsWithStockCount] = await Promise.all([
      this.prisma.purchaseBatch.count({
        where: {
          productId,
          status: BatchStatus.IN_STOCK,
          quantityRemaining: { gt: 0 },
        },
      }),
      this.prisma.variant.count({
        where: {
          productId,
          stock: { gt: 0 },
        },
      }),
    ]);

    return activeBatchesCount > 0 || variantsWithStockCount > 0;
  }

  private async assertVariantsCanBeDeactivated(
    tx: Prisma.TransactionClient,
    variantIds: string[],
  ) {
    if (!variantIds.length) {
      return;
    }

    const [variantsWithStock, activeBatches] = await Promise.all([
      tx.variant.findMany({
        where: {
          id: { in: variantIds },
          stock: { gt: 0 },
        },
        select: {
          sku: true,
        },
      }),
      tx.purchaseBatch.findMany({
        where: {
          variantId: { in: variantIds },
          status: BatchStatus.IN_STOCK,
          quantityRemaining: { gt: 0 },
        },
        select: {
          variant: {
            select: {
              sku: true,
            },
          },
        },
      }),
    ]);

    const blockedSkus = Array.from(
      new Set([
        ...variantsWithStock.map((variant) => variant.sku),
        ...activeBatches
          .map((batch) => batch.variant?.sku)
          .filter((sku): sku is string => !!sku),
      ]),
    );

    if (blockedSkus.length > 0) {
      throw new BadRequestException(
        `No puedes desactivar variantes con stock activo: ${blockedSkus.join(', ')}.`,
      );
    }
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductWithCalculatedVariantPricing> {
    const {
      variants,
      images,
      attributes,
      pricingRules,
      collectionId,
      collectionName,
      basePrice,
      minPrice,
      comparePrice,
      costPrice,
      ...data
    } = updateProductDto;

    const activeCollection =
      collectionId || collectionName
        ? await this.resolveCollection({ collectionId, collectionName })
        : undefined;

    const preparedVariants = variants
      ? this.prepareVariants(variants)
      : undefined;
    const preparedPricingRules = this.preparePricingRules(pricingRules);
    const sanitizedAttributes = preparedVariants
      ? this.sanitizeAttributes(attributes, preparedVariants)
      : (attributes ?? []).map((attribute, index) => ({
          ...attribute,
          value: attribute.value.trim(),
          sortOrder: attribute.sortOrder ?? index,
          isActive: attribute.isActive ?? true,
        }));

    this.validatePricingRules(preparedPricingRules);

    const commercialSnapshot = preparedVariants
      ? this.getProductCommercialSnapshot(preparedVariants, {
          basePrice,
          minPrice,
          comparePrice,
          costPrice,
        })
      : undefined;

    const updateData: Prisma.ProductUpdateInput = {
      ...data,
      ...(activeCollection && { collectionId: activeCollection.id }),
      ...(commercialSnapshot ?? {}),
    };

    if (images) {
      updateData.images = {
        deleteMany: {},
        create: images.map((image) => ({
          url: image.url,
          alt: image.alt,
          position: image.position,
        })),
      };
    }

    if (attributes) {
      updateData.attributes = {
        deleteMany: {},
        create: sanitizedAttributes.map((attribute) => ({
          type: attribute.type,
          value: attribute.value,
          priceModifier: attribute.priceModifier,
          sortOrder: attribute.sortOrder,
          isActive: attribute.isActive,
        })),
      };
    }

    if (pricingRules) {
      updateData.pricingRules = {
        deleteMany: {},
        create: preparedPricingRules.map((rule) => ({
          scope: rule.scope,
          minQty: rule.minQty,
          maxQty: rule.maxQty,
          discountPct: rule.discountPct,
          fixedUnitPrice: rule.fixedUnitPrice,
          isActive: rule.isActive ?? true,
        })),
      };
    }

    try {
      const updatedProduct = await this.prisma.$transaction(async (tx) => {
        if (preparedVariants) {
          const currentProduct = await tx.product.findUnique({
            where: { id },
            select: {
              id: true,
              name: true,
              collection: {
                select: {
                  name: true,
                },
              },
            },
          });

          if (!currentProduct) {
            throw new NotFoundException(`Product with ID ${id} not found`);
          }

          const generatedVariants = await this.assignAutomaticSkus(
            tx,
            preparedVariants,
            data.name?.trim() || currentProduct.name,
            activeCollection?.name || currentProduct.collection?.name || 'COL',
          );

          this.validateVariants(generatedVariants, attributes);
          await this.assertSkuAvailability(tx, generatedVariants, id);

          const currentVariants = await tx.variant.findMany({
            where: { productId: id },
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              isActive: true,
            },
          });
          this.assertVariantCombinationAvailability(
            currentVariants,
            generatedVariants,
          );

          const currentVariantById = new Map(
            currentVariants.map((variant) => [variant.id, variant]),
          );
          const currentVariantBySku = new Map(
            currentVariants.map((variant) => [
              this.normalizeLabel(variant.sku),
              variant,
            ]),
          );
          const matchedCurrentVariantIds = new Set<string>();

          for (const variant of generatedVariants) {
            if (variant.id && !currentVariantById.has(variant.id)) {
              throw new BadRequestException(
                `La variante ${variant.id} no pertenece al producto ${id}.`,
              );
            }

            const existingVariant = variant.id
              ? currentVariantById.get(variant.id)
              : currentVariantBySku.get(this.normalizeLabel(variant.sku));

            if (existingVariant) {
              matchedCurrentVariantIds.add(existingVariant.id);
            }
          }

          const variantsToDeactivate = currentVariants.filter(
            (variant) => !matchedCurrentVariantIds.has(variant.id),
          );

          const variantIdsToDeactivate = new Set(
            variantsToDeactivate
              .filter((variant) => variant.isActive)
              .map((variant) => variant.id),
          );

          for (const variant of generatedVariants) {
            const existingVariant = variant.id
              ? currentVariantById.get(variant.id)
              : currentVariantBySku.get(this.normalizeLabel(variant.sku));

            if (existingVariant?.isActive && !variant.isActive) {
              variantIdsToDeactivate.add(existingVariant.id);
            }
          }

          await this.assertVariantsCanBeDeactivated(
            tx,
            Array.from(variantIdsToDeactivate),
          );

          if (variantsToDeactivate.length > 0) {
            await tx.variant.updateMany({
              where: {
                id: { in: variantsToDeactivate.map((variant) => variant.id) },
              },
              data: { isActive: false },
            });
          }

          for (const variant of generatedVariants) {
            const existingVariant = variant.id
              ? currentVariantById.get(variant.id)
              : currentVariantBySku.get(this.normalizeLabel(variant.sku));

            if (existingVariant) {
              await tx.variant.update({
                where: { id: existingVariant.id },
                data: {
                  sku: variant.sku,
                  size: variant.size,
                  color: variant.color,
                  imageUrl: variant.imageUrl,
                  salePrice: variant.salePrice,
                  minPrice: variant.minPrice,
                  comparePrice: variant.comparePrice,
                  costPrice: variant.costPrice,
                  totalCost: variant.totalCost,
                  taxRate: variant.taxRate,
                  isActive: variant.isActive,
                },
              });
            } else {
              await tx.variant.create({
                data: {
                  productId: id,
                  sku: variant.sku,
                  size: variant.size,
                  color: variant.color,
                  imageUrl: variant.imageUrl,
                  salePrice: variant.salePrice,
                  minPrice: variant.minPrice,
                  comparePrice: variant.comparePrice,
                  costPrice: variant.costPrice,
                  totalCost: variant.totalCost,
                  taxRate: variant.taxRate,
                  stock: 0,
                  isActive: variant.isActive,
                },
              });
            }
          }
        }

        return tx.product.update({
          where: { id },
          data: updateData,
          include: {
            variants: true,
            images: true,
            collection: true,
            attributes: true,
            pricingRules: true,
          },
        });
      });

      await this.cacheManager.del(this.CACHE_KEY);
      return this.withCalculatedVariantPricing(updatedProduct);
    } catch (error: unknown) {
      this.mapCatalogWriteError(error);
    }
  }

  async remove(id: string): Promise<Product> {
    const hasActiveInventory = await this.hasActiveInventory(id);

    if (hasActiveInventory) {
      throw new BadRequestException(
        'No puedes eliminar ni ocultar un producto con stock activo. Traslada o agota sus lotes antes de retirarlo del catalogo.',
      );
    }

    const hasHistoricalReferences = await this.hasHistoricalReferences(id);

    let result: Product;
    if (hasHistoricalReferences) {
      result = await this.prisma.product.update({
        where: { id },
        data: { isActive: false, status: 'BAJO_PEDIDO' },
      });
    } else {
      result = await this.prisma.product.delete({
        where: { id },
      });
    }

    await this.cacheManager.del(this.CACHE_KEY);
    return result;
  }

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductWithCalculatedVariantPricing> {
    const {
      variants,
      collectionId,
      collectionName,
      images,
      attributes,
      pricingRules,
      basePrice,
      minPrice,
      comparePrice,
      costPrice,
      ...productData
    } = createProductDto;

    const activeCollection = await this.resolveCollection({
      collectionId,
      collectionName,
    });

    const preparedVariants = this.prepareVariants(variants);
    const preparedPricingRules = this.preparePricingRules(pricingRules);
    const sanitizedAttributes = this.sanitizeAttributes(
      attributes,
      preparedVariants,
    );
    this.validatePricingRules(preparedPricingRules);

    const commercialSnapshot = this.getProductCommercialSnapshot(
      preparedVariants,
      {
        basePrice,
        minPrice,
        comparePrice,
        costPrice,
      },
    );

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const generatedVariants = await this.assignAutomaticSkus(
          tx,
          preparedVariants,
          productData.name.trim(),
          activeCollection.name,
        );

        this.validateVariants(generatedVariants, attributes);
        await this.assertSkuAvailability(tx, generatedVariants);

        return tx.product.create({
          data: {
            ...productData,
            ...commercialSnapshot,
            collectionId: activeCollection.id,
            images: {
              create: images?.map((image) => ({
                url: image.url,
                alt: image.alt,
                position: image.position,
              })),
            },
            variants: {
              create: generatedVariants.map((variant) => ({
                sku: variant.sku,
                size: variant.size,
                color: variant.color,
                imageUrl: variant.imageUrl,
                salePrice: variant.salePrice,
                minPrice: variant.minPrice,
                comparePrice: variant.comparePrice,
                costPrice: variant.costPrice,
                totalCost: variant.totalCost,
                taxRate: variant.taxRate,
                stock: 0,
                isActive: variant.isActive,
              })),
            },
            attributes: {
              create: sanitizedAttributes.map((attribute) => ({
                type: attribute.type,
                value: attribute.value,
                priceModifier: attribute.priceModifier,
                sortOrder: attribute.sortOrder,
                isActive: attribute.isActive,
              })),
            },
            pricingRules: {
              create: preparedPricingRules.map((rule) => ({
                scope: rule.scope,
                minQty: rule.minQty,
                maxQty: rule.maxQty,
                discountPct: rule.discountPct,
                fixedUnitPrice: rule.fixedUnitPrice,
                isActive: rule.isActive ?? true,
              })),
            },
          },
          include: {
            variants: true,
            images: true,
            collection: true,
            attributes: true,
            pricingRules: true,
          },
        });
      });

      await this.cacheManager.del(this.CACHE_KEY);
      return this.withCalculatedVariantPricing(product);
    } catch (error: unknown) {
      console.error('Error creating product:', error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      try {
        this.mapCatalogWriteError(error);
      } catch (mappedError) {
        if (mappedError instanceof BadRequestException) {
          throw mappedError;
        }
      }

      throw new InternalServerErrorException('Failed to create product');
    }
  }

  async findAll(filters: CatalogFilters): Promise<PublicProduct[]> {
    const products = await this.findAllAdmin(filters);
    return products.map((product) => this.toPublicProduct(product));
  }

  async findAllAdmin(
    filters: CatalogFilters,
  ): Promise<ProductWithCalculatedVariantPricing[]> {
    const {
      collectionId,
      line,
      size,
      quality,
      material,
      status,
      isCustomizable,
      minPrice,
      maxPrice,
      search,
    } = filters;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (collectionId) {
      const collectionIds = this.splitFilterValues(collectionId);
      if (collectionIds.length > 0) {
        where.collectionId =
          collectionIds.length === 1 ? collectionIds[0] : { in: collectionIds };
      }
    }

    if (status) {
      where.status = status as ProductStatus;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search.toLowerCase(), search] } },
        {
          collection: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const andFilters: Prisma.ProductWhereInput[] = [];

    if (line) {
      const values = this.splitFilterValues(line);
      andFilters.push({
        attributes: {
          some: { type: 'LINE', value: { in: values, mode: 'insensitive' } },
        },
      });
    }

    if (size) {
      const values = this.splitFilterValues(size);
      andFilters.push({
        OR: [
          {
            variants: {
              some: {
                isActive: true,
                size: { in: values, mode: 'insensitive' },
              },
            },
          },
          this.buildLegacySizeFilter(values),
        ],
      });
    }

    if (quality) {
      const values = this.splitFilterValues(quality);
      andFilters.push({
        attributes: {
          some: { type: 'QUALITY', value: { in: values, mode: 'insensitive' } },
        },
      });
    }

    if (material) {
      const values = this.splitFilterValues(material);
      andFilters.push({
        attributes: {
          some: {
            type: 'MATERIAL',
            value: { in: values, mode: 'insensitive' },
          },
        },
      });
    }

    if (isCustomizable !== undefined) {
      // Reserved for future rule-based filtering.
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        variants: true,
        images: true,
        collection: true,
        attributes: true,
        pricingRules: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return products
      .filter((product) => {
        const referencePrice = this.getReferencePrice(product);
        if (minPrice !== undefined && referencePrice < minPrice) {
          return false;
        }
        if (maxPrice !== undefined && referencePrice > maxPrice) {
          return false;
        }
        return true;
      })
      .map((product) => this.withCalculatedVariantPricing(product));
  }

  async searchSuggestions(
    query: string,
    limit = 6,
  ): Promise<CatalogSearchSuggestion[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const take = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 1), 12)
      : 6;

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: trimmed, mode: 'insensitive' } },
          { description: { contains: trimmed, mode: 'insensitive' } },
          { slug: { contains: trimmed, mode: 'insensitive' } },
          { tags: { hasSome: [trimmed.toLowerCase(), trimmed] } },
          {
            collection: {
              name: { contains: trimmed, mode: 'insensitive' },
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        slug: true,
        name: true,
        basePrice: true,
        collection: {
          select: {
            name: true,
          },
        },
        variants: {
          where: { isActive: true },
          select: { salePrice: true },
          orderBy: { salePrice: 'asc' },
          take: 1,
        },
        images: {
          select: {
            url: true,
            alt: true,
          },
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });

    return products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      basePrice: product.variants[0]?.salePrice ?? product.basePrice,
      collection: product.collection,
      images: product.images,
    }));
  }

  async findOne(id: string): Promise<PublicProduct> {
    const product = await this.findOneAdmin(id);
    if (!product.isActive) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return this.toPublicProduct(product);
  }

  async findOneAdmin(id: string): Promise<ProductWithCalculatedVariantPricing> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        images: true,
        collection: true,
        attributes: true,
        pricingRules: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return this.withCalculatedVariantPricing(product);
  }

  async findBySlug(slug: string): Promise<PublicProduct> {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: {
        variants: true,
        images: true,
        collection: true,
        attributes: true,
        pricingRules: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }
    return this.toPublicProduct(this.withCalculatedVariantPricing(product));
  }

  async getProductConfig(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { salePrice: 'asc' },
        },
        attributes: { where: { isActive: true } },
        pricingRules: { where: { isActive: true } },
        personalizationRules: {
          include: { personalization: true },
          where: { isActive: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }

    const personalizations = await this.prisma.personalizationOption.findMany({
      where: { isActive: true },
    });

    const transformedGlobal = personalizations.map((personalization) => ({
      ...personalization,
      rule: { allowedMaterialValues: [] },
    }));

    const hasVariantSizes = product.variants.some((variant) => !!variant.size);
    const filteredAttributes = hasVariantSizes
      ? product.attributes.filter(
          (attribute) => attribute.type !== AttributeType.SIZE,
        )
      : product.attributes;

    return {
      productId: product.id,
      slug: product.slug,
      variants: product.variants.map((variant) =>
        this.toPublicVariant(variant),
      ),
      attributes: filteredAttributes,
      pricingRules: product.pricingRules,
      personalizationOptions:
        product.personalizationRules.length > 0
          ? product.personalizationRules.map((rule) => ({
              ...rule.personalization,
              rule,
            }))
          : transformedGlobal,
    };
  }
}
