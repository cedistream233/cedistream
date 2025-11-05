# Like and Comment Feature Implementation

## Overview
This document describes the modern like and comment feature added to CediStream, enabling users to engage with videos, albums, and songs through likes and threaded comments.

## Features

### Like System
- **One-click like/unlike** for all content types (videos, albums, songs)
- **Real-time like counts** displayed on each content page
- **Optimistic UI updates** for instant feedback
- **Authentication required** - redirects to login if not authenticated
- **Animated heart icon** with fill effect on like
- **Persistent state** - likes are saved to database and synced across sessions

### Comment System
- **Threaded comments** with nested replies
- **Edit and delete** your own comments
- **Reply to comments** with visual threading
- **User profiles** - shows username and profile image
- **Timestamps** - relative time display (e.g., "2 hours ago")
- **Collapsible section** - comments can be hidden/shown
- **Character limit** - 2000 characters per comment
- **Authentication required** - redirects to login if not authenticated

## Database Schema

### Tables Created

#### `likes` Table
```sql
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('video', 'album', 'song')),
    content_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_type, content_id)
);
```

#### `comments` Table
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('video', 'album', 'song')),
    content_id UUID NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (LENGTH(TRIM(comment_text)) > 0)
);
```

### Indexes
- `idx_likes_content` - Fast lookup by content type and ID
- `idx_likes_user` - Fast lookup by user
- `idx_comments_content` - Fast lookup of comments for content
- `idx_comments_user` - Fast lookup of user's comments
- `idx_comments_parent` - Fast lookup of comment replies

### Views
- `content_like_counts` - Aggregated like counts per content
- `content_comment_counts` - Aggregated comment counts per content

## API Endpoints

### Likes API (`/api/likes`)

#### GET `/api/likes/:contentType/:contentId`
Get like count and user's like status
- **Auth**: Optional (shows if user has liked)
- **Response**: `{ count: number, userHasLiked: boolean }`

#### POST `/api/likes/:contentType/:contentId`
Add a like
- **Auth**: Required
- **Response**: `{ success: true, count: number, userHasLiked: true }`

#### DELETE `/api/likes/:contentType/:contentId`
Remove a like
- **Auth**: Required
- **Response**: `{ success: true, count: number, userHasLiked: false }`

### Comments API (`/api/comments`)

#### GET `/api/comments/:contentType/:contentId`
Get all comments for content (nested structure)
- **Auth**: Not required
- **Response**: `{ comments: Comment[], total: number }`

#### POST `/api/comments/:contentType/:contentId`
Post a new comment or reply
- **Auth**: Required
- **Body**: `{ comment_text: string, parent_id?: string }`
- **Response**: Comment object with user info

#### PUT `/api/comments/:commentId`
Edit your own comment
- **Auth**: Required (must be owner)
- **Body**: `{ comment_text: string }`
- **Response**: Updated comment object

#### DELETE `/api/comments/:commentId`
Delete your own comment (cascades to replies)
- **Auth**: Required (must be owner)
- **Response**: `{ success: true }`

## Frontend Components

### LikeButton Component
**Location**: `frontend/src/components/content/LikeButton.jsx`

**Features**:
- Optimistic updates for instant feedback
- Animated heart icon with color transitions
- Shows like count
- Handles authentication redirects
- Red color theme when liked

**Usage**:
```jsx
<LikeButton contentType="video" contentId={videoId} />
```

### CommentsSection Component
**Location**: `frontend/src/components/content/CommentsSection.jsx`

**Features**:
- Collapsible section header
- Nested comment tree structure
- Reply functionality
- Edit/delete for own comments
- User avatars with fallback
- Relative timestamps
- Character limit validation
- Loading states

**Usage**:
```jsx
<CommentsSection contentType="video" contentId={videoId} />
```

## Integration Points

The like and comment features have been integrated into:
1. **VideoDetails.jsx** - Video detail pages
2. **AlbumDetails.jsx** - Album detail pages
3. **SongDetails.jsx** - Song detail pages

Each page displays:
- A LikeButton below the main action button
- A CommentsSection at the bottom of the page

## Migration Instructions

### 1. Run the Database Migration
```bash
cd backend
node scripts/migrate-add-likes-and-comments.js
```

### 2. Restart the Backend Server
The new routes are automatically loaded when the server starts.

### 3. Test the Feature
1. Navigate to any video, album, or song detail page
2. Click the heart button to like/unlike
3. Expand the comments section
4. Post a comment
5. Reply to a comment
6. Edit/delete your own comments

## Security Considerations

### Authentication
- All write operations (like, comment, edit, delete) require authentication
- JWT tokens are validated on the backend
- User ownership is verified for edit/delete operations

### Data Validation
- Comment text must be 1-2000 characters
- Content type is restricted to 'video', 'album', 'song'
- SQL injection protection via parameterized queries
- XSS protection via React's automatic escaping

### Rate Limiting
- Existing rate limiters apply to all API routes
- 100 requests per 15 minutes in production

## UI/UX Features

### Optimistic Updates
- Likes update immediately before server confirmation
- Reverts on error
- Provides instant feedback to users

### Error Handling
- Network errors show user-friendly messages
- Authentication failures redirect to login
- Form validation prevents empty comments

### Responsive Design
- Works on mobile, tablet, and desktop
- Touch-friendly buttons
- Collapsible sections save space on mobile

### Accessibility
- Semantic HTML structure
- Proper button labels
- Keyboard navigation support
- Focus states for interactive elements

## Future Enhancements

Potential improvements for future iterations:
1. **Like notifications** - Notify creators when content is liked
2. **Comment notifications** - Notify when someone replies
3. **Comment reactions** - Allow reacting to comments (emoji)
4. **Sort options** - Sort comments by newest, oldest, most replies
5. **Comment search** - Search within comments
6. **Moderation tools** - Flag inappropriate comments
7. **Real-time updates** - Use WebSockets for live comment updates
8. **Mention system** - @mention other users in comments
9. **Rich text** - Support markdown or basic formatting
10. **Comment likes** - Allow liking individual comments

## Testing Checklist

- [ ] Like a video/album/song
- [ ] Unlike a video/album/song
- [ ] Post a comment
- [ ] Reply to a comment
- [ ] Edit your comment
- [ ] Delete your comment
- [ ] Try to edit someone else's comment (should fail)
- [ ] Try to delete someone else's comment (should fail)
- [ ] Test without authentication (should redirect to login)
- [ ] Test comment character limit (over 2000 chars)
- [ ] Test empty comment submission (should prevent)
- [ ] Test nested replies (3+ levels deep)
- [ ] Test on mobile device
- [ ] Test with slow network (optimistic updates)

## Troubleshooting

### Likes not showing
- Check database migration ran successfully
- Verify `/api/likes` routes are registered in server.js
- Check browser console for errors
- Verify authentication token is valid

### Comments not loading
- Check database migration ran successfully
- Verify `/api/comments` routes are registered
- Check that users table exists with username column
- Verify CORS settings allow requests

### Cannot post comments
- Verify user is authenticated (check localStorage for token)
- Check comment text length (1-2000 characters)
- Verify network request completes successfully
- Check backend logs for errors

## Performance Considerations

### Database Optimization
- Indexes on content_type, content_id for fast lookups
- Indexes on user_id for user-specific queries
- Views for aggregated counts reduce query complexity

### Frontend Optimization
- Comments lazy-load when section is expanded
- Optimistic updates reduce perceived latency
- Component memoization prevents unnecessary re-renders

### Caching Strategy
- Like counts cached in component state
- Comments cached until page refresh
- Consider adding Redis cache for high-traffic content

## Conclusion

The like and comment feature provides modern social engagement capabilities to CediStream, allowing users to interact with content and creators in meaningful ways. The implementation follows best practices for security, performance, and user experience.
