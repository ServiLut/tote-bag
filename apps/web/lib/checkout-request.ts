export type CheckoutRequestShippingMethod = 'SHIPPING' | 'PICKUP';

export interface CheckoutRequestConfiguration {
  productId: string;
  variantId: string;
  line: string;
  size: string;
  material: string;
  quality?: string;
  customImageURL?: string;
  quantity: number;
  personalizations: {
    code: string;
    options: string[];
  }[];
}

export interface CheckoutRequestPayload {
  firstName: string;
  lastName: string;
  customerEmail: string;
  customerPhone: string;
  shippingMethod: CheckoutRequestShippingMethod;
  department?: string;
  city?: string;
  isB2B: boolean;
  shippingAddress?: {
    city: string;
    address: string;
    phone: string;
  };
  items: {
    productId: string;
    variantId: string;
    sku: string;
    quantity: number;
    configuration?: CheckoutRequestConfiguration;
  }[];
}

export interface CheckoutIdempotencyRecord {
  fingerprint: string;
  key: string;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableSerialize(entryValue)}`,
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function buildCheckoutRequestFingerprint(
  payload: CheckoutRequestPayload,
) {
  const normalizedItems = [...payload.items].sort((left, right) =>
    [
      left.variantId,
      left.productId,
      left.sku,
      stableSerialize(left.configuration),
    ]
      .join('|')
      .localeCompare(
        [
          right.variantId,
          right.productId,
          right.sku,
          stableSerialize(right.configuration),
        ].join('|'),
      ),
  );

  return stableSerialize({
    ...payload,
    customerEmail: payload.customerEmail.trim().toLowerCase(),
    customerPhone: payload.customerPhone.trim(),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    department: payload.department?.trim(),
    city: payload.city?.trim(),
    shippingAddress: payload.shippingAddress
      ? {
          city: payload.shippingAddress.city.trim(),
          address: payload.shippingAddress.address.trim(),
          phone: payload.shippingAddress.phone.trim(),
        }
      : undefined,
    items: normalizedItems,
  });
}

export function createCheckoutIdempotencyKey() {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveCheckoutIdempotencyRecord(
  currentRecord: CheckoutIdempotencyRecord | null,
  payload: CheckoutRequestPayload,
  createKey: () => string = createCheckoutIdempotencyKey,
): CheckoutIdempotencyRecord {
  const fingerprint = buildCheckoutRequestFingerprint(payload);

  if (currentRecord?.fingerprint === fingerprint) {
    return currentRecord;
  }

  return {
    fingerprint,
    key: createKey(),
  };
}
