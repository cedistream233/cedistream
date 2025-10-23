import express from 'express';
import crypto from 'crypto';
import { createBackblazeClient } from '../lib/backblaze.js';
import { authenticateToken } from '../lib/auth.js';
import { query } from '../lib/database.js';

const router = express.Router();

// Toggle verbose media logging with env var MEDIA_DEBUG=true
const MEDIA_DEBUG = String(process.env.MEDIA_DEBUG || 'false').toLowerCase() === 'true';
function mediaDebug(...args) { if (MEDIA_DEBUG) console.debug(...args); }

// Simple in-memory caches to reduce DB load during streaming (multiple Range requests per playback)
// Note: This resets on server restart. TTLs are intentionally short.
const accessCache = new Map(); // key: `${userId}|${objectPath}` => { allowed: boolean, exp: number }
const emailCache = new Map(); // key: userId => { email: string|null, exp: number }
const ACCESS_TTL_MS = 5 * 60 * 1000; // 5 minutes
const EMAIL_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheGet(map, key) {
  const v = map.get(key);
  if (!v) return null;
  if (Date.now() > v.exp) { map.delete(key); return null; }
  return v.value !== undefined ? v.value : (v.email ?? v);
}
function cacheSet(map, key, obj, ttl) {
  map.set(key, { ...obj, exp: Date.now() + ttl });
}

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

// Helpers to map logical bucket names to env vars and determine private buckets
function getBucketNameFor(key) {
  // key: 'MEDIA', 'VIDEOS', 'ALBUMS', 'PREVIEWS', 'THUMBNAILS', 'PROFILES', 'PROMOTIONS'
  return (
    process.env[`BACKBLAZE_BUCKET_${key}`] ||
    process.env[`SUPABASE_BUCKET_${key}`] ||
    process.env[`SUPABASE_BUCKET_${key.toLowerCase()}`] ||
    process.env[`SUPABASE_BUCKET_${key.toLowerCase()}`.toUpperCase()] ||
    null
  );
}

function isPrivateBucket(bucket) {
  // Consider both per-feature env vars and any configured physical Backblaze bucket name.
  // This supports setups where logical buckets (e.g. 'media') are namespaced inside
  // a single physical B2 bucket (BACKBLAZE_BUCKET_NAME) or where features map to
  // separate physical buckets via BACKBLAZE_BUCKET_MEDIA, BACKBLAZE_BUCKET_VIDEOS, etc.
  const candidates = new Set();
  // per-feature Backblaze names
  if (process.env.BACKBLAZE_BUCKET_MEDIA) candidates.add(process.env.BACKBLAZE_BUCKET_MEDIA);
  if (process.env.BACKBLAZE_BUCKET_VIDEOS) candidates.add(process.env.BACKBLAZE_BUCKET_VIDEOS);
  // per-feature Supabase names (legacy)
  if (process.env.SUPABASE_BUCKET_MEDIA) candidates.add(process.env.SUPABASE_BUCKET_MEDIA);
  if (process.env.SUPABASE_BUCKET_VIDEOS) candidates.add(process.env.SUPABASE_BUCKET_VIDEOS);
  // global physical Backblaze bucket name (single-bucket deployments)
  if (process.env.BACKBLAZE_BUCKET_NAME) candidates.add(process.env.BACKBLAZE_BUCKET_NAME);
  if (process.env.B2_BUCKET_NAME) candidates.add(process.env.B2_BUCKET_NAME);
  // Also consider common logical default names
  candidates.add('media');
  candidates.add('videos');
  return candidates.has(bucket);
}

