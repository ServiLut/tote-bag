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

    console.log('DEBUG: Raw Connection String:', connectionString?.replace(/:[^:@]+@/, ':****@')); // Hide password

    // Force strip SSL params
    try {
      if (connectionString) {
        const urlObj = new URL(connectionString);
        urlObj.searchParams.delete('sslmode');
        urlObj.searchParams.delete('sslrootcert');
        urlObj.searchParams.delete('sslcert');
        urlObj.searchParams.delete('sslkey');
        connectionString = urlObj.toString();
        console.log('DEBUG: Stripped Connection String:', connectionString.replace(/:[^:@]+@/, ':****@'));
      }
    } catch (e) {
      console.error('DEBUG: Error parsing URL', e);
    }

    // HARDCODED DEBUG: Force SSL false to test connectivity
    const pool = new pg.Pool({
      connectionString,
      ssl: false, 
    });
    
    console.log('DEBUG: pg.Pool initialized with ssl: false');

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
