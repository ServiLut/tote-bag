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
    expect(result.snapshot).toMatchObject({
      basePrice: 150000,
      finalUnitPrice: 150000,
      minPriceGuardApplied: false,
    });
  });
});
