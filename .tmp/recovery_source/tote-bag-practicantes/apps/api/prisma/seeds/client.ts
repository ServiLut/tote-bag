import { PrismaClient } from '../../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

function getConnectionString() {
  const connectionString =
    process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || '';

  try {
    const urlObj = new URL(connectionString);
    urlObj.searchParams.delete('sslmode');
    urlObj.searchParams.delete('sslrootcert');
    urlObj.searchParams.delete('sslcert');
    urlObj.searchParams.delete('sslkey');
    return urlObj.toString();
  } catch {
    return connectionString;
  }
}

export function createSeedPrismaClient() {
  const pool = new pg.Pool({
    connectionString: getConnectionString(),
    ssl: false,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}
