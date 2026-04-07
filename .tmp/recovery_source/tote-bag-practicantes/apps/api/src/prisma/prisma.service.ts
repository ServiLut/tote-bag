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

    // 1. Clean SSL params to avoid conflicts and force SSL: false later
    try {
      if (connectionString) {
        const urlObj = new URL(connectionString);
        urlObj.searchParams.delete('sslmode');
        urlObj.searchParams.delete('sslrootcert');
        urlObj.searchParams.delete('sslcert');
        urlObj.searchParams.delete('sslkey');

        // 2. Ensure schema is set in the search_path via query param options
        // This is the standard way for 'pg' driver to set search_path
        if (!urlObj.searchParams.has('schema')) {
          urlObj.searchParams.set('schema', 'tote-bag');
        }

        // Also force it via 'options' param which pg driver respects
        // -c search_path=tote-bag
        urlObj.searchParams.set('options', '-c search_path=tote-bag');

        connectionString = urlObj.toString();
      }
    } catch (e) {
      console.error('Error parsing DATABASE_URL', e);
    }

    const pool = new pg.Pool({
      connectionString,
      ssl: false,
    });

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
