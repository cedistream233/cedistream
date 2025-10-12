import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyIndex() {
  try {
    const res = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'purchases' 
      AND indexname LIKE 'uniq%'
    `);
    
    console.log('Unique indexes on purchases table:');
    console.log(JSON.stringify(res.rows, null, 2));
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    await pool.end();
    process.exit(1);
  }
}

verifyIndex();