function getAppBaseUrl(req) {
  // Prefer explicit APP_URL, otherwise infer from request
  const envUrl = (process.env.APP_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function shouldProxySignedUrl(signedUrl) {
  // Short-lived safety: allow env override. By default we proxy signed URLs to avoid
  // CORS problems historically forced proxying, but modern Backblaze/CDN setups
  // typically support CORS. Default to NOT proxying so media can be served
  // directly from storage/CDN (better for streaming and range requests).
  const alwaysProxy = String(process.env.BACKBLAZE_ALWAYS_PROXY || 'false').toLowerCase() === 'true';
  if (alwaysProxy) return true;
  if (!signedUrl) return false;
  // Default Backblaze download host commonly doesn't include CORS allowing custom origins.
  if (signedUrl.includes('backblazeb2.com') || signedUrl.includes('f003.backblazeb2.com')) {
    // If a custom BACKBLAZE_PUBLIC_BASE is configured, allow using it directly
    if (process.env.BACKBLAZE_PUBLIC_BASE && process.env.BACKBLAZE_PUBLIC_BASE.startsWith('http')) return false;
    return true;
  }
  return false;
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

    // Backblaze public/download URLs often use /file/<bucket>/<path>
    const fileIdx = parts.findIndex(p => p === 'file');
    if (fileIdx >= 0) {
      const maybeBucket = parts[fileIdx + 1];
      const objectPath = parts.slice(fileIdx + 2).join('/');
      if (maybeBucket && objectPath) return { bucket: maybeBucket, objectPath };
    }
    // fallback: find any known bucket segment (logical or physical) and use the remainder
    const knownBuckets = [
      process.env.BACKBLAZE_BUCKET_NAME,
      process.env.B2_BUCKET_NAME,
      process.env.BACKBLAZE_BUCKET_MEDIA,
      process.env.BACKBLAZE_BUCKET_VIDEOS,
      process.env.SUPABASE_BUCKET_MEDIA,
      process.env.SUPABASE_BUCKET_VIDEOS,
      process.env.SUPABASE_BUCKET_ALBUMS,
      process.env.SUPABASE_BUCKET_PREVIEWS,
      'media',
      'videos',
      'albums',
      'previews'
    ].filter(Boolean);
    for (const b of knownBuckets) {
      const i = parts.findIndex(p => p === b);
      if (i >= 0) return { bucket: b, objectPath: parts.slice(i + 1).join('/') };
    }

    // as a last resort, assume the first path segment is the bucket name
    if (parts.length >= 2) return { bucket: parts[0], objectPath: parts.slice(1).join('/') };
  } catch {}
  return { bucket: null, objectPath: null };
}

// Get signed URL for full song audio if user owns it or is the creator
router.get('/song/:id', authenticateToken, async (req, res) => {
  try {
    // ensure Backblaze client is available
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

  // For private Backblaze buckets, return a streaming proxy URL handled by our server.
  // For public files, return the public B2 URL.
  try {
    const b2 = createBackblazeClient();
    // For private buckets, prefer returning a temporary signed URL so the frontend can play directly.
    if (isPrivateBucket(bucket)) {
      try {
        const signed = await b2.from(bucket).createSignedUrl(objectPath, 60 * 60);
        const signedUrl = (signed?.data?.signedUrl) || (signed?.data?.publicUrl) || signed?.signedUrl || signed?.publicUrl || null;
        if (signedUrl) {
          if (shouldProxySignedUrl(signedUrl)) {
            const base = getAppBaseUrl(req);
            const encodedPath = encodeURIComponent(objectPath);
            const { st, sig } = signStreamToken(req.user.id, objectPath, 60 * 60);
            const streamUrl = `${base}/api/media/stream/${bucket}/${encodedPath}?st=${encodeURIComponent(st)}&sig=${encodeURIComponent(sig)}`;
            mediaDebug('[media] returning proxy stream URL for song', { id: song.id, bucket, path: objectPath });
            return res.json({ url: streamUrl });
          }
          mediaDebug('[media] returning direct signed URL for song', { id: song.id, bucket, masked: signedUrl && signedUrl.split('?')[0] });
          return res.json({ url: signedUrl });
        }
      } catch (err) {
        // If signed URL generation fails, fall back to stream proxy
        console.warn('Failed to create signed URL, falling back to stream proxy', err?.message || err);
      }
      const base = getAppBaseUrl(req);
      const encodedPath = encodeURIComponent(objectPath);
      const streamUrl = `${base}/api/media/stream/${bucket}/${encodedPath}`;
      
      return res.json({ url: streamUrl });
    }
    const { data: pub } = await b2.from(bucket).getPublicUrl(objectPath);
    return res.json({ url: pub.publicUrl });
  } catch (e) {
    console.error('Backblaze playback url error', e);
    return res.status(500).json({ error: 'Failed to create playback URL' });
  }
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
              try {
                const b2 = createBackblazeClient();
                if (isPrivateBucket(bucket)) {
                  try {
                    const signed = await b2.from(bucket).createSignedUrl(objectPath, 60 * 60);
                    const signedUrl = signed?.data?.signedUrl || signed?.data?.publicUrl || null;
                    if (signedUrl) {
                      if (shouldProxySignedUrl(signedUrl)) {
                        const base = getAppBaseUrl(req);
                        const encodedPath = encodeURIComponent(objectPath);
                        const { st, sig } = signStreamToken(userId, objectPath, 60 * 60);
                        const streamUrl = `${base}/api/media/stream/${bucket}/${encodedPath}?st=${encodeURIComponent(st)}&sig=${encodeURIComponent(sig)}`;
                        mediaDebug('[media] returning proxy stream URL for owner audio', { id: song.id, bucket, path: objectPath });
                        return res.json({ url: streamUrl });
                      }
                      mediaDebug('[media] returning direct signed URL for owner audio', { id: song.id, bucket, masked: signedUrl && signedUrl.split('?')[0] });
                      return res.json({ url: signedUrl });
                    }
                  } catch (err) {
                    console.warn('Signed URL generation failed, using stream proxy', err?.message || err);
                  }
                  const base = getAppBaseUrl(req);
                  const encodedPath = encodeURIComponent(objectPath);
                  const streamUrl = `${base}/api/media/stream/${bucket}/${encodedPath}`;
                  return res.json({ url: streamUrl });
                }
                const { data: pub } = await b2.from(bucket).getPublicUrl(objectPath);
                if (pub?.publicUrl) return res.json({ url: pub.publicUrl });
              } catch (e) {/* fall through to return original URL */}
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
      try {
        const b2 = createBackblazeClient();
        if (isPrivateBucket(bucket)) {
          const base = getAppBaseUrl(req);
          const encodedPath = encodeURIComponent(objectPath);
          const streamUrl = `${base}/api/media/stream/${bucket}/${encodedPath}`;
          return res.json({ url: streamUrl });
        }
        const { data: pub } = await b2.from(bucket).getPublicUrl(objectPath);
        if (pub?.publicUrl) return res.json({ url: pub.publicUrl });
      } catch (e) { /* fall back */ }
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
                const useBackblaze = process.env.BACKBLAZE_ACCOUNT_ID && process.env.BACKBLAZE_APPLICATION_KEY && (process.env.BACKBLAZE_BUCKET_NAME || process.env.B2_BUCKET_NAME);
                // With Backblaze, we use the stream proxy for private buckets
                const base = getAppBaseUrl(req);
                const encodedPath = encodeURIComponent(objectPath);
                const streamUrl = `${base}/api/media/stream/${bucket}/${encodedPath}`;
                return res.json({ url: streamUrl });
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
      try {
        const b2 = createBackblazeClient();
        if (isPrivateBucket(bucket)) {
          try {
            const signed = await b2.from(bucket).createSignedUrl(objectPath, 60 * 60);
            const signedUrl = signed?.data?.signedUrl || signed?.data?.publicUrl || null;
            if (signedUrl) {
              if (shouldProxySignedUrl(signedUrl)) {
                const base = getAppBaseUrl(req);
                const encodedPath = encodeURIComponent(objectPath);
                const { st, sig } = signStreamToken(req.user?.id || '0', objectPath, 60 * 60);
                const streamUrl = `${base}/api/media/stream/${bucket}/${encodedPath}?st=${encodeURIComponent(st)}&sig=${encodeURIComponent(sig)}`;
                mediaDebug('[media] returning proxy stream URL for video preview', { id: video.id, bucket, path: objectPath });
                return res.json({ url: streamUrl });
              }
              mediaDebug('[media] returning direct signed URL for video preview', { id: video.id, bucket, masked: signedUrl && signedUrl.split('?')[0] });
              return res.json({ url: signedUrl });
            }
          } catch (err) {
            console.warn('Signed URL generation failed, using stream proxy', err?.message || err);
          }
          const base = getAppBaseUrl(req);
          const encodedPath = encodeURIComponent(objectPath);
          const streamUrl = `${base}/api/media/stream/${bucket}/${encodedPath}`;
          return res.json({ url: streamUrl });
        }
        const { data: pub } = await b2.from(bucket).getPublicUrl(objectPath);
        if (pub?.publicUrl) return res.json({ url: pub.publicUrl });
      } catch (e) { /* fall back */ }
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
    // Ensure Backblaze is configured and available. We no longer depend on Supabase for storage.
    let b2;
    try { b2 = createBackblazeClient(); } catch (err) {
      console.error('Backblaze not configured for video playback', err?.message || err);
      return res.status(500).json({ error: 'Storage not configured' });
    }
    const userId = req.user.id;
    const { id } = req.params;

  const vRes = await query('SELECT id, user_id, video_url, video_url_sd FROM videos WHERE id = $1', [id]);
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

  // Build response that can include both SD and HQ variants when available
  const hqUrlRaw = video.video_url || null;
  const sdUrlRaw = video.video_url_sd || null;
  const out = { hq: null, sd: null };
  try {
    // Helper to produce both a direct signed URL (if available) and a proxy URL fallback
    async function makePlayable(rawUrl) {
      if (!rawUrl) return { url: null, signed: null };
      const { bucket, objectPath } = parseStorageUrl(rawUrl || '');
      if (!bucket || !objectPath) return { url: null, signed: null };
      try {
        if (isPrivateBucket(bucket)) {
          let signedUrl = null;
          try {
            const signed = await b2.from(bucket).createSignedUrl(objectPath, 60 * 60);
            signedUrl = (signed?.data?.signedUrl) || (signed?.data?.publicUrl) || signed?.signedUrl || signed?.publicUrl || null;
          } catch (err) {
            console.warn('Failed to create signed URL, will fall back to proxy', err?.message || err);
            signedUrl = null;
          }
          const base = getAppBaseUrl(req);
          const encodedPath = encodeURIComponent(objectPath);
          const { st, sig } = signStreamToken(userId, objectPath, 60 * 60);
          const proxyUrl = `${base}/api/media/stream/${bucket}/${encodedPath}${signedUrl ? `?st=${encodeURIComponent(st)}&sig=${encodeURIComponent(sig)}` : ''}`;
          // Return both signed (if any) and proxy URL so frontend can prefer the direct signed URL when CORS allows it.
          return { url: proxyUrl, signed: signedUrl };
        }
        const { data: pub } = await b2.from(bucket).getPublicUrl(objectPath);
        return { url: pub?.publicUrl || null, signed: pub?.publicUrl || null };
      } catch (e) {
        console.warn('makePlayable error', e?.message || e);
        return { url: null, signed: null };
      }
    }

    const hqPlay = await makePlayable(hqUrlRaw);
    const sdPlay = await makePlayable(sdUrlRaw || hqUrlRaw);
    out.hq = hqPlay.url || null;
    out.sd = sdPlay.url || null;
    // include direct signed URLs when available so clients can try them first
    out.hq_signed = hqPlay.signed || null;
    out.sd_signed = sdPlay.signed || null;
    return res.json(out);
  } catch (e) {
    console.error('Backblaze create signed url error', e);
    return res.status(500).json({ error: 'Failed to create playback URL' });
  }
  } catch (e) {
    console.error('media video error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Helper to verify ownership or purchase for streamed content
async function verifyStreamAccess(userId, userEmail, objectPath) {
  // Parse objectPath to determine content type and ID
  // Format expectations:
  // - albums/<userId>/<albumId>/songs/<filename> -> album or song
  // - songs/<userId>/<filename> -> song
  // - videos/<userId>/<filename> -> video
  // - songs/<userId>/previews/<filename> -> preview (public)
  // - videos/<userId>/<filename>-preview.<ext> -> preview (public)
  // - profiles/<userId>/<filename> -> profile (owner only)
  
  const parts = objectPath.split('/');
  
  // Profile images - only owner can access
  if (parts[0] === 'profiles') {
    const ownerId = parts[1];
    return String(userId) === String(ownerId);
  }
  
  // Previews are public - allow access
  if (objectPath.includes('/previews/') || objectPath.includes('-preview.')) {
    return true;
  }
  
  // For albums/songs/videos - need to check ownership or purchase
  if (parts[0] === 'albums') {
    const creatorId = parts[1];
    const albumId = parts[2];
    // Owner check
    if (String(userId) === String(creatorId)) return true;
    // Purchase check - need to find the song or album
    const hasEmail = await ensurePurchasesEmailColumn();
    const params = [userId];
    let sql = `SELECT 1 FROM purchases WHERE (user_id = $1`;
    if (hasEmail && userEmail) {
      params.push(userEmail);
      sql += ` OR user_email = $2`;
    }
    sql += `) AND (payment_status = 'completed' OR payment_status = 'success')`;
    // Check if purchased album or any song in the path
    if (albumId) {
      params.push(albumId);
      sql += ` AND (item_type = 'album' AND item_id = $${params.length})`;
    }
    sql += ` LIMIT 1`;
    const pRes = await query(sql, params);
    return pRes.rows.length > 0;
  }
  
  if (parts[0] === 'songs') {
    const creatorId = parts[1];
    // Owner check
    if (String(userId) === String(creatorId)) return true;
    // Need to look up song by audio_url pattern to find song ID
    const urlPattern = `%${objectPath}%`;
    const songRes = await query('SELECT id, user_id FROM songs WHERE audio_url LIKE $1 LIMIT 1', [urlPattern]);
    if (!songRes.rows.length) return false;
    const song = songRes.rows[0];
    if (String(userId) === String(song.user_id)) return true;
    // Check purchase
    const hasEmail = await ensurePurchasesEmailColumn();
    const params = [userId, song.id];
    let sql = `SELECT 1 FROM purchases WHERE (user_id = $1`;
    if (hasEmail && userEmail) {
      params.push(userEmail);
      sql += ` OR user_email = $3`;
    }
    sql += `) AND (payment_status = 'completed' OR payment_status = 'success')
           AND ((item_type = 'song' AND item_id = $2) OR (item_type = 'album' AND item_id IN (SELECT album_id FROM songs WHERE id = $2)))
           LIMIT 1`;
    const pRes = await query(sql, params);
    return pRes.rows.length > 0;
  }
  
  if (parts[0] === 'videos') {
    const creatorId = parts[1];
    // Owner check
    if (String(userId) === String(creatorId)) return true;
    // Look up video
    const urlPattern = `%${objectPath}%`;
    const videoRes = await query('SELECT id, user_id FROM videos WHERE video_url LIKE $1 LIMIT 1', [urlPattern]);
    if (!videoRes.rows.length) return false;
    const video = videoRes.rows[0];
    if (String(userId) === String(video.user_id)) return true;
    // Check purchase
    const hasEmail = await ensurePurchasesEmailColumn();
    const params = [userId, video.id];
    let sql = `SELECT 1 FROM purchases WHERE (user_id = $1`;
    if (hasEmail && userEmail) {
      params.push(userEmail);
      sql += ` OR user_email = $3`;
    }
    sql += `) AND (payment_status = 'completed' OR payment_status = 'success')
           AND item_type = 'video' AND item_id = $2 LIMIT 1`;
    const pRes = await query(sql, params);
    return pRes.rows.length > 0;
  }
  
  // Default: deny access
  return false;
}

export default router;

// Stream endpoint used for Backblaze private buckets. Path components are: /api/media/stream/:bucket/:encodedPath
// Requires authentication unless content is public (previews)
// Utilities for stream token signing (fallback when Authorization header can't be sent by browser video element)
function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signStreamToken(userId, objectPath, ttlSec = 3600) {
  const secret = process.env.JWT_SECRET || 'change-me-secret';
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Number(ttlSec || 3600));
  const payload = `${userId}|${objectPath}|${exp}`;
  const st = base64url(payload);
  const sig = crypto.createHmac('sha256', secret).update(st).digest('hex');
  return { st, sig };
}
function verifyStreamToken(st, sig) {
  try {
    const secret = process.env.JWT_SECRET || 'change-me-secret';
    const expected = crypto.createHmac('sha256', secret).update(st).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig || '')))) return null;
    const raw = Buffer.from(String(st).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const [userId, objectPath, expStr] = raw.split('|');
    const exp = Number(expStr || '0');
    if (!userId || !objectPath || !exp) return null;
    if (Math.floor(Date.now() / 1000) > exp) return null;
    return { userId, objectPath };
  } catch {
    return null;
  }
}

router.options('/stream/:bucket/:encodedPath', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Authorization, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  return res.sendStatus(204);
});

