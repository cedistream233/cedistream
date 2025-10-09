import { Router } from 'express';
import { query } from '../lib/database.js';

const router = Router();

// GET /api/creators?q=kwame
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    const params = [];
    let where = "WHERE u.role = 'creator'";

    if (q && String(q).trim() !== '') {
      params.push(`%${q.toLowerCase()}%`);
      params.push(`%${q.toLowerCase()}%`);
      where += ` AND (LOWER(COALESCE(cp.stage_name, '')) LIKE $${params.length - 1} OR LOWER(u.first_name || ' ' || u.last_name) LIKE $${params.length})`;
    }

    const result = await query(
      `SELECT u.id as user_id,
              u.first_name, u.last_name, u.profile_image,
              cp.stage_name,
              COALESCE(cp.stage_name, u.first_name || ' ' || u.last_name) as display_name,
              -- content counts (best-effort if tables exist)
              COALESCE((SELECT COUNT(1) FROM albums a WHERE a.user_id = u.id), 0) as albums_count,
              COALESCE((SELECT COUNT(1) FROM videos v WHERE v.user_id = u.id), 0) as videos_count,
              COALESCE((SELECT COUNT(1) FROM songs s WHERE s.user_id = u.id), 0) as songs_count,
              -- recent songs (top 3)
              (SELECT COALESCE(json_agg(row_to_json(sq)), '[]'::json) FROM (SELECT id, title, price FROM songs s WHERE s.user_id = u.id ORDER BY s.created_at DESC LIMIT 3) sq) as recent_songs
       FROM users u
       LEFT JOIN creator_profiles cp ON cp.user_id = u.id
       ${where}
       ORDER BY display_name ASC
       LIMIT 50`,
      params
    );

    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/creators/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userRes = await query(
      `SELECT u.id as user_id,
              u.first_name, u.last_name, u.profile_image, u.bio,
              cp.stage_name, cp.genre_specialties, cp.social_media,
              COALESCE(cp.stage_name, u.first_name || ' ' || u.last_name) as display_name,
              COALESCE((SELECT COUNT(1) FROM albums a WHERE a.user_id = u.id), 0) as albums_count,
              COALESCE((SELECT COUNT(1) FROM videos v WHERE v.user_id = u.id), 0) as videos_count,
              COALESCE((SELECT COUNT(1) FROM songs s WHERE s.user_id = u.id), 0) as songs_count,
              (SELECT COALESCE(json_agg(row_to_json(sq)), '[]'::json) FROM (SELECT id, title, price FROM songs s WHERE s.user_id = u.id ORDER BY s.created_at DESC LIMIT 6) sq) as recent_songs
       FROM users u
       LEFT JOIN creator_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Creator not found' });

    // counts
    const countsRes = await query(
      `SELECT
         (SELECT COUNT(1) FROM albums a WHERE a.user_id = $1) as albums_count,
         (SELECT COUNT(1) FROM videos v WHERE v.user_id = $1) as videos_count`,
      [id]
    );

    res.json({ ...userRes.rows[0], ...(countsRes.rows[0] || {}) });
  } catch (err) { next(err); }
});

// GET /api/creators/:id/content
router.get('/:id/content', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [albumsRes, videosRes] = await Promise.all([
      query(
        `SELECT a.*, COALESCE(cp.stage_name, u.first_name || ' ' || u.last_name) as artist
         FROM albums a
         JOIN users u ON a.user_id = u.id
         LEFT JOIN creator_profiles cp ON u.id = cp.user_id
         WHERE a.user_id = $1
         ORDER BY a.created_at DESC`,
        [id]
      ),
      query(
        `SELECT v.*
         FROM videos v
         WHERE v.user_id = $1
         ORDER BY v.created_at DESC`,
        [id]
      )
    ]);

    res.json({ albums: albumsRes.rows, videos: videosRes.rows });
  } catch (err) { next(err); }
});

export default router;
