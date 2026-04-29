import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv, tryGetSupabaseEnv } from '@/lib/env'

type MissingServerSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: null };
      error: Error | null;
    }>;
    getSession: () => Promise<{
      data: { session: null };
      error: Error | null;
    }>;
  };
}

function createMissingServerClient(): MissingServerSupabaseClient {
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
    },
  }
}

export async function createClient() {
  const env =
    process.env.NODE_ENV === 'production'
      ? getSupabaseEnv()
      : tryGetSupabaseEnv()

  if (!env) {
    return createMissingServerClient()
  }

  const cookieStore = await cookies()

  return createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
