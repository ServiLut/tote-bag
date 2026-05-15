type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function normalizeTranslationToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function translateStoreValue(
  kind:
    | 'collection'
    | 'material'
    | 'color'
    | 'line'
    | 'size'
    | 'technique',
  value: string | null | undefined,
  t: TranslateFn,
) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return '';
  }

  const translationKey = `store_value_${kind}_${normalizeTranslationToken(normalizedValue)}`;
  const translatedValue = t(translationKey);

  return translatedValue === translationKey ? normalizedValue : translatedValue;
}

export function translateStoreText(
  prefix: 'store_value' | 'store_description' | 'store_label',
  kind: string,
  value: string | null | undefined,
  fallback: string,
  t: TranslateFn,
) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return fallback;
  }

  const translationKey = `${prefix}_${kind}_${normalizeTranslationToken(normalizedValue)}`;
  const translatedValue = t(translationKey);

  return translatedValue === translationKey ? fallback : translatedValue;
}

export function formatVariantSummary(
  size: string | null | undefined,
  color: string | null | undefined,
  t: TranslateFn,
) {
  const parts = [size?.trim(), translateStoreValue('color', color, t)].filter(Boolean);
  return parts.join(' / ');
}
