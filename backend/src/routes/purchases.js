import { Router } from 'express';
import { query } from '../lib/database.js';
import { authenticateToken } from '../lib/auth.js';
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
    const { user_email, item_type, item_id, item_title, amount, payment_status = 'pending', payment_reference, payment_method } = req.body;
    
    const result = await query(
      'INSERT INTO purchases (user_email, item_type, item_id, item_title, amount, payment_status, payment_reference, payment_method) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [user_email, item_type, item_id, item_title, amount, payment_status, payment_reference, payment_method]
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
