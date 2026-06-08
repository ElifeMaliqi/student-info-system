import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('Connecting to:', process.env.DB_HOST);
    const result = await pool.query(`DELETE FROM role_permissions WHERE actions = '[]'::jsonb RETURNING id, role_id, module`);
    if (result.rows.length === 0) {
      console.log('No stale empty-action permission rows found.');
    } else {
      console.log(`Removed ${result.rows.length} stale empty-action rows:`);
      result.rows.forEach(r => console.log(`  role_id=${r.role_id} module=${r.module}`));
    }
  } catch (err) {
    console.error('Cleanup failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
