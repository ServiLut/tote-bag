const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ quiet: true });

function parsePositiveInt(rawValue, fallback) {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(parsedValue));
}

function resolveDatabaseSslMode(rawValue) {
  const normalizedValue = rawValue?.trim().toLowerCase();

  if (normalizedValue === 'true') {
    return 'enabled';
  }

  if (normalizedValue === 'false') {
    return 'disabled';
  }

  return 'inherit';
}

function resolveConnectionString(env = process.env) {
  return env.DATABASE_URL || env.DIRECT_URL || env.POSTGRES_URL_NON_POOLING || '';
}

function createPoolConfig(env = process.env) {
  const poolConfig = {
    connectionString: resolveConnectionString(env),
    connectionTimeoutMillis: parsePositiveInt(
      env.DATABASE_CONNECT_TIMEOUT_MS,
      10000,
    ),
  };
  const sslMode = resolveDatabaseSslMode(env.DATABASE_SSL);

  if (sslMode === 'enabled') {
    poolConfig.ssl = {
      rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    };
  } else if (sslMode === 'disabled') {
    poolConfig.ssl = false;
  }

  return poolConfig;
}

function resolveSqlPath() {
  return path.join(__dirname, 'prisma', 'migrations', 'storage_setup.sql');
}

async function applyStorageHardening(options = {}) {
  const logPrefix = options.logPrefix || '[storage-hardening]';
  const connectionString = resolveConnectionString(options.env);

  if (!connectionString) {
    process.stdout.write(
      `${logPrefix} Skipping storage hardening because no database connection string is configured.\n`,
    );
    return {
      applied: false,
      skipped: true,
      reason: 'missing_connection_string',
    };
  }

  const sqlPath = resolveSqlPath();
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = new Pool(createPoolConfig(options.env));
  const client = await pool.connect();

  try {
    const metadataResult = await client.query(`
      SELECT
        to_regclass('storage.buckets') IS NOT NULL AS has_storage_buckets,
        to_regclass('storage.objects') IS NOT NULL AS has_storage_objects
    `);
    const metadataRow = metadataResult.rows[0];

    if (!metadataRow?.has_storage_buckets || !metadataRow?.has_storage_objects) {
      process.stdout.write(
        `${logPrefix} Skipping storage hardening because this database does not expose Supabase storage tables.\n`,
      );
      return {
        applied: false,
        skipped: true,
        reason: 'missing_storage_schema',
      };
    }

    process.stdout.write(`${logPrefix} Applying storage bucket hardening.\n`);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    process.stdout.write(
      `${logPrefix} Storage bucket hardening applied successfully.\n`,
    );

    return {
      applied: true,
      skipped: false,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = {
  applyStorageHardening,
};

if (require.main === module) {
  applyStorageHardening().catch((error) => {
    console.error('[storage-hardening] Failed to apply storage hardening:', error);
    process.exit(1);
  });
}
