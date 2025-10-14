import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Managed Postgres (Render/Neon/Supabase) generally requires SSL in serverless contexts
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    // Give more time for cold starts or congested networks
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 15000),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    max: Number(process.env.PGPOOL_MAX || 10),
    application_name: 'cedistream-backend'
  });

  pool.on('error', (err) => {
    console.error('⚠️  Postgres pool error:', err);
  });
} else {
  console.warn('⚠️  DATABASE_URL not set. Database operations will fail until configured.');
}

export const query = async (text, params) => {
  if (!pool) {
    throw new Error('Database not configured. Please set DATABASE_URL in your .env file.');
  }
  const client = await pool.connect();
  try {
    // Set a sane statement timeout to prevent hung queries from stalling health checks/jobs
    const statementTimeoutMs = Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15000);
    if (Number.isFinite(statementTimeoutMs) && statementTimeoutMs > 0) {
      await client.query(`SET statement_timeout = ${statementTimeoutMs}`);
    }
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

export const closePool = async () => {
  if (pool) {
    try {
      await pool.end();
      console.log('🧹 Postgres pool closed');
    } catch (e) {
      console.error('Error closing Postgres pool:', e);
    }
  }
};

export default { query, getPool, closePool };