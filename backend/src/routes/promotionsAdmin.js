import express from 'express';
import { query } from '../lib/database.js';
import { authenticateToken, requireRole } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// List all promotions (admin)
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await query('SELECT * FROM promotions ORDER BY priority DESC, created_at DESC');
    res.json(result.rows);
  } catch (e) {
    console.error('Admin promotions list error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create promotion
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { title, url, description = null, image = null, priority = 0, published = true, startsAt = null, endsAt = null } = req.body || {};
    if (!title || !url) return res.status(400).json({ error: 'title and url are required' });
    // Basic url validation
    if (!(String(url).startsWith('http://') || String(url).startsWith('https://'))) {
      return res.status(400).json({ error: 'url must start with http:// or https://' });
    }

    const q = `
      INSERT INTO promotions (title, url, description, image, priority, published, starts_at, ends_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `;
    const params = [title, url, description, image, priority, published, startsAt, endsAt];
    const result = await query(q, params);
    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error('Create promotion error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update promotion
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const fields = [];
    const params = [];
    const allowed = ['title','url','description','image','priority','published','startsAt','endsAt'];
    let idx = 1;
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        // Map camelCase to snake_case for startsAt/endsAt
        const column = k === 'startsAt' ? 'starts_at' : (k === 'endsAt' ? 'ends_at' : k);
        fields.push(`${column} = $${idx}`);
        params.push(req.body[k]);
        idx++;
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No updatable fields provided' });
    params.push(id);
    const q = `UPDATE promotions SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const result = await query(q, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error('Update promotion error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete promotion
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    // Fetch promotion to get image URL before deleting
    const r = await query('SELECT image FROM promotions WHERE id = $1', [id]);
    if (!r || r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    const imageUrl = r.rows[0].image;
    // Attempt to remove image from storage if configured
    if (imageUrl && supabase) {
      try {
        // Try to derive path from public URL
        const bucket = process.env.SUPABASE_BUCKET_PROMOTIONS || process.env.SUPABASE_BUCKET_MEDIA || 'media';
        let path = null;
        // Supabase public URL pattern contains '/storage/v1/object/public/<bucket>/'
        const marker = `/storage/v1/object/public/${bucket}/`;
        const idx = imageUrl.indexOf(marker);
        if (idx !== -1) {
          path = imageUrl.slice(idx + marker.length);
        } else {
          // fallback: find '/<bucket>/' and take remainder
          const alt = `/${bucket}/`;
          const idx2 = imageUrl.indexOf(alt);
          if (idx2 !== -1) path = imageUrl.slice(idx2 + alt.length);
        }
        if (path) {
          await supabase.storage.from(bucket).remove([path]);
        }
      } catch (e) {
        console.warn('Failed to remove promotion image from storage:', e.message || e);
      }
    }

    await query('DELETE FROM promotions WHERE id = $1', [id]);
    res.status(204).send();
  } catch (e) {
    console.error('Delete promotion error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
