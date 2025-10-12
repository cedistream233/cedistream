import express from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { query } from '../lib/database.js';

import QueryStream from 'pg-query-stream';
import { getPool } from '../lib/database.js';
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to upload a file buffer to supabase and return public URL
async function uploadToStorage(bucket, path, buffer, contentType) {
  if (!supabase) throw new Error('Storage not configured');
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    cacheControl: '3600', upsert: true, contentType
  });
  if (error) throw error;
  const { data } = await supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl;
}

// Create or draft an album with cover and songs; publish optional
// multipart/form-data with fields:
//  title, description, price, genre, release_date, publish ("true"/"false")
//  cover (file)
//  songs (JSON array: [{title, price, duration, audio: <file field name>, preview: <file field name>, track_number}])
router.post('/albums', authenticateToken, requireRole(['creator']), upload.any(), async (req, res) => {
  try {
    const userId = req.user.id;
    const fields = req.body;
    const files = req.files || [];
    const byField = Object.create(null);
    for (const f of files) byField[f.fieldname] = f;

    const title = fields.title;
    const description = fields.description || null;
    const price = parseFloat(fields.price || '0');
    const genre = fields.genre || null;
    const releaseDate = fields.release_date || null;
  // Always publish immediately; no drafts or scheduling
  const publish = true;

    if (!title || !Number.isFinite(price)) {
      return res.status(400).json({ error: 'title and numeric price are required' });
    }

    let coverUrl = null;
    if (byField.cover) {
      const ext = (byField.cover.originalname.split('.').pop() || 'jpg').toLowerCase();
      const path = `albums/${userId}/${Date.now()}-cover.${ext}`;
      coverUrl = await uploadToStorage(process.env.SUPABASE_BUCKET_ALBUMS || 'albums', path, byField.cover.buffer, byField.cover.mimetype);
    }

    // create album row
    const albumRes = await query(
      `INSERT INTO albums (title, description, price, cover_image, release_date, genre, user_id, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, description, price, coverUrl, releaseDate, genre, userId, 'published', new Date()]
    );
    const album = albumRes.rows[0];

    // songs JSON field names map: audio and preview fields reference file fieldnames in request
    let songs = [];
    if (fields.songs) {
      try { songs = JSON.parse(fields.songs); } catch {}
    }
    const insertedSongs = [];
    for (const s of songs) {
      const stitle = s.title;
      const sprice = Number.isFinite(+s.price) ? +s.price : 0;
      const sduration = s.duration || null;
      const trackNo = s.track_number || null;
      let audioUrl = null, previewUrl = null;
      if (s.audio && byField[s.audio]) {
        const f = byField[s.audio];
        const ext = (f.originalname.split('.').pop() || 'mp3').toLowerCase();
        const path = `albums/${userId}/${album.id}/songs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        audioUrl = await uploadToStorage(process.env.SUPABASE_BUCKET_MEDIA || 'media', path, f.buffer, f.mimetype || 'audio/mpeg');
      }
      if (s.preview && byField[s.preview]) {
        const f = byField[s.preview];
        const ext = (f.originalname.split('.').pop() || 'mp3').toLowerCase();
        const pathPrev = `albums/${userId}/${album.id}/previews/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const previewBucket = process.env.SUPABASE_BUCKET_PREVIEWS || process.env.SUPABASE_BUCKET_MEDIA || 'media';
        previewUrl = await uploadToStorage(previewBucket, pathPrev, f.buffer, f.mimetype || 'audio/mpeg');
      }
      const ins = await query(
        `INSERT INTO songs (user_id, album_id, title, price, duration, cover_image, audio_url, preview_url, track_number, status, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [userId, album.id, stitle, sprice, sduration, coverUrl, audioUrl, previewUrl, trackNo, 'published', new Date()]
      );
      insertedSongs.push(ins.rows[0]);
    }

    // Also store lightweight tracklist in albums.songs JSONB for fast details view
    const tracklist = insertedSongs
      .sort((a,b) => (a.track_number||0) - (b.track_number||0))
      .map(s => ({ id: s.id, title: s.title, duration: s.duration, track_number: s.track_number }));
    await query('UPDATE albums SET songs = $2, updated_at = NOW() WHERE id = $1', [album.id, JSON.stringify(tracklist)]);

    res.status(201).json({ album: { ...album, songs: tracklist }, songs: insertedSongs });
  } catch (err) {
    console.error('Album upload error:', err);
    res.status(500).json({ error: 'Failed to upload album' });
  }
});

