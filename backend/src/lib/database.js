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
    // Pool errors are typically idle client connection issues; log as warning instead of error
    // to avoid alarming production logs. The query retry logic will handle transient failures.
    console.warn('⚠️  Postgres pool error (idle client or network):', err?.message || err);
  });
} else {
  console.warn('⚠️  DATABASE_URL not set. Database operations will fail until configured.');
}

// Internal low-level query that uses a client and sets a statement timeout
const _queryWithClient = async (text, params = []) => {
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
  } finally {
    client.release();
  }
};

// Track last error time to throttle noisy repeated transient errors
let lastTransientErrorTime = 0;
let lastTransientErrorCode = null;
const TRANSIENT_LOG_THROTTLE_MS = 10000; // only log same transient error once per 10s

// Public query wrapper with retry/backoff for transient network/DNS errors
export const query = async (text, params = []) => {
  const maxAttempts = Number(process.env.PG_QUERY_MAX_ATTEMPTS || 3);
  const transientCodes = new Set(['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN']);
  let attempt = 0;
  let lastErr = null;

  while (++attempt <= maxAttempts) {
    try {
      return await _queryWithClient(text, params);
    } catch (err) {
      lastErr = err;
      const code = err && err.code ? String(err.code) : null;
      // If transient, retry with backoff
      if (attempt < maxAttempts && code && transientCodes.has(code)) {
        const backoff = Math.min(3000, 300 * Math.pow(1.5, attempt - 1)); // exponential with cap
        // Throttle logs: only log if different code or enough time passed
        const now = Date.now();
        if (code !== lastTransientErrorCode || (now - lastTransientErrorTime) > TRANSIENT_LOG_THROTTLE_MS) {
          console.warn(`⚠️  DB transient error (${code}), will retry (attempt ${attempt}/${maxAttempts})`);
          lastTransientErrorTime = now;
          lastTransientErrorCode = code;
        }
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      // Not transient or out of retries: surface error (log only once per error type to avoid spam)
      const now = Date.now();
      if (code !== lastTransientErrorCode || (now - lastTransientErrorTime) > TRANSIENT_LOG_THROTTLE_MS) {
        console.error('Database query error:', err);
        lastTransientErrorTime = now;
        lastTransientErrorCode = code;
      }
      throw err;
    }
  }
  // Shouldn't get here, but throw last error to be safe
  throw lastErr || new Error('Unknown database error');
};

export const getPool = () => pool;

export const closePool = async () => {
  if (pool) {
    try {
      await pool.end();
  console.info('🧹 Postgres pool closed');
    } catch (e) {
      console.error('Error closing Postgres pool:', e);
    }
  }
};

export default { query, getPool, closePool };