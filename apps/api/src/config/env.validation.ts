import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Provision = 'provision',
}

enum MetricsAccessPolicy {
  Public = 'public',
  Private = 'private',
  Token = 'token',
  Disabled = 'disabled',
}

enum NotificationsEmailProvider {
  Log = 'log',
  Resend = 'resend',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4003;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  DIRECT_URL: string;

  @IsUrl({ require_tld: false })
  NEXT_PUBLIC_SUPABASE_URL: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  SUPABASE_URL: string;

  @IsString()
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;

  @IsString()
  @IsOptional()
  SUPABASE_ANON_KEY: string;

  @IsString()
  SERVICE_ROLE: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  WOMPI_PUBLIC_KEY: string;

  @IsString()
  @IsOptional()
  WOMPI_PRIVATE_KEY: string;

  @IsString()
  @IsOptional()
  WOMPI_INTEGRITY_SECRET: string;

  @IsString()
  @IsOptional()
  WOMPI_EVENTS_SECRET: string;

  @IsString()
  @IsOptional()
  NEXT_PUBLIC_WOMPI_PUBLIC_KEY: string;

  @IsNumber()
  @IsOptional()
  WOMPI_COMMISSION_PERCENT: number = 0;

  @IsNumber()
  @IsOptional()
  WOMPI_FIXED_FEE_COP: number = 0;

  @IsNumber()
  @IsOptional()
  WOMPI_PACKAGING_CIF_COP: number = 990;

  @IsNumber()
  @IsOptional()
  WOMPI_COMMISSION_VAT_PERCENT: number = 0;

  @IsNumber()
  @IsOptional()
  WOMPI_RETEFUENTE_PERCENT: number = 0;

  @IsNumber()
  @IsOptional()
  WOMPI_RETEIVA_PERCENT: number = 0;

  @IsNumber()
  @IsOptional()
  WOMPI_RETEICA_PERCENT: number = 0;

  @IsUrl({ require_tld: false })
  @IsOptional()
  SENTRY_DSN: string;

  @IsString()
  @IsOptional()
  REDIS_URL: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string;

  @IsString()
  @IsOptional()
  ENABLE_SENTRY_DEBUG: string;

  @IsString()
  @IsOptional()
  DATABASE_SSL: string;

  @IsString()
  @IsOptional()
  DATABASE_SSL_REJECT_UNAUTHORIZED: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FRONTEND_URL: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  SHIPPING_NOTIFICATIONS_WEBHOOK_URL: string;

  @IsString()
  @IsOptional()
  SHIPPING_NOTIFICATIONS_WEBHOOK_TOKEN: string;

  @IsEnum(MetricsAccessPolicy, {
    message:
      'METRICS_ACCESS_POLICY must be one of public, private, token or disabled.',
  })
  @IsOptional()
  METRICS_ACCESS_POLICY: MetricsAccessPolicy;

  @IsString()
  @IsOptional()
  METRICS_BEARER_TOKEN: string;

  @IsEnum(NotificationsEmailProvider, {
    message: 'NOTIFICATIONS_EMAIL_PROVIDER must be one of log or resend.',
  })
  @IsOptional()
  NOTIFICATIONS_EMAIL_PROVIDER: NotificationsEmailProvider;

  @IsString()
  @IsOptional()
  RESEND_API_KEY: string;

  @IsEmail()
  @IsOptional()
  NOTIFICATIONS_FROM_EMAIL: string;

  @IsString()
  @IsOptional()
  NOTIFICATIONS_FROM_NAME: string;

  @IsEmail()
  @IsOptional()
  NOTIFICATIONS_REPLY_TO_EMAIL: string;

  @IsNumber()
  @IsOptional()
  ORDER_PENDING_EXPIRATION_HOURS: number = 24;

  @IsNumber()
  @IsOptional()
  ORDER_EXPIRATION_CHECK_INTERVAL_MINUTES: number = 30;

  @IsNumber()
  @IsOptional()
  WEBHOOK_RETRY_INTERVAL_MINUTES: number = 15;

  @IsNumber()
  @IsOptional()
  WEBHOOK_RETRY_MAX_ATTEMPTS: number = 5;
}

export function envValidationSchema(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });
  const customErrors: string[] = [];

  const isProductionLike =
    validatedConfig.NODE_ENV === Environment.Production ||
    validatedConfig.NODE_ENV === Environment.Provision;

  if (isProductionLike && !validatedConfig.FRONTEND_URL?.trim()) {
    customErrors.push(
      'FRONTEND_URL is required when NODE_ENV is production or provision.',
    );
  }

  if (
    isProductionLike &&
    !validatedConfig.SHIPPING_NOTIFICATIONS_WEBHOOK_URL?.trim()
  ) {
    customErrors.push(
      'SHIPPING_NOTIFICATIONS_WEBHOOK_URL is required when NODE_ENV is production or provision.',
    );
  }

  if (
    isProductionLike &&
    !validatedConfig.SHIPPING_NOTIFICATIONS_WEBHOOK_TOKEN?.trim()
  ) {
    customErrors.push(
      'SHIPPING_NOTIFICATIONS_WEBHOOK_TOKEN is required when NODE_ENV is production or provision.',
    );
  }

  if (
    validatedConfig.SHIPPING_NOTIFICATIONS_WEBHOOK_URL?.trim() &&
    !validatedConfig.SHIPPING_NOTIFICATIONS_WEBHOOK_TOKEN?.trim()
  ) {
    customErrors.push(
      'SHIPPING_NOTIFICATIONS_WEBHOOK_TOKEN is required when SHIPPING_NOTIFICATIONS_WEBHOOK_URL is configured.',
    );
  }

  if (
    validatedConfig.METRICS_ACCESS_POLICY === MetricsAccessPolicy.Token &&
    !validatedConfig.METRICS_BEARER_TOKEN?.trim()
  ) {
    customErrors.push(
      'METRICS_BEARER_TOKEN is required when METRICS_ACCESS_POLICY=token.',
    );
  }

  if (
    validatedConfig.NOTIFICATIONS_EMAIL_PROVIDER ===
    NotificationsEmailProvider.Resend
  ) {
    if (!validatedConfig.RESEND_API_KEY?.trim()) {
      customErrors.push(
        'RESEND_API_KEY is required when NOTIFICATIONS_EMAIL_PROVIDER=resend.',
      );
    }

    if (!validatedConfig.NOTIFICATIONS_FROM_EMAIL?.trim()) {
      customErrors.push(
        'NOTIFICATIONS_FROM_EMAIL is required when NOTIFICATIONS_EMAIL_PROVIDER=resend.',
      );
    }
  }

  if (errors.length > 0 || customErrors.length > 0) {
    throw new Error(
      [
        ...errors.flatMap((error) => Object.values(error.constraints ?? {})),
        ...customErrors,
      ].join(', '),
    );
  }
  return validatedConfig;
}

export default envValidationSchema;
