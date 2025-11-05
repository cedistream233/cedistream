-- Add likes and comments functionality for all content types (videos, albums, songs)

-- Likes table - supports likes on videos, albums, and songs
CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('video', 'album', 'song')),
    content_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure a user can only like a piece of content once
    UNIQUE(user_id, content_type, content_id)
);

-- Comments table - supports comments on videos, albums, and songs
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('video', 'album', 'song')),
    content_id UUID NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For nested replies
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Prevent empty comments
    CHECK (LENGTH(TRIM(comment_text)) > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_likes_content ON likes(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_content ON comments(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Likes for comments
CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_created_at ON comment_likes(created_at DESC);

-- Create trigger for updated_at on comments
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at 
BEFORE UPDATE ON comments 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Create a view to get like counts per content
CREATE OR REPLACE VIEW content_like_counts AS
SELECT 
    content_type,
    content_id,
    COUNT(*) as like_count
FROM likes
GROUP BY content_type, content_id;

-- Create a view to get comment counts per content
CREATE OR REPLACE VIEW content_comment_counts AS
SELECT 
    content_type,
    content_id,
    COUNT(*) as comment_count
FROM comments
GROUP BY content_type, content_id;
