export function parseLocalizedNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const cleaned = value.trim().replace(/\s+/g, '').replace(/\$/g, '');

  if (!cleaned) {
    return undefined;
  }

  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    const parsed = Number(cleaned.replace(/\./g, ''));
    return Number.isFinite(parsed) ? parsed : value;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : value;
}
