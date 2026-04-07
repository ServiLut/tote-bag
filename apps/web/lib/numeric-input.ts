import type * as React from 'react';

const INTEGER_REGEX = /^\d*$/;
const THOUSANDS_FORMATTER = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
});

export interface CurrencyInputState {
  formattedValue: string;
  normalizedValue: string;
  numericValue: number;
}

function stripLeadingZeros(value: string) {
  const normalized = value.replace(/^0+(?=\d)/, '');
  return normalized;
}

function formatThousands(value: string) {
  if (!value) {
    return '';
  }

  return THOUSANDS_FORMATTER.format(Number(value));
}

function getCleanNumericValue(value: string) {
  return value.replace(/\./g, '').replace(/,/g, '.');
}

function extractCurrencyParts(value: string) {
  const sanitized = value.replace(/[^\d.,]/g, '');

  if (!sanitized) {
    return {
      integerDigits: '',
      decimalDigits: '',
      hasDecimal: false,
      hasTrailingDecimalSeparator: false,
    };
  }

  const lastCommaIndex = sanitized.lastIndexOf(',');
  const lastDotIndex = sanitized.lastIndexOf('.');
  const separatorIndex = Math.max(lastCommaIndex, lastDotIndex);
  const separator = separatorIndex >= 0 ? sanitized[separatorIndex] : null;
  const digitsAfterSeparator =
    separatorIndex >= 0 ? sanitized.slice(separatorIndex + 1).replace(/\D/g, '') : '';
  const dotAsThousandsOnly = /^\d{1,3}(\.\d{3})+$/.test(sanitized);
  const shouldKeepDecimalSeparator =
    separator !== null &&
    !(
      separator === '.' &&
      dotAsThousandsOnly &&
      digitsAfterSeparator.length === 3 &&
      !sanitized.endsWith('.')
    ) &&
    (sanitized.endsWith(separator) || digitsAfterSeparator.length <= 2 || separator === ',');

  const integerSource = shouldKeepDecimalSeparator
    ? sanitized.slice(0, separatorIndex)
    : sanitized;
  const integerDigits = stripLeadingZeros(integerSource.replace(/[^\d]/g, ''));

  if (!shouldKeepDecimalSeparator) {
    return {
      integerDigits,
      decimalDigits: '',
      hasDecimal: false,
      hasTrailingDecimalSeparator: false,
    };
  }

  return {
    integerDigits: integerDigits || '0',
    decimalDigits: digitsAfterSeparator.slice(0, 2),
    hasDecimal: true,
    hasTrailingDecimalSeparator: sanitized.endsWith(separator) && digitsAfterSeparator.length === 0,
  };
}

export function normalizeCurrencyInput(value: string) {
  const { integerDigits, decimalDigits, hasDecimal, hasTrailingDecimalSeparator } =
    extractCurrencyParts(value);

  if (!integerDigits && !hasDecimal) {
    return '';
  }

  if (!hasDecimal) {
    return integerDigits;
  }

  if (hasTrailingDecimalSeparator && decimalDigits.length === 0) {
    return `${integerDigits},`;
  }

  return decimalDigits.length > 0 ? `${integerDigits},${decimalDigits}` : integerDigits;
}

export function formatCurrencyInput(value: string) {
  const normalized = normalizeCurrencyInput(value);

  if (!normalized) {
    return '';
  }

  const hasDecimal = normalized.includes(',');
  const [integerPart, decimalPart = ''] = normalized.split(',');
  const formattedInteger = formatThousands(integerPart || '0');

  if (!hasDecimal) {
    return formattedInteger;
  }

  if (normalized.endsWith(',') && decimalPart.length === 0) {
    return `${formattedInteger},`;
  }

  return `${formattedInteger},${decimalPart}`;
}

export function parseCurrencyInput(value: string) {
  const normalized = normalizeCurrencyInput(value);

  if (!normalized) {
    return 0;
  }

  const parsed = Number(getCleanNumericValue(normalized));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function serializeCurrencyInput(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return normalizeCurrencyInput(String(value));
}

function getPositionAfterDigits(value: string, digitsCount: number) {
  if (digitsCount <= 0) {
    return 0;
  }

  let digitsSeen = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      digitsSeen += 1;
    }

    if (digitsSeen === digitsCount) {
      return index + 1;
    }
  }

  return value.length;
}

export function getCurrencyCaretPosition(formattedValue: string, rawBeforeCaret: string) {
  if (!rawBeforeCaret) {
    return 0;
  }

  if (rawBeforeCaret.includes(',')) {
    const [integerPart, decimalPart = ''] = rawBeforeCaret.split(',');
    const integerDigits = integerPart.replace(/\D/g, '').length;
    const separatorIndex = formattedValue.indexOf(',');

    if (separatorIndex === -1) {
      return getPositionAfterDigits(formattedValue, integerDigits);
    }

    return Math.min(separatorIndex + 1 + decimalPart.length, formattedValue.length);
  }

  const digitsCount = rawBeforeCaret.replace(/\D/g, '').length;
  return getPositionAfterDigits(formattedValue, digitsCount);
}

function getCurrencyInputState(value: string): CurrencyInputState {
  const normalizedValue = normalizeCurrencyInput(value);

  return {
    formattedValue: formatCurrencyInput(normalizedValue),
    normalizedValue,
    numericValue: parseCurrencyInput(normalizedValue),
  };
}

export function createCurrencyInputState(value: number | string | null | undefined): CurrencyInputState {
  const serializedValue = serializeCurrencyInput(value);
  return getCurrencyInputState(serializedValue);
}

export function handleCurrencyInputChange(
  event: React.ChangeEvent<HTMLInputElement>,
  onValueChange: (value: string) => void,
) {
  const input = event.target;
  const cursor = input.selectionStart ?? input.value.length;
  const rawBeforeCaret = normalizeCurrencyInput(input.value.slice(0, cursor));
  const nextInputState = getCurrencyInputState(input.value);
  const nextFormattedValue = nextInputState.formattedValue;
  const nextCursor = getCurrencyCaretPosition(nextFormattedValue, rawBeforeCaret);

  onValueChange(nextInputState.normalizedValue);

  requestAnimationFrame(() => {
    if (document.activeElement === input) {
      input.setSelectionRange(nextCursor, nextCursor);
    }
  });
}

export function handleCurrencyInputChangeWithState(
  event: React.ChangeEvent<HTMLInputElement>,
  onValueChange: (value: CurrencyInputState) => void,
) {
  const input = event.target;
  const cursor = input.selectionStart ?? input.value.length;
  const rawBeforeCaret = normalizeCurrencyInput(input.value.slice(0, cursor));
  const nextInputState = getCurrencyInputState(input.value);
  const nextCursor = getCurrencyCaretPosition(nextInputState.formattedValue, rawBeforeCaret);

  onValueChange(nextInputState);

  requestAnimationFrame(() => {
    if (document.activeElement === input) {
      input.setSelectionRange(nextCursor, nextCursor);
    }
  });
}

export function sanitizeIntegerInput(value: string) {
  const normalizedValue = value.replace(/\D+/g, '');

  if (normalizedValue === '') {
    return '';
  }

  if (!INTEGER_REGEX.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

export function parseLocalizedNumber(value: string) {
  return parseCurrencyInput(value);
}

export function sanitizeDecimalInput(value: string) {
  return normalizeCurrencyInput(value);
}
