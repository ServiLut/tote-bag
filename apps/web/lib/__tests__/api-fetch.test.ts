describe('apiFetch', () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.INTERNAL_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    process.env = originalEnv;

    if (typeof originalWindow === 'undefined') {
      delete (global as unknown as { window?: unknown }).window;
    } else {
      Object.defineProperty(global, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it('reintenta en el navegador cuando el proxy responde 502 para un GET', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiFetch } = await import('../../utils/api');

    const responsePromise = apiFetch('/catalog/products');

    await jest.advanceTimersByTimeAsync(250);

    const response = await responsePromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/proxy/catalog/products', undefined);
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/proxy/catalog/products', undefined);
    expect(response.status).toBe(200);
  });

  it('reintenta en el navegador cuando falla la conexion del proxy para un GET', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiFetch } = await import('../../utils/api');

    const responsePromise = apiFetch('/wizard-options/grouped');

    await jest.advanceTimersByTimeAsync(250);

    const response = await responsePromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/proxy/wizard-options/grouped', undefined);
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/proxy/wizard-options/grouped', undefined);
    expect(response.status).toBe(200);
  });

  it('no reintenta mutaciones del navegador para evitar duplicados', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response('bad gateway', { status: 502 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiFetch } = await import('../../utils/api');

    const response = await apiFetch('/pricing/quote', {
      method: 'POST',
      body: JSON.stringify({ quantity: 10 }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/proxy/pricing/quote', {
      method: 'POST',
      body: JSON.stringify({ quantity: 10 }),
    });
    expect(response.status).toBe(502);
  });

  it('usa INTERNAL_API_URL para fetch server-side cuando esta disponible', async () => {
    delete (global as unknown as { window?: unknown }).window;
    process.env.INTERNAL_API_URL = 'http://api.internal:4000/api/v1';
    process.env.NEXT_PUBLIC_API_URL = 'https://public.example.com/api/v1';

    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiFetch } = await import('../../utils/api');

    const response = await apiFetch('/profiles/me', {
      cache: 'no-store',
      headers: {
        authorization: 'Bearer token',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('http://api.internal:4000/api/v1/profiles/me', {
      cache: 'no-store',
      headers: {
        authorization: 'Bearer token',
      },
    });
    expect(response.status).toBe(200);
  });
});
