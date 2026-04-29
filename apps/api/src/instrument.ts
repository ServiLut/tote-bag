import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const DEFAULT_PRODUCTION_TRACES_SAMPLE_RATE = 0.05;
const DEFAULT_NON_PRODUCTION_TRACES_SAMPLE_RATE = 1;
const DEFAULT_PRODUCTION_PROFILES_SAMPLE_RATE = 0;
const DEFAULT_NON_PRODUCTION_PROFILES_SAMPLE_RATE = 1;

type SentryEnv = NodeJS.ProcessEnv;

export function parseBooleanEnv(
  value: string | undefined,
  fallback = false,
): boolean {
  if (!value) {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return fallback;
}

export function parseSampleRate(
  value: string | undefined,
  fallback: number,
): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsedValue));
}

export function getSentryInitOptions(
  env: SentryEnv = process.env,
): Sentry.NodeOptions | null {
  const dsn = env.SENTRY_DSN?.trim();

  if (!dsn) {
    return null;
  }

  const isProduction = env.NODE_ENV === 'production';
  const defaultTracesSampleRate = isProduction
    ? DEFAULT_PRODUCTION_TRACES_SAMPLE_RATE
    : DEFAULT_NON_PRODUCTION_TRACES_SAMPLE_RATE;
  const defaultProfilesSampleRate = isProduction
    ? DEFAULT_PRODUCTION_PROFILES_SAMPLE_RATE
    : DEFAULT_NON_PRODUCTION_PROFILES_SAMPLE_RATE;
  const profilesSampleRate = parseSampleRate(
    env.SENTRY_PROFILES_SAMPLE_RATE,
    defaultProfilesSampleRate,
  );

  return {
    dsn,
    environment:
      env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || 'development',
    integrations:
      profilesSampleRate > 0 ? [nodeProfilingIntegration()] : undefined,
    tracesSampleRate: parseSampleRate(
      env.SENTRY_TRACES_SAMPLE_RATE,
      defaultTracesSampleRate,
    ),
    profilesSampleRate,
    sendDefaultPii: parseBooleanEnv(env.SENTRY_SEND_DEFAULT_PII, false),
  };
}

export function initializeSentry(env: SentryEnv = process.env): void {
  const options = getSentryInitOptions(env);

  if (options) {
    Sentry.init(options);
  }
}

initializeSentry();
