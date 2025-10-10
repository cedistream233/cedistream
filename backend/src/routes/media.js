import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticateToken } from '../lib/auth.js';
import { query } from '../lib/database.js';

const router = express.Router();

// Helper to parse Supabase storage public URL into { bucket, objectPath }
function parseStorageUrl(publicUrl) {
  try {
    const url = new URL(publicUrl);
    // typical paths: /storage/v1/object/public/<bucket>/<path>
    // or sometimes /object/public/<bucket>/<path>
    const parts = url.pathname.split('/').filter(Boolean);
    const objIdx = parts.findIndex(p => p === 'object');
    // expect ['storage','v1','object','public', '<bucket>', ...]
    if (objIdx >= 0) {
      const maybeBucket = parts[objIdx + 2];
      const objectPath = parts.slice(objIdx + 3).join('/');
      if (maybeBucket && objectPath) return { bucket: maybeBucket, objectPath };
    }
    // fallback: find any known bucket segment and use the remainder
    const knownBuckets = [
      process.env.SUPABASE_BUCKET_MEDIA || 'media',
      process.env.SUPABASE_BUCKET_VIDEOS || 'videos',
      process.env.SUPABASE_BUCKET_ALBUMS || 'albums',
      process.env.SUPABASE_BUCKET_PREVIEWS || process.env.SUPABASE_BUCKET_MEDIA || 'media'
    ];
    for (const b of knownBuckets) {
      const i = parts.findIndex(p => p === b);
      if (i >= 0) return { bucket: b, objectPath: parts.slice(i + 1).join('/') };
    }
  } catch {}
  return { bucket: null, objectPath: null };
}

// Get signed URL for full song audio if user owns it or is the creator
router.get('/song/:id', authenticateToken, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Storage not configured' });
    const userId = req.user.id;
    const { id } = req.params;

    const songRes = await query('SELECT id, user_id, audio_url FROM songs WHERE id = $1', [id]);
    if (!songRes.rows.length) return res.status(404).json({ error: 'Song not found' });
    const song = songRes.rows[0];

    // Owner shortcut
    let canAccess = song.user_id === userId;

    if (!canAccess) {
      // Check purchases for song or parent album
      const pRes = await query(
        `SELECT 1 FROM purchases WHERE user_id = $1 AND payment_status = 'completed' AND (
           (item_type = 'song' AND item_id = $2) OR
           (item_type = 'album' AND item_id IN (SELECT album_id FROM songs WHERE id = $2))
         ) LIMIT 1`,
        [userId, id]
      );
      canAccess = pRes.rows.length > 0;
    }

    if (!canAccess) return res.status(403).json({ error: 'Not purchased' });

  const { bucket, objectPath } = parseStorageUrl(song.audio_url || '');
  if (!bucket || !objectPath) return res.status(500).json({ error: 'Invalid storage path' });
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 5);
    if (error) return res.status(500).json({ error: 'Failed to sign URL' });
    return res.json({ url: data?.signedUrl });
  } catch (e) {
    console.error('media song error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get public preview URL for a song if available (no auth required)
router.get('/song/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const songRes = await query('SELECT preview_url FROM songs WHERE id = $1', [id]);
    if (!songRes.rows.length) return res.status(404).json({ error: 'Song not found' });
    const preview = songRes.rows[0]?.preview_url;
    if (!preview) return res.status(404).json({ error: 'No preview available' });
    const { bucket, objectPath } = parseStorageUrl(preview);
    if (bucket && objectPath) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 5);
      if (!error && data?.signedUrl) return res.json({ url: data.signedUrl });
    }
    // fallback: return original URL (works if public bucket)
    return res.json({ url: preview });
  } catch (e) {
    console.error('media preview error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get signed preview URL for a video (no auth required for preview)
router.get('/video/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const vRes = await query('SELECT preview_url FROM videos WHERE id = $1', [id]);
    if (!vRes.rows.length) return res.status(404).json({ error: 'Video not found' });
    const preview = vRes.rows[0]?.preview_url;
    if (!preview) return res.status(404).json({ error: 'No preview available' });
    const { bucket, objectPath } = parseStorageUrl(preview);
    if (bucket && objectPath) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 5);
      if (!error && data?.signedUrl) return res.json({ url: data.signedUrl });
    }
    return res.json({ url: preview });
  } catch (e) {
    console.error('video preview error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get signed URL for paid video playback
router.get('/video/:id', authenticateToken, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Storage not configured' });
    const userId = req.user.id;
    const { id } = req.params;

    const vRes = await query('SELECT id, user_id, video_url FROM videos WHERE id = $1', [id]);
    if (!vRes.rows.length) return res.status(404).json({ error: 'Video not found' });
    const video = vRes.rows[0];

    let canAccess = video.user_id === userId;
    if (!canAccess) {
      const pRes = await query(
        `SELECT 1 FROM purchases WHERE user_id = $1 AND payment_status = 'completed' AND item_type = 'video' AND item_id = $2 LIMIT 1`,
        [userId, id]
      );
      canAccess = pRes.rows.length > 0;
    }
    if (!canAccess) return res.status(403).json({ error: 'Not purchased' });

  const { bucket, objectPath } = parseStorageUrl(video.video_url || '');
  if (!bucket || !objectPath) return res.status(500).json({ error: 'Invalid storage path' });
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 5);
    if (error) return res.status(500).json({ error: 'Failed to sign URL' });
    return res.json({ url: data?.signedUrl });
  } catch (e) {
    console.error('media video error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
