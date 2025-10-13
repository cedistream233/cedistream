import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Dynamically import database after env is loaded so DATABASE_URL is available
const { query, closePool } = await import('../src/lib/database.js');

async function run() {
  try {
    const res = await query(
      `UPDATE purchases
       SET payment_status = 'failed', updated_at = NOW()
       WHERE payment_status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes'
       RETURNING id, user_id, user_email, item_type, item_id, payment_reference;`
    );
    console.log(`Marked ${res.rowCount} pending purchases as failed.`);
    if (res.rowCount) {
      console.table(res.rows.map(r => ({ id: r.id, user_id: r.user_id, user_email: r.user_email, ref: r.payment_reference })));
    }
  } catch (e) {
    console.error('Failed to mark stale purchases:', e);
    process.exit(1);
  } finally {
    await closePool();
  }
}

run();
