// Removes the demo/sample identities (from the files in /templates) from the DB.
// Usage: node scripts/cleanup-samples.mjs
import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false },
});

const SAMPLE_EMAILS = [
  'johnsmith@example.com',
  'arben.krasniqi@example.com',
  'besarta.gashi@example.com',
  'drilon.berisha@example.com',
  'zana.hoxha@example.com',
];

async function run() {
  const admin = (await pool.query(
    `SELECT id FROM profiles WHERE role IN ('admin','superadmin') AND COALESCE(is_archived,false)=false LIMIT 1`
  )).rows[0];

  const found = (await pool.query(
    `SELECT id, email, first_name, last_name, role FROM profiles WHERE lower(email) = ANY($1::text[])`,
    [SAMPLE_EMAILS]
  )).rows;
  console.log('sample profiles found:', found.length);

  for (const p of found) {
    if (p.role === 'student' && admin) {
      const r = await pool.query(`SELECT admin_delete_student_account($1, $2) AS r`, [p.id, admin.id]);
      console.log('  deleted', p.email, '→', JSON.stringify(r.rows[0].r));
    } else {
      await pool.query(`DELETE FROM class_attendance WHERE student_id=$1`, [p.id]);
      await pool.query(`DELETE FROM class_enrollments WHERE student_id=$1`, [p.id]);
      await pool.query(`DELETE FROM invoices WHERE student_id=$1`, [p.id]);
      await pool.query(`DELETE FROM registration_applications WHERE lower(email)=lower($1)`, [p.email]);
      await pool.query(`DELETE FROM auth_users WHERE id=$1`, [p.id]);
      await pool.query(`DELETE FROM profiles WHERE id=$1`, [p.id]);
      console.log('  deleted', p.email);
    }
  }

  await pool.query(`DELETE FROM registration_applications WHERE lower(email) = ANY($1::text[])`, [SAMPLE_EMAILS]);

  const left = (await pool.query(
    `SELECT
       (SELECT count(*) FROM profiles WHERE lower(email)=ANY($1::text[]))::int AS profiles,
       (SELECT count(*) FROM registration_applications WHERE lower(email)=ANY($1::text[]))::int AS registrations`,
    [SAMPLE_EMAILS]
  )).rows[0];
  console.log('remaining →', left);
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
