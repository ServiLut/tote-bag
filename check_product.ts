import { PrismaClient } from './apps/api/src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

async function main() {
  const pool = new pg.Pool({ connectionString, ssl: false });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const product = await prisma.product.findUnique({
    where: { slug: 'tote-bag-clasica' },
  });

  console.log('Product ID:', product?.id);
  await prisma.$disconnect();
}

main();
