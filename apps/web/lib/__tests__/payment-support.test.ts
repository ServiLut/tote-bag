import {
  extractSupportUrl,
  isDirectSupportUrl,
  resolvePaymentSupportUrl,
} from '@/lib/payment-support';

describe('payment support helpers', () => {
  it('detects direct support URLs', () => {
    expect(isDirectSupportUrl('https://example.com/file.pdf')).toBe(true);
    expect(isDirectSupportUrl('http://example.com/file.pdf')).toBe(true);
    expect(isDirectSupportUrl('receipts/b2b/file.pdf')).toBe(false);
    expect(isDirectSupportUrl(null)).toBe(false);
  });

  it('extracts signed URLs from plain or wrapped payloads', () => {
    expect(extractSupportUrl({ signedUrl: 'https://example.com/a' })).toBe(
      'https://example.com/a',
    );
    expect(extractSupportUrl({ url: 'https://example.com/b' })).toBe(
      'https://example.com/b',
    );
    expect(
      extractSupportUrl({ data: { signedUrl: 'https://example.com/c' } }),
    ).toBe('https://example.com/c');
    expect(extractSupportUrl({ data: { url: 'https://example.com/d' } })).toBe(
      'https://example.com/d',
    );
    expect(extractSupportUrl({})).toBeNull();
  });

  it('returns the direct URL without calling the API', async () => {
    const fetchImpl = jest.fn();

    const resolved = await resolvePaymentSupportUrl({
      initialUrl: 'https://example.com/file.pdf',
      entityId: 'quote-1',
      entityType: 'b2b',
      accessToken: 'token',
      fetchImpl,
    });

    expect(resolved).toBe('https://example.com/file.pdf');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requests a signed URL for private storage refs', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signedUrl: 'https://signed.example.com/file.pdf',
      }),
    });

    const resolved = await resolvePaymentSupportUrl({
      initialUrl: 'receipts/b2b/private-file.pdf',
      entityId: 'quote-1',
      entityType: 'b2b',
      accessToken: 'token',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      '/payments/supports/b2b/quote-1/signed-url',
      {
        cache: 'no-store',
        headers: {
          Authorization: 'Bearer token',
        },
      },
    );
    expect(resolved).toBe('https://signed.example.com/file.pdf');
  });

  it('returns null when a private storage ref cannot be resolved', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const resolved = await resolvePaymentSupportUrl({
      initialUrl: 'receipts/b2b/private-file.pdf',
      entityId: 'quote-1',
      entityType: 'b2b',
      accessToken: 'token',
      fetchImpl,
    });

    expect(resolved).toBeNull();
  });
});
