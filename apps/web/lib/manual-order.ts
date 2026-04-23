type VariantPricingInput = {
  salePrice?: number | null;
  minPrice?: number | null;
};

function normalizeMoney(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function getManualOrderUnitPrice(variant: VariantPricingInput) {
  return Math.max(
    normalizeMoney(variant.salePrice),
    normalizeMoney(variant.minPrice),
  );
}

export function getManualOrderContactPhone(
  shippingPhone?: string | null,
  profilePhone?: string | null,
) {
  const normalizedShippingPhone = shippingPhone?.trim();
  if (normalizedShippingPhone) {
    return normalizedShippingPhone;
  }

  return profilePhone?.trim() || '';
}
