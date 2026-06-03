import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function applyMigration() {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260602000000_create_roles_and_permissions_system.sql'
  );

  try {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log('Executing migration...');
    console.log('Database:', process.env.DB_HOST);
    await pool.query(sql);
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error('Error:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
