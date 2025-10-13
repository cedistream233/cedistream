import express from 'express';
import { query } from '../lib/database.js';

const router = express.Router();

// Ensure table exists (best-effort, no throw if fails)
async function ensureTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        subject TEXT,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE
      );
    `);
  } catch (_) { /* ignore */ }
}
ensureTable();

// POST /api/support - create ticket
router.post('/', async (req, res) => {
  const { name = '', email = '', phone = '', subject = '', message = '' } = req.body || {};
  if (!name.trim() || !email.trim() || !message.trim()) return res.status(400).json({ error: 'Missing fields' });
  try {
    const result = await query(
      `INSERT INTO support_tickets (name, email, phone, subject, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), email.trim(), phone.trim(), subject.trim(), message.trim()]
    );
    return res.json(result.rows[0]);
  } catch (e) {
    console.error('support insert failed', e);
    // Best-effort fallback: don\'t fail hard
    return res.status(200).json({ ok: true });
  }
});

// Shared list handler to be reused by server.js
export const listTicketsHandler = async (req, res) => {
  const status = (req.query.status || 'open').toString();
  try {
    let q = 'SELECT * FROM support_tickets ORDER BY created_at DESC';
    let params = [];
    if (status !== 'all') {
      q = 'SELECT * FROM support_tickets WHERE status = $1 ORDER BY created_at DESC';
      params = [status];
    }
    const result = await query(q, params);
    return res.json(result.rows);
  } catch (e) {
    console.error('support list failed', e);
    return res.json([]);
  }
};

// Keep also as /api/support/tickets for convenience
router.get('/tickets', listTicketsHandler);

// PATCH /api/support/tickets/:id/resolve - mark ticket resolved
router.patch('/tickets/:id/resolve', async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await query(
      `UPDATE support_tickets SET status='resolved', resolved_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!result || !result.rows || result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json(result.rows[0]);
  } catch (e) {
    console.error('resolve ticket failed', e);
    return res.status(500).json({ error: 'Failed' });
  }
});

export default router;
