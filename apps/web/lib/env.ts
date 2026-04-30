const PLACEHOLDER_SUPABASE_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_SUPABASE_KEY = 'placeholder-key';
const DEFAULT_PUBLIC_APP_URL = 'http://localhost:3000';
const PUBLIC_APP_URL_ENV_NAME = 'NEXT_PUBLIC_BASE_URL';
const OMITTED = Symbol('omitted');
const DISALLOWED_PRODUCTION_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

const PUBLIC_ENV = {
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
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

function parsePublicAppUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`[env] ${PUBLIC_APP_URL_ENV_NAME} must be a valid absolute URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `[env] ${PUBLIC_APP_URL_ENV_NAME} must use the http or https protocol.`,
    );
  }

  url.pathname = '/';
  url.search = '';
  url.hash = '';

  return url;
}

function parseDeploymentHostAsPublicAppUrl(value: string) {
  const trimmedValue = stripWrappingQuotes(value.trim());
  const normalizedValue = trimmedValue.replace(/^https?:\/\//, '');

  return parsePublicAppUrl(`https://${normalizedValue}`);
}

export function getPublicAppBaseUrl(
  rawValue: string | undefined | typeof OMITTED = OMITTED,
  deploymentHost:
    | string
    | undefined
    | typeof OMITTED = OMITTED,
  nodeEnv: string | undefined | typeof OMITTED = OMITTED,
) {
  const resolvedRawValue =
    rawValue === OMITTED ? PUBLIC_ENV.NEXT_PUBLIC_BASE_URL : rawValue;
  const resolvedDeploymentHost =
    deploymentHost === OMITTED
      ? PUBLIC_ENV.VERCEL_PROJECT_PRODUCTION_URL ?? PUBLIC_ENV.VERCEL_URL
      : deploymentHost;
  const resolvedNodeEnv = nodeEnv === OMITTED ? process.env.NODE_ENV : nodeEnv;

  const trimmedValue = resolvedRawValue?.trim();
  const value = trimmedValue ? stripWrappingQuotes(trimmedValue) : trimmedValue;

  if (!value && resolvedDeploymentHost?.trim()) {
    const url = parseDeploymentHostAsPublicAppUrl(resolvedDeploymentHost);

    if (DISALLOWED_PRODUCTION_HOSTNAMES.has(url.hostname.toLowerCase())) {
      throw new Error(
        `[env] Deployment host must not point to localhost in production.`,
      );
    }

    return url;
  }

  if (!value) {
    return resolvedNodeEnv === 'production'
      ? undefined
      : new URL(DEFAULT_PUBLIC_APP_URL);
  }

  const url = parsePublicAppUrl(value);

  if (resolvedNodeEnv === 'production') {
    if (url.protocol !== 'https:') {
      throw new Error(
        `[env] ${PUBLIC_APP_URL_ENV_NAME} must use https in production.`,
      );
    }

    if (DISALLOWED_PRODUCTION_HOSTNAMES.has(url.hostname.toLowerCase())) {
      throw new Error(
        `[env] ${PUBLIC_APP_URL_ENV_NAME} must not point to localhost in production.`,
      );
    }
  }

  return url;
}
