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
  PORT: number = 4000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  DIRECT_URL: string;

  @IsUrl({ require_tld: false })
  NEXT_PUBLIC_SUPABASE_URL: string;

  @IsString()
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;

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

  @IsUrl({ require_tld: false })
  @IsOptional()
  SENTRY_DSN: string;

  @IsString()
  @IsOptional()
  REDIS_URL: string;
}

export function validate(config: Record<string, unknown>) {
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
