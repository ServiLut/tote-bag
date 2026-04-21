
import { PrismaClient } from './apps/api/src/generated/client';
import 'dotenv/config';

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL,
  });

  try {
    console.log('Testing findMany()...');
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        variants: true,
        images: true,
        collection: true,
        attributes: true,
        pricingRules: true,
      },
      take: 1,
    });
    console.log('Success! Found', products.length, 'products');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
