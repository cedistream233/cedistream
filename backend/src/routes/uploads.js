import express from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../lib/auth.js';
import { createBackblazeClient } from '../lib/backblaze.js';
import { query } from '../lib/database.js';

import QueryStream from 'pg-query-stream';
import { getPool } from '../lib/database.js';
const router = express.Router();
// Unlimited file size to support large video uploads (YouTube-length videos ~1 hour+)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: Infinity // No file size limit
  }
});

// Helper to upload a file buffer to supabase and return public URL.
// Implements simple retry/backoff for transient network/gateway errors (502, network connection lost).
async function uploadToStorage(bucket, path, buffer, contentType) {
  // Use Backblaze client (required)
  const backblaze = createBackblazeClient();

  const maxAttempts = Number(process.env.SUPABASE_UPLOAD_ATTEMPTS || 3);
  const baseDelay = Number(process.env.SUPABASE_UPLOAD_BACKOFF_MS || 500);
  let lastErr = null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let uploadResult;
      if (backblaze) {
        const b = backblaze.from(bucket);
        uploadResult = await b.upload(path, buffer, { contentType });
        if (uploadResult.error) throw uploadResult.error;
  // attempt to build public url (Backblaze Friendly URL)
  const { data } = await b.getPublicUrl(path);
  if (data && data.publicUrl) return data.publicUrl;
  // If for some reason getPublicUrl failed to return a URL, throw to trigger retry logic
  throw new Error('Failed to build public URL after upload');
      }
    } catch (err) {
      // Catch unexpected exceptions (network / fetch wrapper errors)
      lastErr = err;
      if (attempt === maxAttempts) throw err;
      console.warn(`uploadToStorage attempt ${attempt} threw, will retry:`, err?.message || err);
    }

    // exponential backoff before next attempt
    const delay = baseDelay * Math.pow(2, attempt - 1);
    await sleep(delay);
  }

  // If we exit loop without returning, throw the last seen error
  throw lastErr || new Error('uploadToStorage failed');
}

