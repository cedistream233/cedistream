import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const sqlPath = path.join(__dirname, '..', 'database', 'add_user_email_backfill.sql');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set in environment. Aborting.');
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, { encoding: 'utf8' });

(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to database. Running add_user_email_backfill migration...');
    await client.query(sql);
    console.log('add_user_email_backfill migration applied successfully.');
  } catch (err) {
    console.error('add_user_email_backfill migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
