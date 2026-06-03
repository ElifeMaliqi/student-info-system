import { config } from 'dotenv';
import { Pool } from 'pg';

config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tables:');
    res.rows.forEach(r => console.log('  -', r.table_name));
    
    // Check class_sessions table structure
    const sessionRes = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'class_sessions'
      ORDER BY ordinal_position
    `);
    console.log('\nclass_sessions columns:');
    sessionRes.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
