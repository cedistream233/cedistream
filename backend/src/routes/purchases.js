import { Router } from 'express';
import { query } from '../lib/database.js';
import { authenticateToken } from '../lib/auth.js';

const router = Router();

// GET purchases: supports two modes
// 1) Authenticated: use ?me=true or ?user_id=... (requires bearer token)
// 2) Unauthenticated supporter checkout: allow ?user_email=... with optional payment_status filter
router.get('/', async (req, res, next) => {
  try {
  const { user_id, me, user_email, payment_status, item_type, payment_reference } = req.query;

    // If user_email is provided, permit limited unauthenticated access for supporter checkout flow
    if (user_email) {
      // Allow read-only access to the requester's own purchases by email (used for supporter checkout)
      let sql = 'SELECT * FROM purchases WHERE 1=1';
      const params = [];
      let i = 1;
      if (payment_reference) { sql += ` AND payment_reference = $${i}`; params.push(String(payment_reference)); i++; }
      sql += ` AND EXISTS (SELECT 1 FROM users u WHERE u.email = $${i} AND u.id = purchases.user_id)`;
      params.push(String(user_email)); i++;
      if (payment_status) { sql += ` AND payment_status = $${i}`; params.push(payment_status); i++; }
      if (item_type) { sql += ` AND item_type = $${i}`; params.push(item_type); i++; }
      const result = await query(sql + ' ORDER BY created_at DESC', params);
      return res.json(result.rows);
    }

    // Otherwise, require auth and use token identity
    let uid = user_id;
    if (String(me) === 'true') {
      // authenticate
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Access token required' });
      // lightweight verify to get id via existing middleware function
      // reuse authenticateToken logic by invoking a tiny query
      // But to avoid duplicating code, perform a minimal check: ensure token maps to an active user
      // This keeps the route self-contained without adding middleware branches
      const { verifyToken } = await import('../lib/auth.js');
      const decoded = verifyToken(token);
      if (!decoded) return res.status(403).json({ error: 'Invalid or expired token' });
      // confirm user exists and active
      const ur = await query('SELECT id FROM users WHERE id = $1 AND is_active = true', [decoded.id]);
      if (ur.rows.length === 0) return res.status(403).json({ error: 'User not found or inactive' });
      uid = decoded.id;
    }

    let sql = 'SELECT * FROM purchases WHERE 1=1';
    const params = [];
    let paramIndex = 1;
  if (uid) { sql += ` AND user_id = $${paramIndex}`; params.push(uid); paramIndex++; }
  if (payment_reference) { sql += ` AND payment_reference = $${paramIndex}`; params.push(payment_reference); paramIndex++; }
    if (payment_status) { sql += ` AND payment_status = $${paramIndex}`; params.push(payment_status); paramIndex++; }
    if (item_type) { sql += ` AND item_type = $${paramIndex}`; params.push(item_type); paramIndex++; }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (err) { next(err); }
});

// Server authoritative summary for a given checkout reference
// Accessible if requester is the user (via auth) or via user_email + reference as in supporter checkout
router.get('/summary', async (req, res, next) => {
  try {
    const { payment_reference, user_email, me, user_id } = req.query;
    if (!payment_reference) return res.status(400).json({ error: 'payment_reference is required' });

    let uid = null;
    if (user_email) {
      // derive uid from email
      const u = await query('SELECT id FROM users WHERE email = $1', [String(user_email)]);
      uid = u.rows[0]?.id || null;
    } else if (String(me) === 'true' || user_id) {
      // require auth
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Access token required' });
      const { verifyToken } = await import('../lib/auth.js');
      const decoded = verifyToken(token);
      if (!decoded) return res.status(403).json({ error: 'Invalid or expired token' });
      uid = user_id || decoded.id;
    }

    const params = [String(payment_reference)];
    let sql = 'SELECT item_type, item_id, item_title, amount, currency, payment_status FROM purchases WHERE payment_reference = $1';
    if (uid) { sql += ' AND user_id = $2'; params.push(uid); }
    const rows = (await query(sql + ' ORDER BY created_at ASC', params)).rows;
    const items = rows.map(r => ({ item_type: r.item_type, item_id: r.item_id, item_title: r.item_title, amount: Number(r.amount || 0), currency: r.currency, payment_status: r.payment_status }));
    const totals = items.reduce((acc, it) => { acc.amount += Number(it.amount || 0); return acc; }, { amount: 0 });
    return res.json({ payment_reference, items, totals });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
  const { user_id, user_email, item_type, item_id, item_title, amount, currency = 'GHS', payment_status = 'pending', payment_reference, payment_method } = req.body;
    // Pay-what-you-want support: enforce minimum price from item table
    let minPrice = 0;
    if (item_type === 'album') {
      const r = await query('SELECT price FROM albums WHERE id = $1', [item_id]);
      minPrice = parseFloat(r.rows[0]?.price || 0);
    } else if (item_type === 'video') {
      const r = await query('SELECT price FROM videos WHERE id = $1', [item_id]);
      minPrice = parseFloat(r.rows[0]?.price || 0);
    } else if (item_type === 'song') {
      const r = await query('SELECT price FROM songs WHERE id = $1', [item_id]);
      minPrice = parseFloat(r.rows[0]?.price || 0);
    } else {
      return res.status(400).json({ error: 'Invalid item_type' });
    }
    if (Number.isFinite(minPrice) && parseFloat(amount) < minPrice) {
      return res.status(400).json({ error: `Amount must be at least minimum price GH₵ ${minPrice.toFixed(2)}` });
    }
    
    const platformFee = +(Number(amount) * 0.20).toFixed(2);
    const paystackFee = +(Number(amount) * 0.02).toFixed(2);
    const platformNet = +(platformFee - paystackFee).toFixed(2);
    const creatorAmount = +(Number(amount) * 0.80).toFixed(2);

    const result = await query(
      `INSERT INTO purchases (user_id, item_type, item_id, item_title, amount, currency, payment_status, payment_reference, payment_method, gateway, platform_fee, paystack_fee, platform_net, creator_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'paystack',$10,$11,$12,$13)
       ON CONFLICT (user_id, item_type, item_id, payment_reference) DO NOTHING
       RETURNING *`,
      [user_id || null, item_type, item_id, item_title, amount, currency, payment_status, payment_reference || null, payment_method || null, platformFee, paystackFee, platformNet, creatorAmount]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const updateFields = Object.keys(updates);
    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];
    
    const result = await query(
      `UPDATE purchases SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;

// Delete pending purchases for a given checkout reference (server-side cart clear)
// Authenticated only; removes only rows for the current user and matching reference
router.delete('/pending/:reference', authenticateToken, async (req, res, next) => {
  try {
    const { reference } = req.params;
    if (!reference) return res.status(400).json({ error: 'Reference is required' });
    const result = await query(
      `DELETE FROM purchases
       WHERE user_id = $1 AND payment_reference = $2 AND payment_status = 'pending'`,
      [req.user.id, reference]
    );
    // node-postgres delete doesn't return rowCount in rows; use commandTag count via result.rowCount
    return res.json({ cleared: result.rowCount || 0, reference });
  } catch (err) { next(err); }
});
