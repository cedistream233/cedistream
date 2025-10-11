import { Router } from 'express';
import { query } from '../lib/database.js';
import { authenticateToken, requireRole } from '../lib/auth.js';

const router = Router();

// GET /api/songs?orderBy=created_at&direction=desc&user_id=...&album_id=...
router.get('/', async (req, res, next) => {
  try {
    const { orderBy = 'created_at', direction = 'desc', user_id, album_id, q } = req.query;
    const validOrderFields = ['created_at', 'title', 'price', 'release_date'];
    const validDirections = ['asc', 'desc'];
    const orderField = validOrderFields.includes(orderBy) ? orderBy : 'created_at';
    const orderDirection = validDirections.includes(String(direction).toLowerCase()) ? String(direction).toUpperCase() : 'DESC';

    const where = [];
    const params = [];
    let i = 1;
    if (user_id) { where.push(`s.user_id = $${i++}`); params.push(user_id); }
    if (album_id) { where.push(`s.album_id = $${i++}`); params.push(album_id); }
    if (q) {
      where.push(`(LOWER(s.title) LIKE $${i} OR LOWER(COALESCE(cp.stage_name, u.first_name || ' ' || u.last_name)) LIKE $${i+1})`);
      params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
      i += 2;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT s.*,
              COALESCE(cp.stage_name, u.first_name || ' ' || u.last_name) as artist
       FROM songs s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN creator_profiles cp ON cp.user_id = u.id
       ${whereSql}
       ORDER BY s.${orderField} ${orderDirection}`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM songs WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Song not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;

// PATCH /api/songs/:id - update allowed song fields (creator only, owner check)
router.patch('/:id', authenticateToken, requireRole(['creator']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    const ownerRes = await query('SELECT user_id FROM songs WHERE id = $1', [id]);
    if (!ownerRes.rows.length) return res.status(404).json({ error: 'Song not found' });
    if (ownerRes.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const updates = [];
    const params = [];
    let idx = 1;
    if (typeof price !== 'undefined') {
      updates.push(`price = $${idx++}`);
      params.push(Number(price));
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(id);

    const q = `UPDATE songs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const result = await query(q, params);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});
