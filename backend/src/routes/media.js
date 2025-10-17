import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticateToken } from '../lib/auth.js';
import { query } from '../lib/database.js';

const router = express.Router();

// Cache for schema feature detection
let HAS_PURCHASES_USER_EMAIL = null;
async function ensurePurchasesEmailColumn() {
  if (HAS_PURCHASES_USER_EMAIL !== null) return HAS_PURCHASES_USER_EMAIL;
  try {
    const r = await query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'user_email' LIMIT 1`
    );
    HAS_PURCHASES_USER_EMAIL = r.rows && r.rows.length > 0;
  } catch {
    HAS_PURCHASES_USER_EMAIL = false;
  }
  return HAS_PURCHASES_USER_EMAIL;
}

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

    // Load user's email to support legacy purchases recorded by email
    let userEmail = null;
    try {
      const ur = await query('SELECT email FROM users WHERE id = $1', [userId]);
      userEmail = ur.rows?.[0]?.email || null;
    } catch {}

    if (!canAccess) {
      // Check purchases for song or parent album (by user_id and optionally legacy user_email)
      const hasEmail = await ensurePurchasesEmailColumn();
      const params = [userId, id];
      let sql = `SELECT 1 FROM purchases
                 WHERE (user_id = $1`;
      if (hasEmail && userEmail) {
        params.push(userEmail);
        sql += ` OR user_email = $3`;
      }
      sql += `)
               AND (payment_status = 'completed' OR payment_status = 'success')
               AND (
                 (item_type = 'song' AND item_id = $2) OR
                 (item_type = 'album' AND item_id IN (SELECT album_id FROM songs WHERE id = $2))
               )
               LIMIT 1`;
      const pRes = await query(sql, params);
      canAccess = pRes.rows.length > 0;
    }

    if (!canAccess) return res.status(403).json({ error: 'Not purchased' });

  const { bucket, objectPath } = parseStorageUrl(song.audio_url || '');
  if (!bucket || !objectPath) return res.status(500).json({ error: 'Invalid storage path' });
  // Extend TTL to 60min for long playback sessions (albums, playlists)
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
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
    const songRes = await query('SELECT id, user_id, preview_url, audio_url FROM songs WHERE id = $1', [id]);
    if (!songRes.rows.length) return res.status(404).json({ error: 'Song not found' });
    const song = songRes.rows[0];

    // If user provided an Authorization token and is the owner, return full media URL
    const auth = req.headers['authorization'];
    if (auth && auth.split(' ')[1]) {
      try {
        // authenticate token without failing the request if invalid
        const tok = auth.split(' ')[1];
        const decoded = await (async () => {
          try { return (await import('../lib/auth.js')).verifyToken(tok); } catch { return null; }
        })();
        const userId = decoded?.id;
        if (userId && String(userId) === String(song.user_id)) {
          // owner gets signed full audio URL if present
          const fullUrl = song.audio_url;
          if (fullUrl) {
            const { bucket, objectPath } = parseStorageUrl(fullUrl);
            if (bucket && objectPath) {
              const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
              if (!error && data?.signedUrl) return res.json({ url: data.signedUrl });
            }
            return res.json({ url: fullUrl });
          }
        }
      } catch (e) { /* ignore auth errors and fall back to preview */ }
    }

    const preview = song.preview_url;
    if (!preview) return res.status(404).json({ error: 'No preview available' });
    const { bucket, objectPath } = parseStorageUrl(preview);
    if (bucket && objectPath) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
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
    const vRes = await query('SELECT id, user_id, preview_url, video_url FROM videos WHERE id = $1', [id]);
    if (!vRes.rows.length) return res.status(404).json({ error: 'Video not found' });
    const video = vRes.rows[0];

    // If user provided Authorization and is owner, return full signed URL
    const auth = req.headers['authorization'];
    if (auth && auth.split(' ')[1]) {
      try {
        const tok = auth.split(' ')[1];
        const decoded = await (async () => {
          try { return (await import('../lib/auth.js')).verifyToken(tok); } catch { return null; }
        })();
        const userId = decoded?.id;
        if (userId && String(userId) === String(video.user_id)) {
          const fullUrl = video.video_url;
          if (fullUrl) {
            const { bucket, objectPath } = parseStorageUrl(fullUrl);
            if (bucket && objectPath) {
              const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
              if (!error && data?.signedUrl) return res.json({ url: data.signedUrl });
            }
            return res.json({ url: fullUrl });
          }
        }
      } catch (e) { /* ignore auth errors and fall back to preview */ }
    }

    const preview = video.preview_url;
    if (!preview) return res.status(404).json({ error: 'No preview available' });
    const { bucket, objectPath } = parseStorageUrl(preview);
    if (bucket && objectPath) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
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

    // Load user's email for legacy purchases
    let userEmail = null;
    try {
      const ur = await query('SELECT email FROM users WHERE id = $1', [userId]);
      userEmail = ur.rows?.[0]?.email || null;
    } catch {}

    if (!canAccess) {
      const hasEmail = await ensurePurchasesEmailColumn();
      const params = [userId, id];
      let sql = `SELECT 1 FROM purchases
                 WHERE (user_id = $1`;
      if (hasEmail && userEmail) {
        params.push(userEmail);
        sql += ` OR user_email = $3`;
      }
      sql += `)
               AND (payment_status = 'completed' OR payment_status = 'success')
               AND item_type = 'video' AND item_id = $2
               LIMIT 1`;
      const pRes = await query(sql, params);
      canAccess = pRes.rows.length > 0;
    }
    if (!canAccess) return res.status(403).json({ error: 'Not purchased' });

  const { bucket, objectPath } = parseStorageUrl(video.video_url || '');
  if (!bucket || !objectPath) return res.status(500).json({ error: 'Invalid storage path' });
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
    if (error) return res.status(500).json({ error: 'Failed to sign URL' });
    return res.json({ url: data?.signedUrl });
  } catch (e) {
    console.error('media video error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
// Optional: ownership checker (not wired in server.js by default)
export const checkOwnership = async (req, res) => {
  try {
    const userId = req.user.id;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.json([]);
    const ur = await query('SELECT email FROM users WHERE id = $1', [userId]);
    const userEmail = ur.rows?.[0]?.email || null;
    const out = [];
    for (const it of items) {
      const { item_type, item_id } = it || {};
      if (!item_type || !item_id) { out.push({ ...it, owned: false }); continue; }
      let q = '';
      const params = [userId, item_id, userEmail];
      if (item_type === 'song') {
        q = `SELECT 1 FROM purchases WHERE (user_id=$1 OR ($3 IS NOT NULL AND user_email=$3)) AND (payment_status='completed' OR payment_status='success') AND ((item_type='song' AND item_id=$2) OR (item_type='album' AND item_id IN (SELECT album_id FROM songs WHERE id=$2))) LIMIT 1`;
      } else if (item_type === 'album') {
        q = `SELECT 1 FROM purchases WHERE (user_id=$1 OR ($3 IS NOT NULL AND user_email=$3)) AND (payment_status='completed' OR payment_status='success') AND item_type='album' AND item_id=$2 LIMIT 1`;
      } else if (item_type === 'video') {
        q = `SELECT 1 FROM purchases WHERE (user_id=$1 OR ($3 IS NOT NULL AND user_email=$3)) AND (payment_status='completed' OR payment_status='success') AND item_type='video' AND item_id=$2 LIMIT 1`;
      }
      if (!q) { out.push({ ...it, owned: false }); continue; }
      const r = await query(q, params);
      out.push({ ...it, owned: r.rows.length > 0 });
    }
    return res.json(out);
  } catch (e) {
    console.error('ownership check error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
