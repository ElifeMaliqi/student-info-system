import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260607000000_add_is_manual_to_invoices.sql'
  );
  try {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log('Applying migration to:', process.env.DB_HOST);
    await pool.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
