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
    const publish = String(fields.publish || 'false').toLowerCase() === 'true';

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
      [title, description, price, coverUrl, releaseDate, genre, userId, publish ? 'published' : 'draft', publish ? new Date() : null]
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
        previewUrl = await uploadToStorage(process.env.SUPABASE_BUCKET_MEDIA || 'media', pathPrev, f.buffer, f.mimetype || 'audio/mpeg');
      }
      const ins = await query(
        `INSERT INTO songs (user_id, album_id, title, price, duration, cover_image, audio_url, preview_url, track_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [userId, album.id, stitle, sprice, sduration, coverUrl, audioUrl, previewUrl, trackNo]
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
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Storage not configured' });
    const userId = req.user.id;
    const { title, description = null, price, category = null, release_date = null, publish } = req.body;
    if (!title || !price) return res.status(400).json({ error: 'title and price are required' });
    const publishNow = String(publish || 'false').toLowerCase() === 'true';

    const videoFile = req.files?.video?.[0];
    if (!videoFile) return res.status(400).json({ error: 'video file is required' });
    const thumbFile = req.files?.thumbnail?.[0];

    const vext = (videoFile.originalname.split('.').pop() || 'mp4').toLowerCase();
    const vpath = `videos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${vext}`;
    const videoUrl = await uploadToStorage(process.env.SUPABASE_BUCKET_MEDIA || 'media', vpath, videoFile.buffer, videoFile.mimetype || 'video/mp4');

    let thumbUrl = null;
    if (thumbFile) {
      const text = (thumbFile.originalname.split('.').pop() || 'jpg').toLowerCase();
      const tpath = `videos/${userId}/thumbnails/${Date.now()}-${Math.random().toString(36).slice(2)}.${text}`;
      thumbUrl = await uploadToStorage(process.env.SUPABASE_BUCKET_VIDEOS || 'videos', tpath, thumbFile.buffer, thumbFile.mimetype || 'image/jpeg');
    }

    const ins = await query(
      `INSERT INTO videos (title, description, price, thumbnail, video_url, category, release_date, user_id, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, description, parseFloat(price), thumbUrl, videoUrl, category, release_date || null, userId, publishNow ? 'published' : 'draft', publishNow ? new Date() : null]
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
    // purchases joined with albums/videos by item_id
    const result = await query(
      `SELECT p.id, p.item_type, p.item_title as item, p.amount, p.created_at as date
       FROM purchases p
       WHERE p.payment_status = 'completed'
         AND (
           (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
           (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
           (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
         )
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to load recent sales' }); }
});

export default router;
