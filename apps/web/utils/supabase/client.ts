import { createBrowserClient } from '@supabase/ssr'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseEnv, tryGetSupabaseEnv } from '@/lib/env'

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

type MissingSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: null };
      error: Error | null;
    }>;
    getSession: () => Promise<{
      data: { session: null };
      error: Error | null;
    }>;
    onAuthStateChange: (
      callback: (event: AuthChangeEvent, session: Session | null) => void,
    ) => {
      data: {
        subscription: {
          unsubscribe: () => void;
        };
      };
    };
    setSession: () => Promise<{ data: { session: null }; error: Error }>;
    signOut: () => Promise<{ error: Error | null }>;
    updateUser: () => Promise<{ data: { user: null }; error: Error }>;
  };
  storage: {
    from: (_bucket: string) => {
      upload: () => Promise<{ data: null; error: Error }>;
      getPublicUrl: (_path: string) => {
        data: { publicUrl: '' };
      };
    };
  };
};

function createMissingSupabaseClient(): MissingSupabaseClient {
  const createError = () =>
    new Error(
      '[env] Supabase client is unavailable because NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.',
    );

  return {
    auth: {
      async getUser() {
        return {
          data: { user: null },
          error: null,
        };
      },
      async getSession() {
        return {
          data: { session: null },
          error: null,
        };
      },
      onAuthStateChange(callback) {
        callback('SIGNED_OUT', null);
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        };
      },
      async setSession() {
        return {
          data: { session: null },
          error: createError(),
        };
      },
      async signOut() {
        return {
          error: null,
        };
      },
      async updateUser() {
        return {
          data: { user: null },
          error: createError(),
        };
      },
    },
    storage: {
      from() {
        return {
          async upload() {
            return {
              data: null,
              error: createError(),
            };
          },
          getPublicUrl() {
            return {
              data: { publicUrl: '' },
            };
          },
        };
      },
    },
  };
}

let client: BrowserSupabaseClient | MissingSupabaseClient | null = null;

export function createClient(): BrowserSupabaseClient | MissingSupabaseClient {
  if (client) return client;

  const env =
    process.env.NODE_ENV === 'production'
      ? getSupabaseEnv()
      : tryGetSupabaseEnv();

  if (!env) {
    client = createMissingSupabaseClient();
    return client;
  }

  client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
