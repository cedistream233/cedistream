import { Router } from 'express';
import { query } from '../lib/database.js';
import { authenticateToken } from '../lib/auth.js';

const router = Router();

// Get likes for a specific content item
router.get('/:contentType/:contentId', async (req, res, next) => {
  try {
    const { contentType, contentId } = req.params;
    
    // Validate content type
    if (!['video', 'album', 'song'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    // Get total like count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM likes WHERE content_type = $1 AND content_id = $2`,
      [contentType, contentId]
    );

    // Check if current user has liked (if authenticated)
    let userHasLiked = false;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      try {
        const userId = await getUserIdFromToken(token);
        if (userId) {
          const userLikeResult = await query(
            `SELECT id FROM likes WHERE content_type = $1 AND content_id = $2 AND user_id = $3`,
            [contentType, contentId, userId]
          );
          userHasLiked = userLikeResult.rows.length > 0;
        }
      } catch (err) {
        // If token is invalid, just return userHasLiked as false
      }
    }

    res.json({
      count: parseInt(countResult.rows[0].count),
      userHasLiked
    });
  } catch (err) {
    next(err);
  }
});

// Add a like (requires authentication)
router.post('/:contentType/:contentId', authenticateToken, async (req, res, next) => {
  try {
    const { contentType, contentId } = req.params;
    const userId = req.user.id;

    // Validate content type
    if (!['video', 'album', 'song'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    // Check if content exists
    const tableMap = { video: 'videos', album: 'albums', song: 'songs' };
    const table = tableMap[contentType];
    const contentExists = await query(
      `SELECT id FROM ${table} WHERE id = $1`,
      [contentId]
    );

    if (contentExists.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Insert like (will fail if already exists due to UNIQUE constraint)
    try {
      await query(
        `INSERT INTO likes (user_id, content_type, content_id) VALUES ($1, $2, $3)`,
        [userId, contentType, contentId]
      );

      // Get updated count
      const countResult = await query(
        `SELECT COUNT(*) as count FROM likes WHERE content_type = $1 AND content_id = $2`,
        [contentType, contentId]
      );

      res.json({
        success: true,
        count: parseInt(countResult.rows[0].count),
        userHasLiked: true
      });
    } catch (err) {
      if (err.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Already liked' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// Remove a like (requires authentication)
router.delete('/:contentType/:contentId', authenticateToken, async (req, res, next) => {
  try {
    const { contentType, contentId } = req.params;
    const userId = req.user.id;

    // Validate content type
    if (!['video', 'album', 'song'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    // Delete like
    const result = await query(
      `DELETE FROM likes WHERE user_id = $1 AND content_type = $2 AND content_id = $3`,
      [userId, contentType, contentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Like not found' });
    }

    // Get updated count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM likes WHERE content_type = $1 AND content_id = $2`,
      [contentType, contentId]
    );

    res.json({
      success: true,
      count: parseInt(countResult.rows[0].count),
      userHasLiked: false
    });
  } catch (err) {
    next(err);
  }
});

// Helper function to extract user ID from token
async function getUserIdFromToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.id || payload.sub || payload.user_id || null;
  } catch (err) {
    return null;
  }
}

export default router;
