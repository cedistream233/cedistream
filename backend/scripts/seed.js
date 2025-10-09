import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.join(__dirname, '..', '..', 'database', 'seed.sql');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set in environment. Aborting.');
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, { encoding: 'utf8' });

(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to database. Running seed...');
    await client.query(sql);
    console.log('Seed applied successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
