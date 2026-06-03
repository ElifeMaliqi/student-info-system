import { config } from 'dotenv';
import { Pool } from 'pg';

config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    // Check foreign keys for class_sessions
    const fkRes = await pool.query(`
      SELECT constraint_name, table_name, column_name 
      FROM information_schema.key_column_usage
      WHERE table_name = 'class_sessions'
      ORDER BY constraint_name
    `);
    console.log('class_sessions foreign keys:');
    fkRes.rows.forEach(r => console.log(`  - ${r.constraint_name}: ${r.column_name} (table: ${r.table_name})`));
    
    // Check what the relationship should be called in Supabase
    const classRes = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'classes'
      ORDER BY ordinal_position
    `);
    console.log('\nclasses columns:');
    classRes.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
