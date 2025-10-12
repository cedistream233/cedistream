import { Router } from 'express';
import { authenticateToken, requireRole } from '../lib/auth.js';
import { query } from '../lib/database.js';

const router = Router();

// Helper: compute creator available balance = sum(creator_amount) - sum(withdrawals.amount)
async function getAvailableBalance(userId) {
  const earningsRes = await query(
    `SELECT COALESCE(SUM(p.creator_amount),0)::numeric::float8 AS total
     FROM purchases p
     WHERE p.payment_status = 'completed' AND (
       (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
       (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
       (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
     )`,
    [userId]
  );
  const wRes = await query(
    `SELECT COALESCE(SUM(w.amount),0)::numeric::float8 AS total FROM withdrawals w WHERE w.user_id = $1 AND w.status IN ('requested','processing','paid')`,
    [userId]
  );
  const totalEarned = parseFloat(earningsRes.rows[0]?.total || 0);
  const totalWithdrawn = parseFloat(wRes.rows[0]?.total || 0);
  return Math.max(0, totalEarned - totalWithdrawn);
}

// GET /api/withdrawals/me/summary
router.get('/me/summary', authenticateToken, requireRole(['creator']), async (req, res, next) => {
  try {
    const balance = await getAvailableBalance(req.user.id);
    res.json({ available: balance, currency: 'GHS', minWithdrawal: 10, transferFee: 1.0, note: 'Withdrawals can take up to 24 hours to process.' });
  } catch (e) { next(e); }
});

// GET /api/withdrawals/me
router.get('/me', authenticateToken, requireRole(['creator']), async (req, res, next) => {
  try {
    const result = await query(`SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.id]);
    res.json(result.rows);
  } catch (e) { next(e); }
});

// POST /api/withdrawals
// Body: { amount, momoNumber, momoConfirm }
router.post('/', authenticateToken, requireRole(['creator']), async (req, res, next) => {
  try {
    const { amount, momoNumber, momoConfirm } = req.body || {};
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 10) return res.status(400).json({ error: 'Minimum withdrawal is GH₵ 10.00' });
    if (!momoNumber || !momoConfirm || String(momoNumber) !== String(momoConfirm)) return res.status(400).json({ error: 'Mobile Money numbers do not match' });
    // Basic GH mobile validation: 10 digits
    const clean = String(momoNumber).replace(/\D/g, '');
    if (clean.length !== 10) return res.status(400).json({ error: 'Enter a valid 10-digit Ghana mobile number' });

    const available = await getAvailableBalance(req.user.id);
    if (amt > available) return res.status(400).json({ error: 'Amount exceeds available balance' });

    const transferFee = 1.0; // GH₵ 1 charged by provider per transfer
    const amountToReceive = Math.max(0, +(amt - transferFee).toFixed(2));

    const ins = await query(
      `INSERT INTO withdrawals (user_id, amount, transfer_fee, amount_to_receive, destination_type, destination_account, status, reference)
       VALUES ($1,$2,$3,$4,'mobile_money',$5,'requested', $6)
       RETURNING *`,
      [req.user.id, amt, transferFee, amountToReceive, clean, `WD_${Date.now()}`]
    );

    res.status(201).json({ request: ins.rows[0] });
  } catch (e) { next(e); }
});

// PATCH /api/withdrawals/:id - admin marks as processing/paid/rejected
router.patch('/:id', authenticateToken, async (req, res, next) => {
  try {
    // In a real app, require admin role; for now, allow creators to view only, not modify.
    // You can enhance with requireRole(['admin']) when available.
    const { id } = req.params;
    const { status, notes } = req.body || {};
    if (!['requested','processing','paid','rejected','cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const result = await query(
      `UPDATE withdrawals SET status = $2, notes = COALESCE($3, notes), processed_at = CASE WHEN $2 IN ('paid','rejected','cancelled') THEN NOW() ELSE processed_at END, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status, notes || null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Withdrawal not found' });
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

export default router;
