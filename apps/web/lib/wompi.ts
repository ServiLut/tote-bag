import crypto from 'crypto';

export type WompiWidgetStatus = 'loading' | 'ready' | 'unavailable';

export interface WompiEventSignature {
  checksum: string;
  properties: string[];
}

export interface WompiTransactionData {
  id: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
  amount_in_cents: number;
  reference: string;
  customer_email: string;
  payment_method_type: string;
  [key: string]: unknown;
}

export interface WompiWebhookPayload {
  event: string;
  data: {
    transaction: WompiTransactionData;
  };
  sent_at: string;
  timestamp: number;
  signature: WompiEventSignature;
  environment: 'prod' | 'test';
}

export function isWompiWidgetConstructor(
  widgetCheckout: unknown,
): widgetCheckout is new (...args: unknown[]) => unknown {
  return typeof widgetCheckout === 'function';
}

export function resolveWompiWidgetStatus(options: {
  scriptLoaded: boolean;
  scriptFailed: boolean;
  widgetCheckout: unknown;
}): WompiWidgetStatus {
  const { scriptLoaded, scriptFailed, widgetCheckout } = options;

  if (isWompiWidgetConstructor(widgetCheckout)) {
    return 'ready';
  }

  if (scriptFailed) {
    return 'unavailable';
  }

  if (!scriptLoaded) {
    return 'loading';
  }

  return 'unavailable';
}

/**
 * Generates the integrity signature for Wompi checkout (Frontend -> Gateway).
 * Concatenation of: reference + amountInCents + currency + secret
 */
export function generateWompiIntegritySignature(input: {
  reference: string;
  amountInCents: number;
  currency: string;
  integritySecret: string;
}): string {
  const message = `${input.reference}${input.amountInCents}${input.currency}${input.integritySecret}`;
  return crypto.createHash('sha256').update(message).digest('hex');
}

/**
 * Validates the checksum from a Wompi webhook event.
 * Concatenation of properties values + secret
 */
export function validateWompiEventChecksum(
  payload: WompiWebhookPayload,
  eventsSecret: string,
): boolean {
  const { signature, timestamp, data } = payload;
  if (!signature?.checksum || !signature?.properties) return false;

  const { transaction } = data;
  
  const values = signature.properties.map((prop: string) => {
    if (prop === 'timestamp') return timestamp;
    if (prop.startsWith('transaction.')) {
      const key = prop.split('.')[1] as keyof WompiTransactionData;
      return transaction[key];
    }
    return '';
  });

  const message = values.join('') + eventsSecret;
  const hash = crypto.createHash('sha256').update(message).digest('hex');

  return hash === signature.checksum;
}
