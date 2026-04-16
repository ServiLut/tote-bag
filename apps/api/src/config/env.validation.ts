import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  validateSync,
  IsOptional,
  IsUrl,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Provision = 'provision',
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

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

export default envValidationSchema;
