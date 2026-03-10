import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found');
    return;
  }

  // Strip ssl parameters
  connectionString = connectionString.replace(/(\?|&)(sslmode|ssl)=[^&]*/g, '');
  if (!connectionString.includes('?')) {
    connectionString = connectionString.replace(/&/, '?');
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: false,
  });

  try {
    const res = await pool.query<{ email: string; role: string }>(
      'SELECT email, role FROM "tote-bag"."users"',
    );
    console.log(`Total users: ${res.rowCount}`);
    console.log('Users list:');
    res.rows.forEach((u) => console.log(`- ${u.email} (${u.role})`));
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await pool.end();
  }
}

void main();
