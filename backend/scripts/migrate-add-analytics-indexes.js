import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const sqlPath = path.join(__dirname, '..', 'database', 'idx_purchases_for_analytics.sql');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set in environment. Aborting.');
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, { encoding: 'utf8' });

(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to database. Applying analytics indexes...');
    await client.query(sql);
    console.log('Analytics indexes applied successfully.');
  } catch (err) {
    console.error('Analytics index migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
