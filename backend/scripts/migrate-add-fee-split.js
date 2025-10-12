import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reuse the generic apply-migration script to apply our SQL
const sqlPath = path.join(__dirname, '..', 'database', 'add_fee_split_and_payment_columns.sql');

const child = spawn(process.execPath, [path.join(__dirname, 'apply-migration.js'), sqlPath], {
  stdio: 'inherit'
});

child.on('exit', (code) => process.exit(code || 0));
