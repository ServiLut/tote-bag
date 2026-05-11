import {
  buildCheckoutRequestFingerprint,
  resolveCheckoutIdempotencyRecord,
  type CheckoutRequestPayload,
} from '../checkout-request';

function createPayload(): CheckoutRequestPayload {
  return {
    firstName: 'Deybis',
    lastName: 'Asprilla',
    customerEmail: 'Demo@Tote.com ',
    customerPhone: '+57 300 123 4567',
    shippingMethod: 'SHIPPING',
    department: 'Antioquia',
    city: 'Medellin',
    isB2B: false,
    shippingAddress: {
      city: 'Medellin',
      address: 'Calle 1 # 2-3',
      phone: '+57 300 123 4567',
    },
    items: [
      {
        productId: 'prod-2',
        variantId: 'variant-2',
        sku: 'SKU-2',
        quantity: 1,
      },
      {
        productId: 'prod-1',
        variantId: 'variant-1',
        sku: 'SKU-1',
        quantity: 2,
        configuration: {
          productId: 'prod-1',
          variantId: 'variant-1',
          line: 'premium',
          size: 'M',
          material: 'algodon',
          quantity: 2,
          personalizations: [
            {
              code: 'logo',
              options: ['front'],
            },
          ],
        },
      },
    ],
  };
}

describe('checkout request helpers', () => {
  it('genera el mismo fingerprint para el mismo payload aunque cambie el orden de items', () => {
    const payload = createPayload();
    const reorderedPayload: CheckoutRequestPayload = {
      ...payload,
      items: [...payload.items].reverse(),
    };

    expect(buildCheckoutRequestFingerprint(payload)).toBe(
      buildCheckoutRequestFingerprint(reorderedPayload),
    );
  });

  it('reutiliza la misma llave de idempotencia cuando el payload no cambia', () => {
    const payload = createPayload();
    const createKey = jest
      .fn()
      .mockReturnValueOnce('idem-1')
      .mockReturnValueOnce('idem-2');

    const firstRecord = resolveCheckoutIdempotencyRecord(null, payload, createKey);
    const secondRecord = resolveCheckoutIdempotencyRecord(
      firstRecord,
      createPayload(),
      createKey,
    );

    expect(firstRecord.key).toBe('idem-1');
    expect(secondRecord).toEqual(firstRecord);
    expect(createKey).toHaveBeenCalledTimes(1);
  });

  it('genera una nueva llave de idempotencia cuando cambia el payload', () => {
    const payload = createPayload();
    const createKey = jest
      .fn()
      .mockReturnValueOnce('idem-1')
      .mockReturnValueOnce('idem-2');

    const firstRecord = resolveCheckoutIdempotencyRecord(null, payload, createKey);
    const updatedPayload: CheckoutRequestPayload = {
      ...payload,
      shippingMethod: 'PICKUP',
      department: undefined,
      city: undefined,
      shippingAddress: undefined,
    };

    const secondRecord = resolveCheckoutIdempotencyRecord(
      firstRecord,
      updatedPayload,
      createKey,
    );

    expect(secondRecord.key).toBe('idem-2');
    expect(secondRecord.fingerprint).not.toBe(firstRecord.fingerprint);
    expect(createKey).toHaveBeenCalledTimes(2);
  });
});
