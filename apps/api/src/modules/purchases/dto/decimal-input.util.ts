export function normalizeDecimalInput(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim().replace(/\s+/g, '');

  if (!trimmed) {
    return trimmed;
  }

  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');

  if (hasComma && hasDot) {
    const lastCommaIndex = trimmed.lastIndexOf(',');
    const lastDotIndex = trimmed.lastIndexOf('.');

    if (lastCommaIndex > lastDotIndex) {
      return trimmed.replace(/\./g, '').replace(',', '.');
    }

    return trimmed.replace(/,/g, '');
  }

  if (hasComma) {
    return trimmed.replace(',', '.');
  }

  return trimmed;
}