router.head('/stream/:bucket/:encodedPath', async (req, res) => {
  try {
    const { bucket, encodedPath } = req.params;
    const objectPath = decodeURIComponent(encodedPath);
    const range = req.headers.range || 'bytes=0-1';
    const b2 = createBackblazeClient();
    const downloader = b2.from(bucket);
    const result = await downloader.downloadStream(objectPath, range);
    if (result.error) return res.status(404).end();

    const headers = result.headers || {};
    // Try to set a useful Content-Type. If B2 doesn't provide it, infer from extension.
    let contentType = headers['content-type'] || 'application/octet-stream';
    if (!headers['content-type']) {
      const ext = String(objectPath).split('.').pop()?.toLowerCase();
      if (ext === 'mp4') contentType = 'video/mp4';
      else if (ext === 'webm') contentType = 'video/webm';
      else if (ext === 'ogg' || ext === 'ogv') contentType = 'video/ogg';
    }
    res.setHeader('Content-Type', contentType);
    if (headers['content-length']) res.setHeader('Content-Length', headers['content-length']);
    if (headers['content-range']) res.setHeader('Content-Range', headers['content-range']);
  if (headers['accept-ranges']) res.setHeader('Accept-Ranges', headers['accept-ranges']);
  else res.setHeader('Accept-Ranges', 'bytes');
    // Make streaming responses permissive for CORS to allow browser video playback from any origin.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type, X-Content-Duration');
  mediaDebug('[media] HEAD stream', { bucket, path: objectPath, status: result.status || 206 });
    res.status(result.status || 206).end();
  } catch (e) {
    return res.status(500).end();
  }
});

