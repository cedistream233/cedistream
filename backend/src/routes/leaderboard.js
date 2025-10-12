import { Router } from 'express';
import { query } from '../lib/database.js';

const router = Router();

// GET /api/leaderboard/:itemType/:itemId - returns top 3 supporters
router.get('/:itemType/:itemId', async (req, res, next) => {
  try {
    const { itemType, itemId } = req.params;
    if (!['song', 'video', 'album'].includes(itemType)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }

    // Get top 3 supporters by total amount spent on this specific item
    const result = await query(
      `SELECT 
         u.id as user_id,
         COALESCE(u.first_name || ' ' || u.last_name, u.username, 'Anonymous') as name,
         u.profile_image,
         COALESCE(SUM(p.amount), 0)::numeric::float8 as total_amount,
         COUNT(p.id)::int as purchase_count
       FROM purchases p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.item_type = $1 AND p.item_id = $2 AND p.payment_status = 'completed'
       GROUP BY u.id, u.first_name, u.last_name, u.username, u.profile_image
       ORDER BY total_amount DESC
       LIMIT 3`,
      [itemType, itemId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
