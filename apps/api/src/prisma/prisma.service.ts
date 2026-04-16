import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    let connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;
    const databaseSsl = process.env.DATABASE_SSL?.trim().toLowerCase();
    const inheritConnectionStringSsl = databaseSsl === 'inherit';
    const useSsl = databaseSsl === 'true';
    const disableSsl = !useSsl && !inheritConnectionStringSsl;

    try {
      if (connectionString) {
        const urlObj = new URL(connectionString);

        if (disableSsl) {
          urlObj.searchParams.delete('sslmode');
          urlObj.searchParams.delete('sslrootcert');
          urlObj.searchParams.delete('sslcert');
          urlObj.searchParams.delete('sslkey');
        }

        if (!urlObj.searchParams.has('schema')) {
          urlObj.searchParams.set('schema', 'tote-bag');
        }

        urlObj.searchParams.set('options', '-c search_path=tote-bag');

        connectionString = urlObj.toString();
      }
    } catch (e) {
      console.error('Error parsing DATABASE_URL', e);
    }

    const poolConfig: pg.PoolConfig = {
      connectionString,
    };

    if (useSsl) {
      poolConfig.ssl = {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
      };
    } else if (disableSsl) {
      poolConfig.ssl = false;
    }

    const pool = new pg.Pool(poolConfig);

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
