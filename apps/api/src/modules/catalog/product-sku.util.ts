export function normalizeSkuSegment(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function buildProductSku(
  collectionName: string,
  productName: string,
  color: string,
) {
  const collectionSegment = normalizeSkuSegment(collectionName);
  const productSegment = normalizeSkuSegment(productName);
  const colorSegment = normalizeSkuSegment(color);

  if (!collectionSegment || !productSegment || !colorSegment) {
    return '';
  }

  return `TB-${collectionSegment}-${productSegment}-${colorSegment}`;
}

export function normalizeSkuValue(value: string) {
  return value
    .split('-')
    .map((segment) => normalizeSkuSegment(segment))
    .filter(Boolean)
    .join('-');
}
