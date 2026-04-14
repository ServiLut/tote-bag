import {
  calculateSalesTaxBreakdown,
  calculateSalesTaxFromNet,
} from './sales-tax.util';

describe('sales tax utilities', () => {
  it('calculates Colombian IVA from gross PVP with per-unit half-up rounding', () => {
    const breakdown = calculateSalesTaxBreakdown({
      grossUnitPrice: 37209,
      quantity: 2,
      taxRate: '0.19',
    });

    expect(breakdown.netUnitPrice.toNumber()).toBe(31268.07);
    expect(breakdown.grossLineTotal.toNumber()).toBe(74418);
    expect(breakdown.netLineTotal.toNumber()).toBe(62536.14);
    expect(breakdown.taxAmount.toNumber()).toBe(11881.86);
    expect(breakdown.netLineTotal.plus(breakdown.taxAmount).toNumber()).toBe(
      breakdown.grossLineTotal.toNumber(),
    );
  });

  it('calculates gross PVP from net price with half-up rounding', () => {
    const breakdown = calculateSalesTaxFromNet({
      netUnitPrice: 31268.07,
      taxRate: '0.19',
    });

    expect(breakdown.netUnitPrice.toNumber()).toBe(31268.07);
    expect(breakdown.grossUnitPrice.toNumber()).toBe(37209);
    expect(breakdown.taxAmount.toNumber()).toBe(5940.93);
  });

  it('preserves explicit zero tax rates', () => {
    const breakdown = calculateSalesTaxFromNet({
      netUnitPrice: 100,
      taxRate: 0,
    });

    expect(breakdown.grossUnitPrice.toNumber()).toBe(100);
    expect(breakdown.taxAmount.toNumber()).toBe(0);
  });
});
