# Quick Start: Like and Comment Feature

## 1. Run Database Migration

Navigate to the backend directory and run the migration:

```bash
cd backend
node scripts/migrate-add-likes-and-comments.js
```

Expected output:
```
🔄 Running likes and comments migration...
✅ Likes and comments migration completed successfully!
📊 Created tables: likes, comments
📊 Created views: content_like_counts, content_comment_counts
🔍 Created indexes for optimal performance
```

## 2. Restart Backend Server

If the backend is already running, restart it to load the new routes:

```bash
# Stop the current backend process (Ctrl+C)
# Then start it again
npm run start
```

Or if using the task:
```bash
# Run the backend-quick-restart task
```

## 3. Test the Feature

1. Open your browser and navigate to any content detail page:
   - Video: `/videos/:id`
   - Album: `/albums/:id`
   - Song: `/songs/:id`

2. You should see:
   - A heart-shaped like button below the main action button
   - A "Comments" section at the bottom of the page

3. Try interacting:
   - Click the heart to like (must be logged in)
   - Expand comments and post a comment
   - Reply to a comment
   - Edit/delete your own comments

## Troubleshooting

If you encounter any issues:

1. **Migration fails**: 
   - Check your database connection in `.env`
   - Ensure PostgreSQL extension `uuid-ossp` is enabled
   - Check database logs for specific errors

2. **Routes not working**:
   - Verify backend server restarted after migration
   - Check backend logs for route registration
   - Test API directly: `GET http://localhost:5000/api/likes/video/{video-id}`

3. **Frontend components not showing**:
   - Clear browser cache
   - Check browser console for errors
   - Verify API_URL is correct in frontend

## What's New

### Backend
- ✅ `/backend/database/add_likes_and_comments.sql` - Database schema
- ✅ `/backend/scripts/migrate-add-likes-and-comments.js` - Migration script
- ✅ `/backend/src/routes/likes.js` - Likes API endpoints
- ✅ `/backend/src/routes/comments.js` - Comments API endpoints
- ✅ `/backend/src/server.js` - Updated to register new routes

### Frontend
- ✅ `/frontend/src/components/content/LikeButton.jsx` - Reusable like button
- ✅ `/frontend/src/components/content/CommentsSection.jsx` - Comments component
- ✅ `/frontend/src/pages/VideoDetails.jsx` - Integrated like & comments
- ✅ `/frontend/src/pages/AlbumDetails.jsx` - Integrated like & comments
- ✅ `/frontend/src/pages/SongDetails.jsx` - Integrated like & comments

For detailed documentation, see `LIKES_COMMENTS_FEATURE.md`.
