import { Router } from 'express';
import { query } from '../lib/database.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { orderBy = 'created_at', direction = 'desc' } = req.query;
    
    // Validate orderBy to prevent SQL injection
    const validOrderFields = ['created_at', 'title', 'creator', 'price', 'release_date'];
    const validDirections = ['asc', 'desc'];
    
    const orderField = validOrderFields.includes(orderBy) ? orderBy : 'created_at';
    const orderDirection = validDirections.includes(direction.toLowerCase()) ? direction.toUpperCase() : 'DESC';
    
    const result = await query(
      `SELECT * FROM videos ORDER BY ${orderField} ${orderDirection}`,
      []
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
