import crypto from 'crypto';
import { validateWompiEventChecksum, WompiWebhookPayload } from '../wompi';

describe('Wompi Webhook Idempotency & Validation logic', () => {
  const secret = 'webhook_secret';

  const mockPayload: WompiWebhookPayload = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: 'TX-123',
        status: 'APPROVED',
        amount_in_cents: 50000,
        reference: 'ORDER-999',
        customer_email: 'customer@test.com',
        payment_method_type: 'CARD'
      }
    },
    sent_at: '2023-05-19T10:00:00Z',
    timestamp: 1684490400,
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents', 'timestamp'],
      checksum: ''
    },
    environment: 'test'
  };

  beforeAll(() => {
    const message = 'TX-123' + 'APPROVED' + '50000' + '1684490400' + secret;
    mockPayload.signature.checksum = crypto.createHash('sha256').update(message).digest('hex');
  });

  it('correctly validates a valid webhook payload', () => {
    expect(validateWompiEventChecksum(mockPayload, secret)).toBe(true);
  });

  it('fails validation if any property is tampered with', () => {
    const tampered = JSON.parse(JSON.stringify(mockPayload)) as WompiWebhookPayload;
    tampered.data.transaction.status = 'DECLINED';
    expect(validateWompiEventChecksum(tampered, secret)).toBe(false);
  });
});
