#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load backend .env explicitly so DATABASE_URL is set when database.js runs
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { query, getPool, closePool } from '../src/lib/database.js';
async function run() {
  try {
    const arg = process.argv[2];
    if (!arg) {
      console.error('Usage: node apply-migration.js <path-to-sql-file>');
      process.exit(1);
    }
    const sqlPath = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
    if (!fs.existsSync(sqlPath)) {
      console.error('SQL file not found:', sqlPath);
      process.exit(1);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    // Split statements by semicolon but keep statements that contain non-whitespace
    const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const s of stmts) {
      console.log('Running SQL statement...');
      await query(s);
    }
    console.log('Migration applied successfully.');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    await closePool();
    process.exit(0);
  }
}

run();
