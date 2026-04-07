import { createSeedPrismaClient } from './seeds/client';
import { runCoreSeed } from './seeds/core';
import { runDemoSeed } from './seeds/demo';

async function main() {
  console.log('Iniciando seed completo (Core + Demo)...');

  const prisma = createSeedPrismaClient();

  try {
    await runCoreSeed(prisma);
    await runDemoSeed(prisma);
    console.log('Seed completado exitosamente.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
