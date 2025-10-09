import { Router } from 'express';
import { query } from '../lib/database.js';
import { authenticateToken, requireRole } from '../lib/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { orderBy = 'created_at', direction = 'desc', genre } = req.query;
    
    // Validate orderBy to prevent SQL injection
    const validOrderFields = ['created_at', 'title', 'price', 'release_date'];
    const validDirections = ['asc', 'desc'];
    
    const orderField = validOrderFields.includes(orderBy) ? orderBy : 'created_at';
    const orderDirection = validDirections.includes(direction.toLowerCase()) ? direction.toUpperCase() : 'DESC';
    
    let whereClause = '';
    let queryParams = [];
    
    if (genre && genre !== 'All Genres') {
      whereClause = 'WHERE a.genre = $1';
      queryParams.push(genre);
    }
    
    const result = await query(
      `SELECT a.*, 
              u.first_name, u.last_name,
              cp.stage_name,
              COALESCE(cp.stage_name, u.first_name || ' ' || u.last_name) as artist
       FROM albums a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN creator_profiles cp ON u.id = cp.user_id
       ${whereClause}
       ORDER BY a.${orderField} ${orderDirection}`,
      queryParams
    );
    
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT a.*, 
              u.first_name, u.last_name, u.profile_image,
              cp.stage_name, cp.social_media,
              COALESCE(cp.stage_name, u.first_name || ' ' || u.last_name) as artist
       FROM albums a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN creator_profiles cp ON u.id = cp.user_id
       WHERE a.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Album not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;
