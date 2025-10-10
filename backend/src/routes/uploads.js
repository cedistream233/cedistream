import express from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { query } from '../lib/database.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to upload a file buffer to supabase and return public URL
async function uploadToStorage(bucket, path, buffer, contentType) {
  if (!supabase) throw new Error('Storage not configured');
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    cacheControl: '3600', upsert: true, contentType
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
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

// Recent sales for creator: aggregates last 10 completed purchases on creator's items
router.get('/recent-sales', authenticateToken, requireRole(['creator']), async (req, res) => {
  try {
    const userId = req.user.id;
    // purchases joined with albums/videos by item_id; includes songs if table exists
    const sql = `SELECT p.id, p.item_type, p.item_title as item, p.amount, p.created_at as date
                 FROM purchases p
                 WHERE p.payment_status = 'completed'
                   AND (
                     (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
                     (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
                     (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
                   )
                 ORDER BY p.created_at DESC
                 LIMIT 10`;
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

export default router;
// Toggle album publish status
router.patch('/albums/:id/status', authenticateToken, requireRole(['creator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['draft','published'].includes(String(status))) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    // ensure ownership
    const own = await query('SELECT user_id FROM albums WHERE id = $1', [id]);
    if (!own.rows.length) return res.status(404).json({ error: 'Album not found' });
    if (own.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const publishedAt = status === 'published' ? new Date() : null;
    const upd = await query(
      `UPDATE albums SET status = $2, published_at = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status, publishedAt]
    );
    return res.json(upd.rows[0]);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Internal Server Error' }); }
});

// Toggle video publish status
router.patch('/videos/:id/status', authenticateToken, requireRole(['creator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['draft','published'].includes(String(status))) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const own = await query('SELECT user_id FROM videos WHERE id = $1', [id]);
    if (!own.rows.length) return res.status(404).json({ error: 'Video not found' });
    if (own.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const publishedAt = status === 'published' ? new Date() : null;
    const upd = await query(
      `UPDATE videos SET status = $2, published_at = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status, publishedAt]
    );
    return res.json(upd.rows[0]);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Internal Server Error' }); }
});

// Toggle song publish status
router.patch('/songs/:id/status', authenticateToken, requireRole(['creator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['draft','published'].includes(String(status))) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    // ensure ownership
    const own = await query('SELECT user_id FROM songs WHERE id = $1', [id]);
    if (!own.rows.length) return res.status(404).json({ error: 'Song not found' });
    if (own.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const publishedAt = status === 'published' ? new Date() : null;
    const upd = await query(
      `UPDATE songs SET status = $2, published_at = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status, publishedAt]
    );
    return res.json(upd.rows[0]);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Internal Server Error' }); }
});