// Upload a single video with thumbnail
// fields: title, description, price, category, release_date, publish (true/false)
// files: video (required), thumbnail (optional)
router.post('/videos', authenticateToken, requireRole(['creator']), upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'preview', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Storage not configured' });
    const userId = req.user.id;
  const { title, description = null, price, category = null, release_date = null } = req.body;
    if (!title || !price) return res.status(400).json({ error: 'title and price are required' });
  // Always publish immediately
  const publishNow = true;

    const videoFile = req.files?.video?.[0];
    if (!videoFile) return res.status(400).json({ error: 'video file is required' });
    const thumbFile = req.files?.thumbnail?.[0];

    const vext = (videoFile.originalname.split('.').pop() || 'mp4').toLowerCase();
    const vpath = `videos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${vext}`;
    const videoBucket = process.env.SUPABASE_BUCKET_VIDEOS || process.env.SUPABASE_BUCKET_MEDIA || 'media';
    const videoUrl = await uploadToStorage(videoBucket, vpath, videoFile.buffer, videoFile.mimetype || 'video/mp4');

    let thumbUrl = null;
    if (thumbFile) {
      const text = (thumbFile.originalname.split('.').pop() || 'jpg').toLowerCase();
      const tpath = `thumbnails/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${text}`;
      const thumbBucket = process.env.SUPABASE_BUCKET_THUMBNAILS || process.env.SUPABASE_BUCKET_VIDEOS || process.env.SUPABASE_BUCKET_MEDIA || 'media';
      thumbUrl = await uploadToStorage(thumbBucket, tpath, thumbFile.buffer, thumbFile.mimetype || 'image/jpeg');
    }

    // optional preview file for video
    let previewUrl = null;
    const previewField = req.files?.preview?.[0];
    if (previewField) {
      const pext = (previewField.originalname.split('.').pop() || 'mp4').toLowerCase();
      const ppath = `videos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}-preview.${pext}`;
      const previewBucket = process.env.SUPABASE_BUCKET_PREVIEWS || process.env.SUPABASE_BUCKET_VIDEOS || process.env.SUPABASE_BUCKET_MEDIA || 'media';
      previewUrl = await uploadToStorage(previewBucket, ppath, previewField.buffer, previewField.mimetype || 'video/mp4');
    }

    const ins = await query(
      `INSERT INTO videos (title, description, price, thumbnail, video_url, preview_url, category, release_date, user_id, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [title, description, parseFloat(price), thumbUrl, videoUrl, previewUrl, category, release_date || null, userId, 'published', new Date()]
    );
    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error('Video upload error:', err);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Upload a single song (no album). Fields: title, description, price, genre, release_date; files: audio (required), cover (optional), preview (optional)
router.post('/songs', authenticateToken, requireRole(['creator']), upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
  { name: 'preview', maxCount: 1 }
]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description = null, price, release_date = null } = req.body;
    if (!title || !price) return res.status(400).json({ error: 'title and price are required' });

    const audioFile = req.files?.audio?.[0];
    if (!audioFile) return res.status(400).json({ error: 'audio file is required' });
    const coverFile = req.files?.cover?.[0];
    const previewFile = req.files?.preview?.[0];

    // upload audio
    const aext = (audioFile.originalname.split('.').pop() || 'mp3').toLowerCase();
    const apath = `songs/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${aext}`;
    const mediaBucket = process.env.SUPABASE_BUCKET_MEDIA || 'media';
    const audioUrl = await uploadToStorage(mediaBucket, apath, audioFile.buffer, audioFile.mimetype || 'audio/mpeg');

    // optional cover
    let coverUrl = null;
    if (coverFile) {
      const cext = (coverFile.originalname.split('.').pop() || 'jpg').toLowerCase();
      const cpath = `songs/${userId}/covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${cext}`;
      const coverBucket = process.env.SUPABASE_BUCKET_ALBUMS || process.env.SUPABASE_BUCKET_MEDIA || 'media';
      coverUrl = await uploadToStorage(coverBucket, cpath, coverFile.buffer, coverFile.mimetype || 'image/jpeg');
    }

    // optional preview
    let previewUrl = null;
    if (previewFile) {
      const pext = (previewFile.originalname.split('.').pop() || 'mp3').toLowerCase();
      const ppath = `songs/${userId}/previews/${Date.now()}-${Math.random().toString(36).slice(2)}.${pext}`;
      const previewBucket = process.env.SUPABASE_BUCKET_PREVIEWS || process.env.SUPABASE_BUCKET_MEDIA || 'media';
      previewUrl = await uploadToStorage(previewBucket, ppath, previewFile.buffer, previewFile.mimetype || 'audio/mpeg');
    }

    const ins = await query(
      `INSERT INTO songs (user_id, album_id, title, description, price, cover_image, audio_url, preview_url, release_date, status, published_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, 'published', NOW()) RETURNING *`,
      [userId, title, description, parseFloat(price), coverUrl, audioUrl, previewUrl, release_date || null]
    );
    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error('Song upload error:', err);
    res.status(500).json({ error: 'Failed to upload song' });
  }
});

// Recent sales for creator: aggregates purchases on creator's items
 router.get('/recent-sales', authenticateToken, requireRole(['creator']), async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.max(0, Number(req.query.limit || 10));
    // purchases joined with albums/videos by item_id; includes songs if table exists
    // include buyer name (from users if present) and payment_status
    const sql = `SELECT p.id, p.item_type, p.item_title as item, p.amount, p.creator_amount, p.created_at as date, p.payment_status,
      COALESCE(cp.stage_name, CONCAT(u.first_name, ' ', u.last_name), u.email, '—') as buyer_name
         FROM purchases p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN creator_profiles cp ON cp.user_id = u.id
                 WHERE p.payment_status = 'completed'
                   AND (
                     (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
                     (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
                     (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
                   )
                 ORDER BY p.created_at DESC
                 ${limit > 0 ? 'LIMIT ' + limit : ''}`;
    const result = await query(sql, [userId]);
    return res.json(result.rows);
  } catch (err) {
    // If schema isn't fully migrated yet (e.g., songs table or user_id columns missing), return empty list gracefully
    if (err && (err.code === '42P01' /* undefined_table */ || err.code === '42703' /* undefined_column */)) {
      return res.json([]);
    }
    console.error('recent-sales error:', err);
    return res.status(500).json({ error: 'Failed to load recent sales' });
  }
});

// Stream CSV export for all sales for a creator. Uses server-side streaming to avoid loading all rows into memory.
router.get('/sales-export', authenticateToken, requireRole(['creator']), async (req, res) => {
  let client;
  try {
    const userId = req.user.id;
    const limit = Number.isFinite(Number(req.query.limit)) ? parseInt(req.query.limit, 10) : 0;
    const offset = Number.isFinite(Number(req.query.offset)) ? parseInt(req.query.offset, 10) : 0;

    const pool = getPool();
    client = await pool.connect();

    let sql = `
      SELECT p.created_at as date, p.item_type, p.item_title as item, p.amount, p.payment_status,
        COALESCE(cp.stage_name, CONCAT(u.first_name, ' ', u.last_name), u.email, '') as buyer_name
      FROM purchases p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN creator_profiles cp ON cp.user_id = u.id
      WHERE p.payment_status = 'completed'
        AND (
          (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
          (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
          (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
        )
      ORDER BY p.created_at DESC
    `;
    const params = [userId];
    if (limit > 0) {
      sql += ' LIMIT $2 OFFSET $3';
      params.push(limit, offset);
    }

    const qs = new QueryStream(sql, params);
    const stream = client.query(qs);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="sales-${userId}.csv"`);
  // header (creator_amount only)
  res.write('Date,Type,Item,Amount,Buyer Name,Payment Status\n');

    const esc = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    stream.on('data', row => {
      // export creator_amount (net) as Amount for creator-focused CSV
      const line = [row.date, row.item_type, row.item, row.creator_amount, row.buyer_name, row.payment_status]
        .map(esc).join(',') + '\n';
      const ok = res.write(line);
      if (!ok) {
        stream.pause();
        res.once('drain', () => stream.resume());
      }
    });

    stream.on('end', () => {
      res.end();
      client.release();
    });
    stream.on('error', err => {
      console.error('sales-export stream error', err);
      try { res.status(500).end(); } catch (e) {}
      client.release();
    });

  } catch (err) {
    console.error('sales-export error', err);
    if (client) client.release();
    return res.status(500).json({ error: 'Failed to stream sales' });
  }
});

export default router;
