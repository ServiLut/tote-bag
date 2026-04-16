describe('api config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('usa solo la API configurada en produccion', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/api/v1';

    const { getApiCandidates } = await import('../api-config');

    expect(getApiCandidates()).toEqual(['https://api.example.com/api/v1']);
  });

  it('prioriza loopback sobre una API LAN configurada en desarrollo', async () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_API_URL = 'http://192.168.1.54:4004/api/v1';

    const { getApiCandidates } = await import('../api-config');

    expect(getApiCandidates().slice(0, 3)).toEqual([
      'http://localhost:4004/api/v1',
      'http://127.0.0.1:4004/api/v1',
      'http://192.168.1.54:4004/api/v1',
    ]);
  });
});
