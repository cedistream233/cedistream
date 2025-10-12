import { Router } from 'express';
import { query } from '../lib/database.js';
import { authenticateToken } from '../lib/auth.js';

const router = Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { user_id, me, payment_status, item_type } = req.query;
    let sql = 'SELECT * FROM purchases WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    const uid = String(me) === 'true' ? req.user?.id : user_id;
    if (uid) { sql += ` AND user_id = $${paramIndex}`; params.push(uid); paramIndex++; }
    if (payment_status) {
      sql += ` AND payment_status = $${paramIndex}`;
      params.push(payment_status);
      paramIndex++;
    }
    if (item_type) {
      sql += ` AND item_type = $${paramIndex}`;
      params.push(item_type);
      paramIndex++;
    }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
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
       ON CONFLICT ON CONSTRAINT uniq_purchase_by_ref_user_item DO NOTHING
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
