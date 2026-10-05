import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Usage: node scripts/apply-email-templates-migration.mjs [--env .env.development.local]
// Defaults to .env.local (live RDS).
const envArg = process.argv.indexOf('--env');
config({ path: envArg !== -1 ? process.argv[envArg + 1] : '.env.local', override: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261005000000_create_email_templates.sql'
  );
  try {
    // Same mapping as scripts/migrate-rds.mjs: the app's DB has no Supabase auth schema.
    const sql = fs.readFileSync(migrationPath, 'utf-8').replace(/\bauth\.uid\(\)/g, 'current_app_user_id()');
    console.log('Applying migration to:', process.env.DB_HOST || '(DATABASE_URL)');
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
