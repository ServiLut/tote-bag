import {
  createCurrencyInputState,
  formatCurrencyInput,
  normalizeCurrencyInput,
  normalizeTaxRateValue,
  parseCurrencyInput,
  sanitizeDecimalInput,
} from '../numeric-input';

describe('numeric input helpers', () => {
  it('mantiene mascara de miles para enteros', () => {
    expect(formatCurrencyInput('1234567')).toBe('1.234.567');
    expect(createCurrencyInputState(1234567).formattedValue).toBe('1.234.567');
  });

  it('preserva decimales localizados', () => {
    expect(normalizeCurrencyInput('1234,5')).toBe('1234,5');
    expect(formatCurrencyInput('1234,5')).toBe('1.234,5');
    expect(parseCurrencyInput('1.234,5')).toBe(1234.5);
  });

  it('sanitiza entradas con separadores mezclados sin perder valor', () => {
    expect(sanitizeDecimalInput('$ 12.345,67')).toBe('12345,67');
    expect(createCurrencyInputState('$ 12.345,67')).toEqual({
      formattedValue: '12.345,67',
      normalizedValue: '12345,67',
      numericValue: 12345.67,
    });
  });

  it('normaliza tarifas IVA a fraccion decimal', () => {
    expect(normalizeTaxRateValue('0.19')).toBe(0.19);
    expect(normalizeTaxRateValue('0,19')).toBe(0.19);
    expect(normalizeTaxRateValue('19%')).toBe(0.19);
    expect(normalizeTaxRateValue(19)).toBe(0.19);
  });
});
