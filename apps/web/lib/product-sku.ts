export function normalizeSkuSegment(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function normalizeSkuValue(value: string) {
  return value
    .split('-')
    .map((segment) => normalizeSkuSegment(segment))
    .filter(Boolean)
    .join('-');
}

export function buildProductSku(
  collectionName: string,
  productName: string,
  color: string,
) {
  const collection = normalizeSkuSegment(collectionName);
  const product = normalizeSkuSegment(productName);
  const variantColor = normalizeSkuSegment(color);

  if (!collection || !product || !variantColor) {
    return '';
  }

  return `TB-${collection}-${product}-${variantColor}`;
}
