import { Router } from 'express';
import { query } from '../lib/database.js';
import { authenticateToken } from '../lib/auth.js';

const router = Router();

// Get comments for a specific content item
router.get('/:contentType/:contentId', async (req, res, next) => {
  try {
    const { contentType, contentId } = req.params;
    
    // Validate content type
    if (!['video', 'album', 'song'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    // Get all comments with user information
    // Join with users table to get username and profile image
    const result = await query(
      `SELECT 
        c.id,
        c.user_id,
        c.parent_id,
        c.comment_text,
        c.created_at,
        c.updated_at,
        u.username,
        u.profile_image,
        u.profile_image_path
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.content_type = $1 AND c.content_id = $2
      ORDER BY c.created_at ASC`,
      [contentType, contentId]
    );

    // Organize comments into a tree structure (parent comments with nested replies)
    const commentsMap = {};
    const rootComments = [];

    result.rows.forEach(comment => {
      commentsMap[comment.id] = {
        ...comment,
        replies: []
      };
    });

    result.rows.forEach(comment => {
      if (comment.parent_id) {
        // This is a reply
        if (commentsMap[comment.parent_id]) {
          commentsMap[comment.parent_id].replies.push(commentsMap[comment.id]);
        }
      } else {
        // This is a root comment
        rootComments.push(commentsMap[comment.id]);
      }
    });

    res.json({
      comments: rootComments,
      total: result.rows.length
    });
  } catch (err) {
    next(err);
  }
});

// Post a new comment (requires authentication)
router.post('/:contentType/:contentId', authenticateToken, async (req, res, next) => {
  try {
    const { contentType, contentId } = req.params;
    const { comment_text, parent_id } = req.body;
    const userId = req.user.id;

    // Validate content type
    if (!['video', 'album', 'song'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    // Validate comment text
    if (!comment_text || comment_text.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    if (comment_text.length > 2000) {
      return res.status(400).json({ error: 'Comment is too long (max 2000 characters)' });
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

    // If this is a reply, check if parent comment exists
    if (parent_id) {
      const parentExists = await query(
        `SELECT id FROM comments WHERE id = $1 AND content_type = $2 AND content_id = $3`,
        [parent_id, contentType, contentId]
      );

      if (parentExists.rows.length === 0) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    // Insert comment
    const result = await query(
      `INSERT INTO comments (user_id, content_type, content_id, parent_id, comment_text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, content_type, content_id, parent_id, comment_text, created_at, updated_at`,
      [userId, contentType, contentId, parent_id || null, comment_text.trim()]
    );

    // Get user info for the response
    const userInfo = await query(
      `SELECT username, profile_image, profile_image_path FROM users WHERE id = $1`,
      [userId]
    );

    const comment = {
      ...result.rows[0],
      username: userInfo.rows[0]?.username,
      profile_image: userInfo.rows[0]?.profile_image,
      profile_image_path: userInfo.rows[0]?.profile_image_path,
      replies: []
    };

    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

// Update a comment (requires authentication and ownership)
router.put('/:commentId', authenticateToken, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { comment_text } = req.body;
    const userId = req.user.id;

    // Validate comment text
    if (!comment_text || comment_text.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    if (comment_text.length > 2000) {
      return res.status(400).json({ error: 'Comment is too long (max 2000 characters)' });
    }

    // Check if comment exists and user owns it
    const commentCheck = await query(
      `SELECT user_id FROM comments WHERE id = $1`,
      [commentId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (commentCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    // Update comment
    const result = await query(
      `UPDATE comments 
       SET comment_text = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, user_id, content_type, content_id, parent_id, comment_text, created_at, updated_at`,
      [comment_text.trim(), commentId]
    );

    // Get user info for the response
    const userInfo = await query(
      `SELECT username, profile_image, profile_image_path FROM users WHERE id = $1`,
      [userId]
    );

    const comment = {
      ...result.rows[0],
      username: userInfo.rows[0]?.username,
      profile_image: userInfo.rows[0]?.profile_image,
      profile_image_path: userInfo.rows[0]?.profile_image_path
    };

    res.json(comment);
  } catch (err) {
    next(err);
  }
});

// Delete a comment (requires authentication and ownership)
router.delete('/:commentId', authenticateToken, async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Fetch comment with content identifiers
    const commentRes = await query(
      `SELECT user_id, content_type, content_id FROM comments WHERE id = $1`,
      [commentId]
    );
    if (commentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const commentRow = commentRes.rows[0];

    // Determine if requester is the comment owner or the content owner
    let isAllowed = String(commentRow.user_id) === String(userId);
    if (!isAllowed) {
      const tableMap = { video: 'videos', album: 'albums', song: 'songs' };
      const table = tableMap[commentRow.content_type];
      if (table) {
        const ownerRes = await query(`SELECT user_id FROM ${table} WHERE id = $1`, [commentRow.content_id]);
        if (ownerRes.rows.length > 0) {
          const contentOwnerId = ownerRes.rows[0].user_id;
          isAllowed = String(contentOwnerId) === String(userId);
        }
      }
    }

    if (!isAllowed) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Delete comment (CASCADE will delete replies)
    await query(
      `DELETE FROM comments WHERE id = $1`,
      [commentId]
    );

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
