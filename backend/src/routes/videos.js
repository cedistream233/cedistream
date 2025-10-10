import { Router } from 'express';
import { query } from '../lib/database.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { orderBy = 'created_at', direction = 'desc', q } = req.query;
    
    // Validate orderBy to prevent SQL injection
  const validOrderFields = ['created_at', 'title', 'price', 'release_date'];
    const validDirections = ['asc', 'desc'];
    
    const orderField = validOrderFields.includes(orderBy) ? orderBy : 'created_at';
    const orderDirection = validDirections.includes(direction.toLowerCase()) ? direction.toUpperCase() : 'DESC';
    
    const params = [];
    let where = '';
    if (q && String(q).trim() !== '') {
      const needle = `%${String(q).toLowerCase()}%`;
      where = `WHERE (LOWER(title) LIKE $1 OR LOWER(COALESCE(creator, '')) LIKE $2)`;
      params.push(needle, needle);
    }
    const result = await query(
      `SELECT * FROM videos ${where} ORDER BY ${orderField} ${orderDirection}`,
      params
    );
    
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM videos WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;
