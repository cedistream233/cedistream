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

// Admin: list withdrawals with optional status filter
// GET /api/withdrawals/admin?status=requested|processing|paid|rejected|cancelled (default: requested,processing)
router.get('/admin', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const { status, from, to, page = '1', limit = '25' } = req.query;
    let statuses = ['requested', 'processing'];
    if (status) {
      const parts = String(status).split(',').map(s => s.trim().toLowerCase());
      const allowed = ['requested','processing','paid','rejected','cancelled'];
      statuses = parts.filter(s => allowed.includes(s));
      if (!statuses.length) statuses = ['requested','processing'];
    }
    const params = [];
    let p = 1;
    const placeholders = statuses.map(() => `$${p++}`).join(',');
    params.push(...statuses);
    let dateCond = '';
    if (from) { dateCond += ` AND w.created_at >= $${p++}`; params.push(from); }
    if (to) { dateCond += ` AND w.created_at <= $${p++}`; params.push(to); }
    // pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * pageSize;
    const sql = `
      SELECT w.*,
             u.email, u.username, u.first_name, u.last_name, u.phone
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      WHERE w.status IN (${placeholders})${dateCond}
      ORDER BY w.created_at ASC
      LIMIT $${p++} OFFSET $${p++}`;
    const result = await query(sql, [...params, pageSize, offset]);
    // total count
    const countSql = `SELECT COUNT(1)::int AS total FROM withdrawals w WHERE w.status IN (${placeholders})${dateCond}`;
    const totalRes = await query(countSql, params);
    res.json({ items: result.rows, page: pageNum, limit: pageSize, total: totalRes.rows[0]?.total || 0 });
  } catch (e) { next(e); }
});

// Admin: summary counts by status for dashboard cards
router.get('/admin/summary', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const q = await query(`
      SELECT status, COUNT(1)::int AS count
      FROM withdrawals
      GROUP BY status
    `);
    const counts = { requested: 0, processing: 0, paid: 0, rejected: 0, cancelled: 0 };
    for (const r of q.rows) counts[r.status] = r.count;
    res.json({ counts });
  } catch (e) { next(e); }
});

// Admin: CSV export of withdrawals with filters
router.get('/admin/export', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const { status, from, to, page = '1', limit = '1000' } = req.query;
    let statuses = null;
    if (status) {
      const parts = String(status).split(',').map(s => s.trim().toLowerCase());
      const allowed = ['requested','processing','paid','rejected','cancelled'];
      statuses = parts.filter(s => allowed.includes(s));
    }
    const params = [];
    let p = 1;
    let where = 'WHERE 1=1';
    if (statuses && statuses.length) {
      const placeholders = statuses.map(() => `$${p++}`).join(',');
      where += ` AND w.status IN (${placeholders})`;
      params.push(...statuses);
    }
    if (from) { where += ` AND w.created_at >= $${p++}`; params.push(from); }
    if (to) { where += ` AND w.created_at <= $${p++}`; params.push(to); }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(10000, Math.max(1, parseInt(limit, 10) || 1000));
    const offset = (pageNum - 1) * pageSize;
    const sql = `
      SELECT w.id, w.created_at, w.status, w.amount, w.transfer_fee, w.amount_to_receive,
             w.destination_type, w.destination_account, w.reference, w.notes,
             u.id AS user_id, u.email, u.username, u.first_name, u.last_name, u.phone
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      ${where}
      ORDER BY w.created_at ASC
      LIMIT $${p++} OFFSET $${p++}`;
    const result = await query(sql, [...params, pageSize, offset]);
    const rows = result.rows || [];
    const header = [
      'id','created_at','status','amount','transfer_fee','amount_to_receive','destination_type','destination_account','reference','notes',
      'user_id','email','username','first_name','last_name','phone'
    ];
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const lines = [header.map(escape).join(',')];
    for (const r of rows) {
      lines.push([
        r.id, r.created_at?.toISOString?.() || r.created_at, r.status, r.amount, r.transfer_fee, r.amount_to_receive,
        r.destination_type, r.destination_account, r.reference || '', r.notes || '',
        r.user_id, r.email, r.username || '', r.first_name || '', r.last_name || '', r.phone || ''
      ].map(escape).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="withdrawals.csv"');
    res.send(csv);
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
router.patch('/:id', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    // In a real app, require admin role; for now, allow creators to view only, not modify.
    // You can enhance with requireRole(['admin']) when available.
  const { id } = req.params;
  let { status, notes, reference } = req.body || {};
  // Normalize synonyms
  const synonyms = { approved: 'paid', declined: 'rejected' };
  status = synonyms[status] || status;
  const allowed = ['requested','processing','paid','rejected','cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    // Optional: enforce simple transition rules
    const existing = await query('SELECT status FROM withdrawals WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Withdrawal not found' });
    const from = existing.rows[0].status;
    const invalid = (from === 'paid' || from === 'rejected' || from === 'cancelled');
    if (invalid) return res.status(400).json({ error: `Cannot change status from terminal state '${from}'` });

    const result = await query(
      `UPDATE withdrawals 
       SET status = $2,
           notes = COALESCE($3, notes),
           reference = COALESCE($4, reference),
           processed_at = CASE WHEN $2 IN ('paid','rejected','cancelled') THEN NOW() ELSE processed_at END,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status, notes || null, reference || null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Withdrawal not found' });
    // Insert audit record
    await query(
      `INSERT INTO withdrawals_audit (withdrawal_id, admin_id, previous_status, new_status, notes, reference)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.user.id, from, status, notes || null, reference || null]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

// Admin: fetch audit log for a withdrawal
router.get('/:id/audit', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await query(
      `SELECT a.*, u.email as admin_email, u.username as admin_username
       FROM withdrawals_audit a
       LEFT JOIN users u ON u.id = a.admin_id
       WHERE a.withdrawal_id = $1
       ORDER BY a.created_at DESC`,
      [id]
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

export default router;