router.get('/stream/:bucket/:encodedPath', async (req, res) => {
  try {
    const { bucket, encodedPath } = req.params;
    const objectPath = decodeURIComponent(encodedPath);
    
    // Check if this is preview content (public) or requires auth
    const isPreview = objectPath.includes('/previews/') || objectPath.includes('-preview.');
    
    if (!isPreview) {
      // Require authentication for non-preview content
      const auth = req.headers['authorization'];
      let userIdFromAuth = null;
      if (auth && auth.startsWith('Bearer ')) {
        try {
          const token = auth.split(' ')[1];
          const { verifyToken } = await import('../lib/auth.js');
          const decoded = verifyToken(token);
          userIdFromAuth = decoded?.id || null;
        } catch (authError) {
          // ignore here; we'll check for signed stream token next
        }
      }

      // If no Authorization header or invalid, try signed stream token query
      if (!userIdFromAuth) {
        const st = req.query.st;
        const sig = req.query.sig;
        const verified = (st && sig) ? verifyStreamToken(st, sig) : null;
        if (!verified) {
          console.warn('[media] stream token verification failed', { st: !!st, sig: !!sig, bucket, path: objectPath });
          return res.status(401).json({ error: 'Authentication required' });
        }
        if (verified.objectPath !== objectPath) {
          console.warn('[media] stream token path mismatch', { expected: objectPath, got: verified.objectPath });
          return res.status(403).json({ error: 'Token path mismatch' });
        }
        userIdFromAuth = verified.userId;
        mediaDebug('[media] stream token verified', { userId: userIdFromAuth, bucket, path: objectPath });
      }

      try {
        const userId = userIdFromAuth;
        if (!userId) {
          console.warn('[media] no userId after auth check', { bucket, path: objectPath });
          return res.status(401).json({ error: 'Invalid token' });
        }

        // Load user email for legacy purchase checks (cached)
        let userEmail = cacheGet(emailCache, String(userId)) || null;
        if (userEmail === null) {
          try {
            const ur = await query('SELECT email FROM users WHERE id = $1', [userId]);
            userEmail = ur.rows?.[0]?.email || null;
            cacheSet(emailCache, String(userId), { email: userEmail }, EMAIL_TTL_MS);
          } catch {
            userEmail = null;
          }
        }

        // Verify access (ownership or purchase) with short-lived cache per objectPath
        const cacheKey = `${userId}|${objectPath}`;
        let hasAccess = cacheGet(accessCache, cacheKey);
        if (hasAccess === null || hasAccess === undefined) {
          hasAccess = await verifyStreamAccess(userId, userEmail, objectPath);
          cacheSet(accessCache, cacheKey, { value: !!hasAccess }, ACCESS_TTL_MS);
        }
        if (!hasAccess) {
          console.warn('[media] access denied after ownership check', { userId, bucket, path: objectPath });
          return res.status(403).json({ error: 'Access denied' });
        }
      } catch (authError) {
        console.error('Stream auth error:', authError);
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    // Stream the content
    const range = req.headers.range || null;
    // Verbose diagnostics logging to help debug playback issues
    mediaDebug('[media] incoming stream request', {
      bucket,
      path: objectPath,
      origin: req.headers.origin || null,
      range,
      isPreview,
      ip: req.ip || req.headers['x-forwarded-for'] || null
    });
    const b2 = createBackblazeClient();
    const downloader = b2.from(bucket);
  const result = await downloader.downloadStream(objectPath, range);
    
    if (result.error) {
      console.error('[media] stream download error', { bucket, path: objectPath, error: result.error });
      return res.status(404).json({ error: 'Not found' });
    }
    
  // Set headers forwarded from B2 if present
    const headers = result.headers || {};
  mediaDebug('[media] stream response headers from storage', { bucket, path: objectPath, headers });
    
    // Determine the correct status code
    let statusCode = result.status || 200;
    
    // If client requested a Range but upstream didn't provide Content-Range, try to synthesize one
    if (range && !headers['content-range'] && headers['content-length']) {
      try {
        const total = Number(headers['content-length']);
        if (!Number.isNaN(total) && total > 0) {
          // parse range header bytes=START-END or bytes=START-
          const m = String(range).match(/bytes=(\d+)-(\d*)/);
          const start = m ? Number(m[1]) : 0;
          let end = (m && m[2]) ? Number(m[2]) : (total - 1);
          if (isNaN(end) || end >= total) end = total - 1;
          if (start > end || start >= total) {
            // unsatisfiable
            res.setHeader('Content-Range', `bytes */${total}`);
            res.status(416).end();
            return;
          }
          const chunkSize = (end - start) + 1;
          const cr = `bytes ${start}-${end}/${total}`;
          res.setHeader('Content-Range', cr);
          res.setHeader('Content-Length', String(chunkSize));
          statusCode = 206; // Force 206 for partial content
          mediaDebug('[media] synthesized Content-Range', { bucket, path: objectPath, ContentRange: cr, chunkSize });
        }
      } catch (e) {
        console.warn('[media] failed to synthesize Content-Range', e?.message || e);
      }
    }
    
    res.setHeader('Content-Type', headers['content-type'] || 'application/octet-stream');
    if (headers['content-length'] && !range) res.setHeader('Content-Length', headers['content-length']);
    if (headers['content-range']) {
      res.setHeader('Content-Range', headers['content-range']);
      statusCode = 206; // Backblaze sent proper range response
    }
  if (headers['accept-ranges']) res.setHeader('Accept-Ranges', headers['accept-ranges']);
  else res.setHeader('Accept-Ranges', 'bytes');
  // Explicitly advertise range support consistently so browsers can plan Range requests
  // even when upstream storage omits the header. This helps with seeking and reuse of
  // buffered ranges during replay.
  res.setHeader('Accept-Ranges', res.getHeader('Accept-Ranges') || 'bytes');
    
    // Aggressive caching and buffering settings for smooth playback
    res.setHeader('Cache-Control', isPreview ? 'public, max-age=86400, immutable' : 'public, max-age=3600, stale-while-revalidate=86400');
    res.setHeader('X-Content-Duration', headers['x-content-duration'] || '');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Enable browser caching with ETag if available
    if (headers['etag']) res.setHeader('ETag', headers['etag']);
    if (headers['last-modified']) res.setHeader('Last-Modified', headers['last-modified']);

    // Make streaming responses permissive for CORS to allow browser video playback from any origin.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type, X-Content-Duration');
    
  mediaDebug('[media] GET stream', { bucket, path: objectPath, status: statusCode });
    
    // Stream the body
    const body = result.data;
    res.status(statusCode);
    if (body && typeof body.pipe === 'function') {
      // log when piping starts and attach error handler
      try {
        body.on && body.on('error', (err) => {
          console.error('[media] stream body error', { bucket, path: objectPath, err: err && err.message });
          // If client already disconnected, don't attempt to write a 500
          try { if (!res.headersSent && !res.writableEnded) res.status(500).end(); } catch (e) {}
        });
      } catch (e) {}

      // Clean up if client disconnects: destroy upstream stream to free resources
      req.on('close', () => {
        mediaDebug('[media] client disconnected, destroying upstream stream', { bucket, path: objectPath });
        try { if (body && typeof body.destroy === 'function') body.destroy(); } catch (e) {}
      });

      mediaDebug('[media] piping stream to response', { bucket, path: objectPath });
      return body.pipe(res);
    }

    // Fallback: body as Buffer
    if (Buffer.isBuffer(body)) {
      mediaDebug('[media] sending buffer', { bucket, path: objectPath, size: body.length });
      // Ensure Content-Length is set for full responses
      try { if (!range && !res.getHeader('Content-Length')) res.setHeader('Content-Length', String(body.length)); } catch (e) {}
      return res.end(body);
    }

    console.error('[media] no valid body to stream', { bucket, path: objectPath });
    res.status(500).end();
  } catch (e) {
    console.error('media stream error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
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
