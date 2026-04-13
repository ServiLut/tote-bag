import { calculateSalesTaxBreakdown } from './sales-tax.util';

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
});
