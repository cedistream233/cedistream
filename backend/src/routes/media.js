import express from 'express';
import { createBackblazeClient } from '../lib/backblaze.js';
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
  const privateBuckets = new Set([
    process.env.BACKBLAZE_BUCKET_MEDIA || process.env.SUPABASE_BUCKET_MEDIA,
    process.env.BACKBLAZE_BUCKET_VIDEOS || process.env.SUPABASE_BUCKET_VIDEOS
  ].filter(Boolean));
  return privateBuckets.has(bucket);
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
    const encodedPath = encodeURIComponent(objectPath);
    // If this bucket is private, return our stream endpoint
    if (isPrivateBucket(bucket)) {
      const streamUrl = `${process.env.APP_URL || ''}/api/media/stream/${bucket}/${encodedPath}`;
      return res.json({ url: streamUrl });
    }
    // Public bucket: return constructed public URL
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
                  const encodedPath = encodeURIComponent(objectPath);
                  const streamUrl = `${process.env.APP_URL || ''}/api/media/stream/${bucket}/${encodedPath}`;
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
          const encodedPath = encodeURIComponent(objectPath);
          const streamUrl = `${process.env.APP_URL || ''}/api/media/stream/${bucket}/${encodedPath}`;
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
                if (useBackblaze) {
                  const encodedPath = encodeURIComponent(objectPath);
                  const streamUrl = `${process.env.APP_URL || ''}/api/media/stream/${bucket}/${encodedPath}`;
                  return res.json({ url: streamUrl });
                }
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
      try {
        const b2 = createBackblazeClient();
        if (isPrivateBucket(bucket)) {
          const encodedPath = encodeURIComponent(objectPath);
          const streamUrl = `${process.env.APP_URL || ''}/api/media/stream/${bucket}/${encodedPath}`;
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
  try {
    const b2 = createBackblazeClient();
    if (isPrivateBucket(bucket)) {
      const encodedPath = encodeURIComponent(objectPath);
      const streamUrl = `${process.env.APP_URL || ''}/api/media/stream/${bucket}/${encodedPath}`;
      return res.json({ url: streamUrl });
    }
    const { data: pub } = await b2.from(bucket).getPublicUrl(objectPath);
    return res.json({ url: pub.publicUrl });
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
router.get('/stream/:bucket/:encodedPath', async (req, res) => {
  try {
    const { bucket, encodedPath } = req.params;
    const objectPath = decodeURIComponent(encodedPath);
    
    // Check if this is preview content (public) or requires auth
    const isPreview = objectPath.includes('/previews/') || objectPath.includes('-preview.');
    
    if (!isPreview) {
      // Require authentication for non-preview content
      const auth = req.headers['authorization'];
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      try {
        const token = auth.split(' ')[1];
        const { verifyToken } = await import('../lib/auth.js');
        const decoded = verifyToken(token);
        const userId = decoded?.id;
        
        if (!userId) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        
        // Load user email for legacy purchase checks
        let userEmail = null;
        try {
          const ur = await query('SELECT email FROM users WHERE id = $1', [userId]);
          userEmail = ur.rows?.[0]?.email || null;
        } catch {}
        
        // Verify access (ownership or purchase)
        const hasAccess = await verifyStreamAccess(userId, userEmail, objectPath);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } catch (authError) {
        console.error('Stream auth error:', authError);
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    // Stream the content
    const range = req.headers.range || null;
    const b2 = createBackblazeClient();
    const downloader = b2.from(bucket);
    const result = await downloader.downloadStream(objectPath, range);
    
    if (result.error) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    // Set headers forwarded from B2 if present
    const headers = result.headers || {};
    if (headers['content-type']) res.setHeader('Content-Type', headers['content-type']);
    if (headers['content-length']) res.setHeader('Content-Length', headers['content-length']);
    if (headers['content-range']) res.setHeader('Content-Range', headers['content-range']);
    if (headers['accept-ranges']) res.setHeader('Accept-Ranges', headers['accept-ranges']);
    
    // Enable CORS for streaming endpoint
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Stream the body
    const body = result.data;
    if (body && typeof body.pipe === 'function') {
      return body.pipe(res);
    }
    // Fallback: body as Buffer
    if (Buffer.isBuffer(body)) return res.end(body);
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
