import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n=== SYSTEM ROLES ===');
    const roles = await client.query(`SELECT id, name, is_system_role FROM system_roles ORDER BY is_system_role DESC, name`);
    roles.rows.forEach(r => console.log(`  [${r.is_system_role ? 'built-in' : 'custom '}] ${r.name}  (${r.id})`));

    console.log('\n=== ROLE PERMISSIONS ===');
    const perms = await client.query(`
      SELECT sr.name as role_name, rp.module, rp.actions
      FROM role_permissions rp
      JOIN system_roles sr ON sr.id = rp.role_id
      ORDER BY sr.name, rp.module
    `);
    if (perms.rows.length === 0) {
      console.log('  (none)');
    } else {
      perms.rows.forEach(r => console.log(`  ${r.role_name.padEnd(20)} ${r.module.padEnd(16)} ${JSON.stringify(r.actions)}`));
    }

    console.log('\n=== PROFILES WITH SYSTEM ROLE ASSIGNED ===');
    const profiles = await client.query(`
      SELECT p.email, p.role, p.system_role_id, sr.name as system_role_name
      FROM profiles p
      LEFT JOIN system_roles sr ON sr.id = p.system_role_id
      WHERE p.system_role_id IS NOT NULL
      ORDER BY p.email
    `);
    if (profiles.rows.length === 0) {
      console.log('  (no profiles have a system role assigned)');
    } else {
      profiles.rows.forEach(r => console.log(`  ${r.email.padEnd(30)} [${r.role}] → system role: ${r.system_role_name || '(missing!)'} (${r.system_role_id})`));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err.message); process.exit(1); });
