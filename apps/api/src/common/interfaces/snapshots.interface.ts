export interface ConfigurationSnapshot {
  version: string;
  configCode: string;
  productId: string;
  productName: string;
  line: string;
  size: string;
  material: string;
  quality?: string;
  personalizations: Array<{
    code: string;
    options: string[];
  }>;
  timestamp: string;
}

export interface PricingSnapshot {
  version: string;
  configCode: string;
  basePrice: number;
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
  minPriceGuardApplied: boolean;
  finalUnitPrice: number;
  quantity: number;
  totalPrice: number;
  currency: string;
  timestamp: string;
}
