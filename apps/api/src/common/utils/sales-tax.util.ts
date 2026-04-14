import Decimal from 'decimal.js';

export const DEFAULT_COLOMBIA_IVA_RATE = new Decimal('0.19');

export type DecimalInput =
  | Decimal.Value
  | { toString(): string }
  | null
  | undefined;

export function toDecimal(value: DecimalInput, fallback = '0') {
  if (value === null || value === undefined) {
    return new Decimal(fallback);
  }

  if (Decimal.isDecimal(value)) {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Decimal(value) : new Decimal(fallback);
  }

  return new Decimal(value.toString());
}

export function roundMoney(value: DecimalInput) {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function decimalToNumber(value: DecimalInput) {
  return roundMoney(value).toNumber();
}

function resolveTaxRate(value: DecimalInput) {
  return value === null || value === undefined
    ? DEFAULT_COLOMBIA_IVA_RATE
    : toDecimal(value);
}

export function calculateSalesTaxBreakdown(input: {
  grossUnitPrice: DecimalInput;
  quantity: number;
  taxRate?: DecimalInput;
}) {
  const taxRate = resolveTaxRate(input.taxRate);
  const divisor = new Decimal(1).plus(taxRate);
  const grossUnitPrice = roundMoney(input.grossUnitPrice);
  const quantity = new Decimal(input.quantity);

  // IVA is rounded per unit first, then multiplied by quantity for the line.
  const netUnitPrice = roundMoney(grossUnitPrice.div(divisor));
  const grossLineTotal = roundMoney(grossUnitPrice.mul(quantity));
  const netLineTotal = roundMoney(netUnitPrice.mul(quantity));
  const taxAmount = roundMoney(grossLineTotal.minus(netLineTotal));

  return {
    taxRate,
    grossUnitPrice,
    netUnitPrice,
    unitTax: roundMoney(grossUnitPrice.minus(netUnitPrice)),
    grossLineTotal,
    netLineTotal,
    taxAmount,
  };
}

export function calculateSalesTaxFromNet(input: {
  netUnitPrice: DecimalInput;
  taxRate?: DecimalInput;
}) {
  const taxRate = resolveTaxRate(input.taxRate);
  const netUnitPrice = roundMoney(input.netUnitPrice);
  const grossUnitPrice = roundMoney(
    netUnitPrice.mul(new Decimal(1).plus(taxRate)),
  );
  const taxAmount = roundMoney(grossUnitPrice.minus(netUnitPrice));

  return {
    taxRate,
    grossUnitPrice,
    netUnitPrice,
    taxAmount,
  };
}

export function calculateGrossTaxBreakdown(input: {
  grossAmount: DecimalInput;
  taxRate?: DecimalInput;
}) {
  const taxRate = resolveTaxRate(input.taxRate);
  const grossAmount = roundMoney(input.grossAmount);
  const netAmount = roundMoney(grossAmount.div(new Decimal(1).plus(taxRate)));
  const taxAmount = roundMoney(grossAmount.minus(netAmount));

  return {
    grossAmount,
    netAmount,
    taxAmount,
    taxRate,
  };
}
