import { Router } from 'express';
import { query } from '../lib/database.js';
import { authenticateToken } from '../lib/auth.js';

const router = Router();

// Get like count and user like status for a comment
router.get('/:commentId', async (req, res, next) => {
  try {
    const { commentId } = req.params;
    let userHasLiked = false;
    let userId = null;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          userId = payload.id || payload.sub || payload.user_id || null;
        }
      } catch {}
    }
    // Like count
    const countResult = await query('SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = $1', [commentId]);
    // User like status
    if (userId) {
      const userLikeResult = await query('SELECT id FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
      userHasLiked = userLikeResult.rows.length > 0;
    }
    res.json({ count: parseInt(countResult.rows[0].count), userHasLiked });
  } catch (err) { next(err); }
});

// Like a comment
router.post('/:commentId', authenticateToken, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    // Check comment exists
    const commentExists = await query('SELECT id FROM comments WHERE id = $1', [commentId]);
    if (commentExists.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    // Insert like
    try {
      await query('INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2)', [userId, commentId]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Already liked' });
      throw err;
    }
    const countResult = await query('SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = $1', [commentId]);
    res.json({ success: true, count: parseInt(countResult.rows[0].count), userHasLiked: true });
  } catch (err) { next(err); }
});

// Unlike a comment
router.delete('/:commentId', authenticateToken, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const result = await query('DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2', [userId, commentId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Like not found' });
    const countResult = await query('SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = $1', [commentId]);
    res.json({ success: true, count: parseInt(countResult.rows[0].count), userHasLiked: false });
  } catch (err) { next(err); }
});

export default router;
