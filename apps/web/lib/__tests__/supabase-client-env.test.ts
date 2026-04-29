const createBrowserClientMock = jest.fn();
const createServerClientMock = jest.fn();
const cookiesMock = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => createBrowserClientMock(...args),
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

jest.mock('next/headers', () => ({
  cookies: (...args: unknown[]) => cookiesMock(...args),
}));

describe('supabase env guards', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;

    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalSupabaseAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
  });

  it('throws in production when browser Supabase env is missing', () => {
    process.env.NODE_ENV = 'production';

    const { createClient } = require('@/utils/supabase/client');

    expect(() => createClient()).toThrow(
      '[env] Missing required variable: NEXT_PUBLIC_SUPABASE_URL',
    );
    expect(createBrowserClientMock).not.toHaveBeenCalled();
  });

  it('throws in production before reading cookies when server Supabase env is missing', async () => {
    process.env.NODE_ENV = 'production';

    const { createClient } = require('@/utils/supabase/server');

    await expect(createClient()).rejects.toThrow(
      '[env] Missing required variable: NEXT_PUBLIC_SUPABASE_URL',
    );
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('creates configured browser and server clients when env is present', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const browserClient = { runtime: 'browser' };
    const serverClient = { runtime: 'server' };
    const cookieStore = {
      getAll: jest.fn(() => []),
      set: jest.fn(),
    };

    createBrowserClientMock.mockReturnValue(browserClient);
    createServerClientMock.mockReturnValue(serverClient);
    cookiesMock.mockResolvedValue(cookieStore);

    const { createClient: createBrowserSupabaseClient } = require('@/utils/supabase/client');
    const { createClient: createServerSupabaseClient } = require('@/utils/supabase/server');

    expect(createBrowserSupabaseClient()).toBe(browserClient);
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'anon-key',
    );

    await expect(createServerSupabaseClient()).resolves.toBe(serverClient);
    expect(cookiesMock).toHaveBeenCalledTimes(1);
    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
  });
});
