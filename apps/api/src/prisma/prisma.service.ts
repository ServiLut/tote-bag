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

    // Attempt to remove sslmode from URL to avoid conflicts with pg config
    try {
      if (connectionString) {
        // Check if it's a valid URL before parsing, or just try/catch
        const urlObj = new URL(connectionString);
        urlObj.searchParams.delete('sslmode');
        urlObj.searchParams.delete('sslrootcert');
        urlObj.searchParams.delete('sslcert');
        urlObj.searchParams.delete('sslkey');
        connectionString = urlObj.toString();
      }
    } catch {
      // invalid url or not a full url, ignore
    }

    const pool = new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
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
