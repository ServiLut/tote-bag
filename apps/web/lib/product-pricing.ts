import type { Product, Variant } from '@/types/product';

export function coercePrice(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function getVariantPrice(variant?: Pick<Variant, 'price'> | null): number {
  return coercePrice(variant?.price);
}

export function getDefaultVariant(variants: Variant[] = []): Variant | null {
  if (variants.length === 0) {
    return null;
  }

  return [...variants].sort((left, right) => {
    const priceDiff = getVariantPrice(left) - getVariantPrice(right);
    if (priceDiff !== 0) {
      return priceDiff;
    }

    return left.sku.localeCompare(right.sku);
  })[0] ?? null;
}

export function getProductPriceRange(product: Pick<Product, 'variants' | 'priceFrom'>) {
  const prices = product.variants.map((variant) => getVariantPrice(variant)).filter((price) => price > 0);

  if (prices.length === 0) {
    const fallback = coercePrice(product.priceFrom);
    return {
      min: fallback,
      max: fallback,
    };
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

export function getProductDisplayPrice(product: Pick<Product, 'variants' | 'priceFrom'>): number {
  return getVariantPrice(getDefaultVariant(product.variants)) || getProductPriceRange(product).min;
}
