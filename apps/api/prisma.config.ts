import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const directUrl = process.env.DIRECT_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Prefer a direct/non-pooled connection for migrations, but keep a safe
    // fallback to DATABASE_URL so deploys do not fail only because DIRECT_URL
    // was omitted in simpler environments.
    url: directUrl || databaseUrl,
  },
  migrations: {
    seed: 'ts-node ./prisma/seed.ts',
  },
});
