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
});
