import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

export type DatabaseSslMode = 'inherit' | 'enabled' | 'disabled';
export type ConnectionStringSslMode = 'prefer' | 'require' | 'disable' | null;

export function resolveDatabaseSslMode(
  rawValue: string | undefined,
): DatabaseSslMode {
  const normalizedValue = rawValue?.trim().toLowerCase();

  if (normalizedValue === 'true') {
    return 'enabled';
  }

  if (normalizedValue === 'false') {
    return 'disabled';
  }

  return 'inherit';
}

export function normalizeDatabaseConnectionString(
  rawConnectionString: string | undefined,
  sslMode: DatabaseSslMode,
) {
  if (!rawConnectionString) {
    return rawConnectionString;
  }

  const urlObj = new URL(rawConnectionString);

  if (sslMode === 'disabled') {
    urlObj.searchParams.delete('sslmode');
    urlObj.searchParams.delete('sslrootcert');
    urlObj.searchParams.delete('sslcert');
    urlObj.searchParams.delete('sslkey');
  }

  if (!urlObj.searchParams.has('schema')) {
    urlObj.searchParams.set('schema', 'tote-bag');
  }

  urlObj.searchParams.set('options', '-c search_path=tote-bag');

  return urlObj.toString();
}

export function getConnectionStringSslMode(
  rawConnectionString: string | undefined,
): ConnectionStringSslMode {
  if (!rawConnectionString) {
    return null;
  }

  const urlObj = new URL(rawConnectionString);
  const sslMode = urlObj.searchParams.get('sslmode')?.trim().toLowerCase();

  if (sslMode === 'prefer' || sslMode === 'require' || sslMode === 'disable') {
    return sslMode;
  }

  return null;
}

export function shouldDisableImplicitPreferSsl(
  rawConnectionString: string | undefined,
  sslMode: DatabaseSslMode,
  nodeEnv: string | undefined,
) {
  if (sslMode !== 'inherit' || nodeEnv === 'production') {
    return false;
  }

  return getConnectionStringSslMode(rawConnectionString) === 'prefer';
}

export function createPrismaPoolConfig(
  env: NodeJS.ProcessEnv = process.env,
): pg.PoolConfig {
  let connectionString = env.DATABASE_URL || env.POSTGRES_URL_NON_POOLING;
  const sslMode = resolveDatabaseSslMode(env.DATABASE_SSL);
  const disableImplicitPreferSsl = shouldDisableImplicitPreferSsl(
    connectionString,
    sslMode,
    env.NODE_ENV,
  );

  try {
    if (disableImplicitPreferSsl) {
      // node-postgres parses `sslmode=prefer` as an SSL connection attempt,
      // but @prisma/adapter-pg does not recover to plain TCP when the server
      // rejects TLS. In local/dev environments we treat `prefer` as a non-SSL
      // connection unless DATABASE_SSL explicitly opts back in.
      connectionString = normalizeDatabaseConnectionString(
        connectionString,
        'disabled',
      );
    } else {
      connectionString = normalizeDatabaseConnectionString(
        connectionString,
        sslMode,
      );
    }
  } catch (error) {
    console.error('Error parsing DATABASE_URL', error);
  }

  const poolConfig: pg.PoolConfig = {
    connectionString,
  };

  if (sslMode === 'enabled') {
    poolConfig.ssl = {
      rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    };
  } else if (sslMode === 'disabled' || disableImplicitPreferSsl) {
    poolConfig.ssl = false;
  }

  return poolConfig;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const pool = new pg.Pool(createPrismaPoolConfig());

    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
