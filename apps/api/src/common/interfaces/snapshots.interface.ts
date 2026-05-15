export interface ConfigurationSnapshot {
  version: string;
  configCode: string;
  productId: string;
  variantId?: string;
  productName: string;
  line: string;
  size: string;
  material: string;
  quality?: string;
  customImageURL?: string;
  personalizations: Array<{
    code: string;
    options: string[];
  }>;
  timestamp: string;
}

export function normalizeSnapshotPersonalizations(
  personalizations: Array<{
    code: string;
    options?: string[];
  }>,
): ConfigurationSnapshot['personalizations'] {
  return personalizations.map((personalization) => ({
    code: personalization.code,
    options: personalization.options ?? [],
  }));
}

export interface PricingSnapshot {
  version: string;
  configCode: string;
  basePrice: number;
  variantId?: string;
  size?: string;
  attributeModifiers: Array<{
    type: string;
    name: string;
    modifier: number;
  }>;
  personalizationSurcharges: Array<{
    code: string;
    surcharge: number;
  }>;
  volumeDiscount?: {
    minQuantity: number;
    percentage: number;
    amount: number;
  };
  manualDiscount?: {
    requestedPercentage: number;
    requestedAmount: number;
    appliedPercentage: number;
    appliedAmount: number;
  };
  minPriceGuardApplied: boolean;
  finalUnitPrice: number;
  quantity: number;
  totalPrice: number;
  currency: string;
  timestamp: string;
}
