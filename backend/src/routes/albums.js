import { Router } from 'express';
import { query } from '../lib/database.js';
import { authenticateToken, requireRole } from '../lib/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { orderBy = 'created_at', direction = 'desc', q } = req.query;
    
    // Validate orderBy to prevent SQL injection
    const validOrderFields = ['created_at', 'title', 'price', 'release_date'];
    const validDirections = ['asc', 'desc'];
    
    const orderField = validOrderFields.includes(orderBy) ? orderBy : 'created_at';
    const orderDirection = validDirections.includes(direction.toLowerCase()) ? direction.toUpperCase() : 'DESC';
    
    const conds = [];
    const queryParams = [];
    if (q && String(q).trim() !== '') {
      const needle = `%${String(q).toLowerCase()}%`;
      queryParams.push(needle, needle);
      conds.push(`(LOWER(a.title) LIKE $1 OR LOWER(COALESCE(cp.stage_name, u.first_name || ' ' || u.last_name)) LIKE $2)`);
    }
    const whereClause = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    
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
    
    const album = result.rows[0];
    
    // Enrich album.songs with preview_url from songs table so frontend can skip fetch when null
    if (album.songs && Array.isArray(album.songs)) {
      try {
        const songIds = album.songs.map(s => s.id).filter(Boolean);
        if (songIds.length > 0) {
          const songsRes = await query(
            `SELECT id, preview_url FROM songs WHERE id = ANY($1::uuid[])`,
            [songIds]
          );
          const previewMap = Object.fromEntries(songsRes.rows.map(r => [r.id, r.preview_url]));
          album.songs = album.songs.map(s => ({ ...s, preview_url: previewMap[s.id] || null }));
        }
      } catch (e) {
        // If songs table doesn't exist or query fails, continue without preview_url enrichment
      }
    }
    
    res.json(album);
  } catch (err) { next(err); }
});

export default router;

// PATCH /api/albums/:id - update allowed album fields (creator only, owner check)
router.patch('/:id', authenticateToken, requireRole(['creator']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    // Ownership check
    const ownerRes = await query('SELECT user_id FROM albums WHERE id = $1', [id]);
    if (!ownerRes.rows.length) return res.status(404).json({ error: 'Album not found' });
    if (ownerRes.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    // Only allow updating price for now
    const updates = [];
    const params = [];
    let idx = 1;
    if (typeof price !== 'undefined') {
      updates.push(`price = $${idx++}`);
      params.push(Number(price));
    }

    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(id);
    const q = `UPDATE albums SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const result = await query(q, params);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});
