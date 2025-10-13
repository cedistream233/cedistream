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
      const norm = String(q).toLowerCase().replace(/\s+/g, '');
      // Match ignoring case and whitespace: compare against stage_name and full name with spaces removed
      params.push(`%${norm}%`);
      params.push(`%${norm}%`);
      where += ` AND (
        REPLACE(LOWER(COALESCE(cp.stage_name, '')), ' ', '') LIKE $${params.length - 1}
        OR REPLACE(LOWER(u.first_name || ' ' || u.last_name), ' ', '') LIKE $${params.length}
      )`;
    }

    const result = await query(
      `SELECT u.id as user_id,
              u.first_name, u.last_name, u.profile_image,
              cp.stage_name,
              COALESCE(cp.stage_name, u.first_name || ' ' || u.last_name) as display_name,
              -- content counts (best-effort if tables exist)
              COALESCE((SELECT COUNT(1) FROM albums a WHERE a.user_id = u.id), 0) as albums_count,
              COALESCE((SELECT COUNT(1) FROM videos v WHERE v.user_id = u.id), 0) as videos_count,
              COALESCE((SELECT COUNT(1) FROM songs s WHERE s.user_id = u.id AND s.album_id IS NULL), 0) as songs_count,
              -- recent singles (top 3)
              (SELECT COALESCE(json_agg(row_to_json(sq)), '[]'::json)
                 FROM (
                   SELECT id, title, price
                   FROM songs s
                   WHERE s.user_id = u.id AND s.album_id IS NULL
                   ORDER BY s.created_at DESC
                   LIMIT 3
                 ) sq
              ) as recent_songs
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
              COALESCE((SELECT COUNT(1) FROM songs s WHERE s.user_id = u.id AND s.album_id IS NULL), 0) as songs_count,
              (SELECT COALESCE(json_agg(row_to_json(sq)), '[]'::json)
                 FROM (
                   SELECT id, title, price
                   FROM songs s
                   WHERE s.user_id = u.id AND s.album_id IS NULL
                   ORDER BY s.created_at DESC
                   LIMIT 6
                 ) sq
              ) as recent_songs
       FROM users u
       LEFT JOIN creator_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Creator not found' });
    // counts (already part of userRes but keep for compatibility) and earnings
    const totalsRes = await query(
      `SELECT
         COALESCE((SELECT COUNT(1) FROM albums a WHERE a.user_id = $1), 0) as albums_count,
         COALESCE((SELECT COUNT(1) FROM videos v WHERE v.user_id = $1), 0) as videos_count,
        -- Use creator_amount (net) for total earnings so creators see their net revenue after platform fees
        COALESCE((SELECT SUM(p.creator_amount) FROM purchases p
                     WHERE p.payment_status = 'completed' AND (
                       (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
                       (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
                       (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
                     )), 0) as total_earnings,
         COALESCE((SELECT COUNT(1) FROM purchases p
                    WHERE p.payment_status = 'completed' AND (
                      (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
                      (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
                      (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
                    )), 0) as total_sales
       `,
      [id]
    );

    res.json({ ...userRes.rows[0], ...(totalsRes.rows[0] || {}) });
  } catch (err) { next(err); }
});

// GET /api/creators/:id/content
router.get('/:id/content', async (req, res, next) => {
  try {
    const { id } = req.params;
  const [albumsRes, videosRes, songsRes] = await Promise.all([
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
        ,
        query(
          `SELECT s.id, s.title, s.price, s.created_at, s.cover_image, s.preview_url, s.album_id
           FROM songs s
           WHERE s.user_id = $1
           ORDER BY s.created_at DESC`,
          [id]
        )
    ]);

      res.json({ albums: albumsRes.rows, videos: videosRes.rows, songs: songsRes.rows });
  } catch (err) { next(err); }
});

// GET /api/creators/:id/analytics
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const { id } = req.params;
    // support only ?range=7|14 days per product requirement
    let days = parseInt(req.query.range || '14', 10);
    if (![7, 14].includes(days)) days = 14;
    // Build last 30 days dates
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      dates.push(iso);
    }

    // Revenue per day from purchases where item belongs to this creator
    const revenueRes = await query(
      `SELECT to_char(p.created_at::date, 'YYYY-MM-DD') as day, COALESCE(SUM(p.amount),0) as total
       FROM purchases p
       WHERE p.payment_status = 'completed' AND (
         (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
         (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
         (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
       ) AND p.created_at >= (NOW() - ($2 || ' days')::interval)
       GROUP BY day`,
      [id, String(days)]
    );

    const revMap = new Map((revenueRes.rows || []).map(r => [r.day, parseFloat(r.total)]));

    // Sales count per day
    const salesRes = await query(
      `SELECT to_char(p.created_at::date, 'YYYY-MM-DD') as day, COUNT(1)::int as count
       FROM purchases p
       WHERE p.payment_status = 'completed' AND (
         (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
         (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
         (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
       ) AND p.created_at >= (NOW() - ($2 || ' days')::interval)
       GROUP BY day`,
      [id, String(days)]
    );
    const salesMap = new Map((salesRes.rows || []).map(r => [r.day, parseInt(r.count, 10) || 0]));

    // Create series combining revenue and placeholder views (0)
  const series = dates.map(d => ({ date: d, revenue: revMap.get(d) || 0, sales: salesMap.get(d) || 0 }));

    // totals
    const totalRevenue = series.reduce((s, v) => s + (v.revenue || 0), 0);
    const totalSales = series.reduce((s, v) => s + (v.sales || 0), 0);
    const viewsThisMonth = 0; // placeholder - not tracked currently

    res.json({ series, totalRevenue, totalSales, monthlyRevenue: totalRevenue, viewsThisMonth });
  } catch (err) { next(err); }
});

// GET /api/creators/:id/payouts?from=2025-01-01&to=2025-01-31
router.get('/:id/payouts', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const whereClauses = [`p.payment_status = 'completed'`];
    const params = [id];
    let idx = 2;

    // restrict to items belonging to creator
    whereClauses.push(`(
      (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
      (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
      (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
    )`);

    if (from) {
      whereClauses.push(`p.created_at >= $${idx}`); params.push(from); idx++;
    }
    if (to) {
      whereClauses.push(`p.created_at <= $${idx}`); params.push(to); idx++;
    }

    const where = `WHERE ${whereClauses.join(' AND ')}`;

    const totalsQ = `SELECT COALESCE(SUM(p.creator_amount),0)::numeric::float8 as total_creator_amount, COALESCE(SUM(p.amount),0)::numeric::float8 as total_gross_amount, COUNT(1)::int as total_sales
      FROM purchases p
      ${where}`;

    const byItemQ = `SELECT p.item_type, p.item_id, p.item_title, COUNT(1)::int as sales, COALESCE(SUM(p.creator_amount),0)::numeric::float8 as creator_amount_total, COALESCE(SUM(p.amount),0)::numeric::float8 as gross_total
      FROM purchases p
      ${where}
      GROUP BY p.item_type, p.item_id, p.item_title
      ORDER BY creator_amount_total DESC
      LIMIT 200`;

    const [totRes, itemsRes] = await Promise.all([query(totalsQ, params), query(byItemQ, params)]);
    res.json({ totals: totRes.rows[0] || { total_creator_amount: 0, total_gross_amount: 0, total_sales: 0 }, items: itemsRes.rows });
  } catch (err) { next(err); }
});

export default router;

// Helpers: pagination parsing
function getPagination(qs) {
  const page = Math.max(1, parseInt(qs.page || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(qs.limit || '12', 10) || 12));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// GET /api/creators/:id/albums?page=&limit=
router.get('/:id/albums', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit, offset } = getPagination(req.query);
    const conds = ['a.user_id = $1'];
    const params = [id];
    let p = 2;
    const { search } = req.query;
    if (search) { conds.push(`LOWER(a.title) LIKE $${p}`); params.push(`%${String(search).toLowerCase()}%`); p++; }
    const where = `WHERE ${conds.join(' AND ')}`;
    const [itemsRes, countRes] = await Promise.all([
      query(
        `SELECT a.* FROM albums a ${where} ORDER BY a.created_at DESC LIMIT $${p} OFFSET $${p+1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(1)::int AS total FROM albums a ${where}`, params)
    ]);
    const total = countRes.rows[0]?.total || 0;
    res.json({ items: itemsRes.rows, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/creators/:id/songs?page=&limit=
router.get('/:id/songs', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit, offset } = getPagination(req.query);
    const conds = ['s.user_id = $1'];
    const params = [id];
    let p = 2;
    const { search } = req.query;
    if (search) { conds.push(`LOWER(s.title) LIKE $${p}`); params.push(`%${String(search).toLowerCase()}%`); p++; }
    // show only standalone singles (exclude tracks that belong to albums)
    conds.push('s.album_id IS NULL');
    const where = `WHERE ${conds.join(' AND ')}`;
    const [itemsRes, countRes] = await Promise.all([
      query(
        `SELECT s.id, s.title, s.price, s.status, s.created_at, s.cover_image, s.preview_url, s.album_id
         FROM songs s
         ${where}
         ORDER BY s.created_at DESC
         LIMIT $${p} OFFSET $${p+1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(1)::int AS total FROM songs s ${where}`, params)
    ]);
    const total = countRes.rows[0]?.total || 0;
    res.json({ items: itemsRes.rows, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/creators/:id/videos?page=&limit=
router.get('/:id/videos', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit, offset } = getPagination(req.query);
    const conds = ['v.user_id = $1'];
    const params = [id];
    let p = 2;
    const { search } = req.query;
    if (search) { conds.push(`LOWER(v.title) LIKE $${p}`); params.push(`%${String(search).toLowerCase()}%`); p++; }
    const where = `WHERE ${conds.join(' AND ')}`;
    const [itemsRes, countRes] = await Promise.all([
      query(
        `SELECT v.* FROM videos v ${where} ORDER BY v.created_at DESC LIMIT $${p} OFFSET $${p+1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(1)::int AS total FROM videos v ${where}`, params)
    ]);
    const total = countRes.rows[0]?.total || 0;
    res.json({ items: itemsRes.rows, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});
