import { createSeedPrismaClient } from './seeds/client';
import { runCoreSeed } from './seeds/core';

async function main() {
  console.log('Iniciando seed base (Core only)...');

  const prisma = createSeedPrismaClient();

  try {
    await runCoreSeed(prisma);
    console.log('Seed base completado exitosamente.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
