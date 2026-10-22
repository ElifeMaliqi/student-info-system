import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Usage: node scripts/apply-invoice-issue-rules-migration.mjs [--env .env.development.local]
// Defaults to .env.local (live RDS). Adds the first-month cut-off day and the
// monthly issue window to invoice_settings.
const envArg = process.argv.indexOf('--env');
config({ path: envArg !== -1 ? process.argv[envArg + 1] : '.env.local', override: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const file = 'supabase/migrations/20261020000000_invoice_enrollment_cutoff_and_issue_window.sql';
  try {
    console.log('Applying to:', process.env.DB_HOST || '(DATABASE_URL)');
    await pool.query(fs.readFileSync(path.join(process.cwd(), file), 'utf-8'));
    console.log('Applied', file);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
