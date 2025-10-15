import express from 'express';
import { query } from '../lib/database.js';

const router = express.Router();

// Public list of currently active promotions
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const q = `
      SELECT id, title, url, description, image, priority, published, starts_at, ends_at, created_at
      FROM promotions
      WHERE published = true
        AND (starts_at IS NULL OR starts_at <= $1)
        AND (ends_at IS NULL OR ends_at >= $1)
      ORDER BY priority DESC, created_at DESC
    `;
    const result = await query(q, [now]);
    res.json(result.rows);
  } catch (e) {
    console.error('Promotions fetch error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
