import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false },
});

// Re-applies the RDS auth helpers (set_app_user, current_app_user_id,
// approve_registration_application, admin_delete_student_account). Every
// statement is CREATE OR REPLACE, so this is safe to run repeatedly.
async function run() {
  const sqlPath = path.join(process.cwd(), 'scripts/rds/001_rds_auth_functions.sql');
  try {
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    console.log('Applying RDS auth functions to:', process.env.DB_HOST);
    await pool.query(sql);
    console.log('Auth functions applied successfully.');
  } catch (err) {
    console.error('Apply failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
