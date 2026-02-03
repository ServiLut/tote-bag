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

    // IMPORTANT: Strip SSL params from URL so our manual config takes precedence
    try {
      if (connectionString) {
        const urlObj = new URL(connectionString);
        urlObj.searchParams.delete('sslmode');
        urlObj.searchParams.delete('sslrootcert');
        urlObj.searchParams.delete('sslcert');
        urlObj.searchParams.delete('sslkey');
        connectionString = urlObj.toString();
      }
    } catch {
      // ignore invalid URLs
    }

    const isSslDisabled = process.env.DB_SSL === 'false';

    const pool = new pg.Pool({
      connectionString,
      // If DB_SSL is explicitly 'false', pass undefined to disable SSL.
      // Otherwise, default to permissive SSL (accept self-signed).
      ssl: isSslDisabled ? undefined : { rejectUnauthorized: false }, 
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
