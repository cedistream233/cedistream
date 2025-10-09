import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  console.log('✅ Connected to Neon PostgreSQL database');
} else {
  console.warn('⚠️  DATABASE_URL not set. Database operations will fail until configured.');
}

export const query = async (text, params) => {
  if (!pool) {
    throw new Error('Database not configured. Please set DATABASE_URL in your .env file.');
  }
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const getPool = () => pool;

export default { query, getPool };