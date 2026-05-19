import crypto from 'crypto';
import { 
  validateWompiEventChecksum, 
  generateWompiIntegritySignature,
  WompiWebhookPayload
} from '../wompi';

describe('wompi signature validation', () => {
  const secret = 'test_secret';

  it('validates a correct event checksum', () => {
    const payload: WompiWebhookPayload = {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: '12345-1',
          status: 'APPROVED',
          amount_in_cents: 100000,
          reference: 'ORDER-123',
          customer_email: 'test@example.com',
          payment_method_type: 'CARD'
        }
      },
      sent_at: '2023-01-01T00:00:00.000Z',
      timestamp: 1672531200,
      signature: {
        properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents', 'timestamp'],
        checksum: '' // will calculate
      },
      environment: 'test'
    };

    // Calculate expected checksum
    // id + status + amount + timestamp + secret
    const message = '12345-1' + 'APPROVED' + '100000' + '1672531200' + secret;
    const expectedChecksum = crypto.createHash('sha256').update(message).digest('hex');
    payload.signature.checksum = expectedChecksum;

    expect(validateWompiEventChecksum(payload, secret)).toBe(true);
  });

  it('rejects an incorrect event checksum', () => {
    const payload: WompiWebhookPayload = {
      event: 'transaction.updated',
      data: { transaction: { id: '1', status: 'APPROVED', amount_in_cents: 100, reference: 'REF', customer_email: 'a@b.c', payment_method_type: 'CARD' } },
      sent_at: '2023',
      timestamp: 123,
      signature: {
        properties: ['transaction.id', 'timestamp'],
        checksum: 'wrong'
      },
      environment: 'test'
    };

    expect(validateWompiEventChecksum(payload, secret)).toBe(false);
  });

  it('generates a correct integrity signature', () => {
    const input = {
      reference: 'ORDER-123',
      amountInCents: 100000,
      currency: 'COP',
      integritySecret: 'integrity_secret'
    };

    // reference + amount + currency + secret
    const expected = crypto
      .createHash('sha256')
      .update('ORDER-123100000COPintegrity_secret')
      .digest('hex');

    expect(generateWompiIntegritySignature(input)).toBe(expected);
  });
});
