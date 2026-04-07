const PLACEHOLDER_SUPABASE_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_SUPABASE_KEY = 'placeholder-key';

const PUBLIC_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
}

function readRequiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  const rawValue = PUBLIC_ENV[name]?.trim();
  const value = rawValue ? stripWrappingQuotes(rawValue) : rawValue;

  if (!value) {
    throw new Error(`[env] Missing required variable: ${name}`);
  }

  return value;
}

export function getSupabaseEnv() {
  const supabaseUrl = readRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = readRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (supabaseUrl === PLACEHOLDER_SUPABASE_URL) {
    throw new Error(
      '[env] NEXT_PUBLIC_SUPABASE_URL is using the placeholder value and must be configured.',
    );
  }

  if (supabaseAnonKey === PLACEHOLDER_SUPABASE_KEY) {
    throw new Error(
      '[env] NEXT_PUBLIC_SUPABASE_ANON_KEY is using the placeholder value and must be configured.',
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function tryGetSupabaseEnv() {
  try {
    return getSupabaseEnv();
  } catch {
    return null;
  }
}