// Upload image and generate resized variants (small/medium/large + optimized original)
async function uploadImageVariants(bucket, path, buffer, contentType) {
  // dynamic import sharp to avoid startup penalty when not needed
  const sharp = (await import('sharp')).default;
  const sizes = { small: 64, medium: 320, large: 800 };
  const baseNoExt = String(path).replace(/\.[^.]+$/, '');
  const out = {};
  try {
    // Upload resized variants
    for (const [name, w] of Object.entries(sizes)) {
      try {
        const buf = await sharp(buffer).resize({ width: Number(w), height: Number(w), fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
        const p = `${baseNoExt}-${w}w.jpg`;
        out[name] = await uploadToStorage(bucket, p, buf, 'image/jpeg');
      } catch (e) {
        // warn but continue
        console.warn('Failed to create/upload variant', name, e?.message || e);
      }
    }

    // Upload an optimized original (max dimension limit)
    try {
      const maxOrig = Number(process.env.IMAGE_MAX_DIM || 2000);
      const origBuf = await sharp(buffer).resize({ width: maxOrig, height: maxOrig, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
      out.original = await uploadToStorage(bucket, path, origBuf, 'image/jpeg');
    } catch (e) {
      console.warn('Failed to upload optimized original image', e?.message || e);
      // fallback: attempt to upload the raw buffer using the original path
      out.original = await uploadToStorage(bucket, path, buffer, contentType || 'application/octet-stream');
    }
  } catch (err) {
    console.error('uploadImageVariants error', err);
    throw err;
  }
  return out;
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
      // Store album covers in albums bucket (cedistream-album-covers)
      const path = `album-covers/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      try {
        const variants = await uploadImageVariants('albums', path, byField.cover.buffer, byField.cover.mimetype || 'image/jpeg');
        // Prefer medium variant for listing thumbnails, fall back to small/original
        coverUrl = variants.medium || variants.small || variants.original || null;
      } catch (e) {
        // fallback to uploading the raw cover if variants failed
        coverUrl = await uploadToStorage('albums', path, byField.cover.buffer, byField.cover.mimetype || 'image/jpeg');
      }
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
        audioUrl = await uploadToStorage('media', path, f.buffer, f.mimetype || 'audio/mpeg');
      }
      if (s.preview && byField[s.preview]) {
        const f = byField[s.preview];
        const ext = (f.originalname.split('.').pop() || 'mp3').toLowerCase();
        const pathPrev = `albums/${userId}/${album.id}/previews/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        previewUrl = await uploadToStorage('previews', pathPrev, f.buffer, f.mimetype || 'audio/mpeg');
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
  // ensure Backblaze storage is configured
  const b2 = createBackblazeClient();
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
    const videoUrl = await uploadToStorage('videos', vpath, videoFile.buffer, videoFile.mimetype || 'video/mp4');

    let thumbUrl = null;
    if (thumbFile) {
      const text = (thumbFile.originalname.split('.').pop() || 'jpg').toLowerCase();
      const tpath = `thumbnails/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${text}`;
      try {
        const variants = await uploadImageVariants('thumbnails', tpath, thumbFile.buffer, thumbFile.mimetype || 'image/jpeg');
        thumbUrl = variants.medium || variants.small || variants.original || null;
      } catch (e) {
        thumbUrl = await uploadToStorage('thumbnails', tpath, thumbFile.buffer, thumbFile.mimetype || 'image/jpeg');
      }
    }

    // optional preview file for video
    let previewUrl = null;
    const previewField = req.files?.preview?.[0];
    if (previewField) {
      const pext = (previewField.originalname.split('.').pop() || 'mp4').toLowerCase();
      const ppath = `videos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}-preview.${pext}`;
      previewUrl = await uploadToStorage('previews', ppath, previewField.buffer, previewField.mimetype || 'video/mp4');
    }

    // Insert video row with status 'processing' while we create optimized files in background
    const ins = await query(
      `INSERT INTO videos (title, description, price, thumbnail, video_url, preview_url, category, release_date, user_id, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [title, description, parseFloat(price), thumbUrl, videoUrl, previewUrl, category, release_date || null, userId, 'processing', new Date()]
    );

    // Spawn background worker to post-process (transcode & upload sd/hq)
    try {
      const { spawn } = await import('child_process');
      const node = process.execPath || 'node';
      const script = path.join(process.cwd(), 'backend', 'scripts', 'postprocess-video.js');
      // Write uploaded buffer to a temporary file for ffmpeg to read
      const tmpDir = path.join(process.cwd(), 'tmp', 'uploads');
      fs.mkdirSync(tmpDir, { recursive: true });
      const tmpFile = path.join(tmpDir, `upload-${Date.now()}-${Math.random().toString(36).slice(2)}.${vext}`);
      fs.writeFileSync(tmpFile, videoFile.buffer);

      const child = spawn(node, [script, tmpFile, ins.rows[0].id], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env }
      });
      child.unref();
    } catch (e) {
      console.error('Failed to spawn postprocess worker', e);
    }

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

    // upload audio to media bucket (cedistream-audio-files)
    const aext = (audioFile.originalname.split('.').pop() || 'mp3').toLowerCase();
    const apath = `songs/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${aext}`;
    const audioUrl = await uploadToStorage('media', apath, audioFile.buffer, audioFile.mimetype || 'audio/mpeg');

    // optional cover (store in albums bucket = cedistream-album-covers)
    let coverUrl = null;
    if (coverFile) {
      const cext = (coverFile.originalname.split('.').pop() || 'jpg').toLowerCase();
      const cpath = `covers/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${cext}`;
      try {
        const variants = await uploadImageVariants('albums', cpath, coverFile.buffer, coverFile.mimetype || 'image/jpeg');
        coverUrl = variants.medium || variants.small || variants.original || null;
      } catch (e) {
        coverUrl = await uploadToStorage('albums', cpath, coverFile.buffer, coverFile.mimetype || 'image/jpeg');
      }
    }

    // optional preview (to previews bucket = cedistream-previews)
    let previewUrl = null;
    if (previewFile) {
      const pext = (previewFile.originalname.split('.').pop() || 'mp3').toLowerCase();
      const ppath = `previews/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${pext}`;
      previewUrl = await uploadToStorage('previews', ppath, previewFile.buffer, previewFile.mimetype || 'audio/mpeg');
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
    const offset = Number.isFinite(Number(req.query.offset)) ? Math.max(0, parseInt(req.query.offset, 10)) : 0;
    // Build base WHERE clause
    const whereClause = `p.payment_status = 'completed' AND (
      (p.item_type = 'album' AND p.item_id IN (SELECT id FROM albums WHERE user_id = $1)) OR
      (p.item_type = 'video' AND p.item_id IN (SELECT id FROM videos WHERE user_id = $1)) OR
      (p.item_type = 'song'  AND p.item_id IN (SELECT id FROM songs WHERE user_id = $1))
    )`;

    // total count
    const countSql = `SELECT COUNT(*)::int as total FROM purchases p WHERE ${whereClause}`;
    const countRes = await query(countSql, [userId]);
    const total = countRes.rows?.[0]?.total || 0;

    // items
    const sql = `SELECT p.id, p.item_type, p.item_title as item, p.amount, p.creator_amount, p.created_at as date, p.payment_status,
      COALESCE(cp.stage_name, CONCAT(u.first_name, ' ', u.last_name), u.email, '—') as buyer_name
         FROM purchases p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN creator_profiles cp ON cp.user_id = u.id
         WHERE ${whereClause}
         ORDER BY p.created_at DESC
         ${limit > 0 ? 'LIMIT $2 OFFSET $3' : ''}`;

    const params = limit > 0 ? [userId, limit, offset] : [userId];
    const result = await query(sql, params);
    return res.json({ items: result.rows, total });
  } catch (err) {
    // If schema isn't fully migrated yet (e.g., songs table or user_id columns missing), return empty list gracefully
    if (err && (err.code === '42P01' /* undefined_table */ || err.code === '42703' /* undefined_column */)) {
      return res.json([]);
    }
    console.error('recent-sales error:', err);
    return res.status(500).json({ error: 'Failed to load recent sales' });
  }
});

// Upload a single image for promotions (admin only)
router.post('/promotions-image', authenticateToken, requireRole(['admin']), upload.single('image'), async (req, res) => {
  try {
  // ensure Backblaze storage is configured
  const b2 = createBackblazeClient();
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'image file is required' });
    // server-side processing using sharp. Accept optional transform params from multipart form field 'transform'
    const sharp = (await import('sharp')).default;
    const transformRaw = req.body && req.body.transform ? req.body.transform : null;
    let buffer;
  if (transformRaw) {
      let transform;
      try { transform = JSON.parse(transformRaw); } catch (e) { transform = null; }
  if (transform && typeof transform.zoom === 'number' && transform.offset && typeof transform.offset.x === 'number') {
        // Compute crop rectangle based on original image dimensions
        const imgMeta = await sharp(file.buffer).metadata();
        const origW = imgMeta.width || 1;
        const origH = imgMeta.height || 1;

        // The preview container is 272x272 (w-72 h-72) in CSS; but we used a 56(=w-56) crop overlay in modal.
        // Instead of relying on CSS pixels, transform.offset is provided in pixels relative to preview container center.
        // We treat zoom as scale applied to the image relative to original size.
  const zoom = Number(transform.zoom) || 1;
  const outputSize = Number(transform.outputSize || Number(process.env.PROMO_IMAGE_MAX_DIM || 600));
  const viewport = Number(transform.viewportSize || 280);
        // offset given in px relative to preview center; convert to image coordinate system
        const offsetX = Number(transform.offset.x || 0);
        const offsetY = Number(transform.offset.y || 0);

  // In the preview, the square viewport is 'viewport' CSS px. The image is rendered scaled by 'zoom',
  // and offset is measured in viewport pixels relative to the viewport center.
  // The mapping from viewport to original pixels is: original = (viewport / zoom) scaled by (orig/displayDisplay),
  // but since we draw at 1 CSS px per image px before zoom, we can use: original = viewport / zoom.
  // So to crop the square visible in the viewport:
  const halfViewport = viewport / 2;
  const centerX_in_original = (origW / 2) + (offsetX / zoom);
  const centerY_in_original = (origH / 2) + (offsetY / zoom);
  const halfCrop_in_original = halfViewport / zoom;
  const extractLeft = Math.round(centerX_in_original - halfCrop_in_original);
  const extractTop = Math.round(centerY_in_original - halfCrop_in_original);
  const extractSize = Math.round((viewport) / zoom);

        // Clamp values
        const left = Math.max(0, Math.min(extractLeft, origW - 1));
        const top = Math.max(0, Math.min(extractTop, origH - 1));
  const size = Math.max(1, Math.min(extractSize, Math.min(origW, origH)));

        // Use extract and resize to get exact output
        buffer = await sharp(file.buffer).extract({ left, top, width: size, height: size }).resize(outputSize, outputSize).jpeg({ quality: 90 }).toBuffer();
      } else {
        // fallback resize cover
        const maxDim = Number(process.env.PROMO_IMAGE_MAX_DIM || 1200);
        buffer = await sharp(file.buffer).resize({ width: maxDim, height: maxDim, fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
      }
    } else {
      const maxDim = Number(process.env.PROMO_IMAGE_MAX_DIM || 1200);
      buffer = await sharp(file.buffer).resize({ width: maxDim, height: maxDim, fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
    }
  const ext = 'jpg';
  const storagePath = `promotions/${req.user?.id || 'admin'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    const variants = await uploadImageVariants('promotions', storagePath, buffer, 'image/jpeg');
    const displayUrl = variants.medium || variants.small || variants.original || null;
    return res.json({ url: displayUrl, storagePath, variants });
  } catch (e) {
    const publicUrl = await uploadToStorage('promotions', storagePath, buffer, 'image/jpeg');
    return res.json({ url: publicUrl, storagePath });
  }
  } catch (err) {
    console.error('Promotions image upload error:', err);
    return res.status(500).json({ error: 'Failed to upload image' });
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
      // Determine amount to export (creator net preferred). Fallback to gross amount or compute 80% if creator_amount missing.
      const hasCreator = row.creator_amount !== null && row.creator_amount !== undefined;
      const hasGross = row.amount !== null && row.amount !== undefined;
      let amountToExport = 0;
      if (hasCreator) {
        amountToExport = Number(row.creator_amount);
      } else if (hasGross) {
        // If creator_amount missing, use gross as fallback for transparency
        amountToExport = Number(row.amount);
      } else if (hasGross === false && row.creator_amount === null) {
        amountToExport = 0;
      }
      // If creator_amount missing but gross exists and we prefer net, compute 80% as a best-effort fallback
      if (!hasCreator && hasGross) {
        // prefer showing net when creator_amount not stored, compute 80%
        amountToExport = +(Number(row.amount) * 0.8).toFixed(2);
      }

      const line = [row.date, row.item_type, row.item, amountToExport.toFixed(2), row.buyer_name, row.payment_status]
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

// GET /api/uploads/sales/:itemType/:itemId
// Return aggregate sales data for a single item (count, gross_total, creator_total)
router.get('/sales/:itemType/:itemId', authenticateToken, requireRole(['creator']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemType, itemId } = req.params;
    if (!['album','song','video'].includes(itemType)) return res.status(400).json({ error: 'Invalid item type' });

    // Verify ownership: the item must belong to this creator
    let owns = false;
    if (itemType === 'album') {
      const r = await query('SELECT 1 FROM albums WHERE id = $1 AND user_id = $2', [itemId, userId]);
      owns = r && r.rowCount > 0;
    } else if (itemType === 'song') {
      const r = await query('SELECT 1 FROM songs WHERE id = $1 AND user_id = $2', [itemId, userId]);
      owns = r && r.rowCount > 0;
    } else if (itemType === 'video') {
      const r = await query('SELECT 1 FROM videos WHERE id = $1 AND user_id = $2', [itemId, userId]);
      owns = r && r.rowCount > 0;
    }

    if (!owns) return res.status(403).json({ error: 'Not authorized for this item' });

    const agg = await query(
      `SELECT COUNT(1)::int as count, COALESCE(SUM(p.amount),0)::numeric::float8 as gross_total, COALESCE(SUM(p.creator_amount),0)::numeric::float8 as creator_total
       FROM purchases p
       WHERE p.payment_status = 'completed' AND p.item_type = $1 AND p.item_id = $2`,
      [itemType, itemId]
    );

    return res.json(agg.rows?.[0] || { count: 0, gross_total: 0, creator_total: 0 });
  } catch (err) {
    console.error('sales aggregate error:', err);
    return res.status(500).json({ error: 'Failed to load sales summary' });
  }
});
