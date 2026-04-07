import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { tryGetSupabaseEnv } from '@/lib/env';

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true });
  const env = tryGetSupabaseEnv();

  if (!env) {
    return response;
  }

  const requestCookies = request.headers.get('cookie') ?? '';
  const parsedCookies = requestCookies
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const separatorIndex = chunk.indexOf('=');
      const name =
        separatorIndex === -1 ? chunk : chunk.slice(0, separatorIndex);
      const value =
        separatorIndex === -1 ? '' : decodeURIComponent(chunk.slice(separatorIndex + 1));

      return { name, value };
    });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return parsedCookies;
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.signOut();

  return response;
}
