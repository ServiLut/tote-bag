import { PriceRuleScope } from '../../generated/client/enums';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const prisma = {
    product: {
      findUnique: jest.fn(),
    },
    variant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    wizardOption: {
      findMany: jest.fn(),
    },
    personalizationOption: {
      findMany: jest.fn(),
    },
    personalizationRule: {
      findMany: jest.fn(),
    },
  };

  let service: PricingService;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.product.findUnique.mockResolvedValue({
      id: 'product-1',
      basePrice: 100000,
      minPrice: 80000,
      attributes: [],
      pricingRules: [],
    });

    prisma.variant.findUnique.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      isActive: true,
      size: 'M',
      salePrice: 120000,
      minPrice: 90000,
      comparePrice: null,
      costPrice: null,
      taxRate: 0.19,
    });

    prisma.variant.findMany.mockResolvedValue([]);
    prisma.wizardOption.findMany.mockResolvedValue([]);
    prisma.personalizationOption.findMany.mockResolvedValue([]);
    prisma.personalizationRule.findMany.mockResolvedValue([]);

    service = new PricingService(prisma as never);
  });

  it('uses simulatedPvp only for the quote calculation base price', async () => {
    const result = await service.calculateQuote(
      {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 50,
        line: 'BASICA',
        material: 'Lona',
        simulatedPvp: 150000,
      },
      PriceRuleScope.B2B,
    );

    expect(result.unitPrice).toBe(150000);
    expect(result.total).toBe(7500000);
    expect(result.netTotal).toBe(6302521);
    expect(result.snapshot).toMatchObject({
      basePrice: 150000,
      finalUnitPrice: 150000,
      minPriceGuardApplied: false,
    });
  });

  it('applies manual discount percentage to the quoted unit price', async () => {
    const result = await service.calculateQuote(
      {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 50,
        line: 'BASICA',
        material: 'Lona',
        simulatedPvp: 150000,
        manualDiscountPct: 10,
      },
      PriceRuleScope.B2B,
    );

    expect(result.unitPrice).toBe(135000);
    expect(result.total).toBe(6750000);
    expect(result.netTotal).toBe(5672269);
    expect(result.snapshot).toMatchObject({
      basePrice: 150000,
      finalUnitPrice: 135000,
      manualDiscount: {
        requestedPercentage: 10,
        requestedAmount: 15000,
        appliedPercentage: 10,
        appliedAmount: 15000,
      },
      minPriceGuardApplied: false,
    });
  });

  it('reports effective manual discount when minimum price guard adjusts the final unit price', async () => {
    const result = await service.calculateQuote(
      {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 20,
        line: 'BASICA',
        material: 'Lona',
        simulatedPvp: 100000,
        manualDiscountPct: 20,
      },
      PriceRuleScope.B2B,
    );

    expect(result.unitPrice).toBe(90000);
    expect(result.snapshot).toMatchObject({
      finalUnitPrice: 90000,
      minPriceGuardApplied: true,
      manualDiscount: {
        requestedPercentage: 20,
        requestedAmount: 20000,
        appliedPercentage: 10,
        appliedAmount: 10000,
      },
    });
  });

  it('can bypass the minimum price guard for simulator-only quotes', async () => {
    const result = await service.calculateQuote(
      {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 100,
        line: 'BASICA',
        material: 'Lona',
        simulatedPvp: 55000,
        manualDiscountPct: 49,
        ignoreMinPriceGuard: true,
      },
      PriceRuleScope.B2B,
    );

    expect(result.unitPrice).toBe(28050);
    expect(result.total).toBe(2805000);
    expect(result.netTotal).toBe(2357143);
    expect(result.snapshot).toMatchObject({
      finalUnitPrice: 28050,
      minPriceGuardApplied: false,
      manualDiscount: {
        requestedPercentage: 49,
        requestedAmount: 26950,
        appliedPercentage: 49,
        appliedAmount: 26950,
      },
    });
  });
});
