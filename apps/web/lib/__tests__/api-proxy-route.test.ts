import { NextRequest } from 'next/server';

jest.mock('@/lib/api-config', () => ({
  getServerApiCandidates: jest.fn(() => ['http://api.internal/api/v1']),
  isRetryableApiResponseStatus: jest.fn(() => false),
}));

jest.mock('@/lib/dashboard-auth', () => ({
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME: 'debug-role',
  DASHBOARD_DEBUG_ROLE_HEADER_NAME: 'x-debug-role',
  parseDashboardDebugRoleCookie: jest.fn(() => null),
}));

describe('api proxy route', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('reenvia headers operativos y forwarding al upstream', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { POST } = await import('../../app/api/proxy/[...path]/route');

    const request = new NextRequest('http://localhost/api/proxy/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'host': 'shop.example.com',
        'x-idempotency-key': 'idem-order-1',
        'x-forwarded-for': '198.51.100.10',
        'x-real-ip': '203.0.113.5',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ hello: 'world' }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ['orders'] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const forwardedHeaders = init?.headers as Headers;
    expect(forwardedHeaders.get('x-idempotency-key')).toBe('idem-order-1');
    expect(forwardedHeaders.get('x-forwarded-for')).toBe(
      '198.51.100.10, 203.0.113.5',
    );
    expect(forwardedHeaders.get('x-forwarded-proto')).toBe('https');
    expect(forwardedHeaders.get('x-forwarded-host')).toBe('shop.example.com');
    expect(response.status).toBe(200);
  });

  it('deriva proto y host cuando el proxy no los recibe ya reenviados', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { GET } = await import('../../app/api/proxy/[...path]/route');

    const request = new NextRequest('https://store.example.com/api/proxy/catalog', {
      method: 'GET',
      headers: {
        'host': 'store.example.com',
      },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ['catalog'] }),
    });

    const [, init] = fetchMock.mock.calls[0];
    const forwardedHeaders = init?.headers as Headers;
    expect(forwardedHeaders.get('x-forwarded-proto')).toBe('https');
    expect(forwardedHeaders.get('x-forwarded-host')).toBe('store.example.com');
    expect(response.status).toBe(200);
  });
});
