-- Create songs table and extend purchases to allow 'song' item_type

-- Ensure UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cover_image TEXT,
    audio_url TEXT,
    duration VARCHAR(20),
    release_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_album_id ON songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_user_id ON songs(user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_songs_updated_at ON songs;
CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Extend purchases item_type to include 'song'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'purchases_item_type_check'
  ) THEN
    ALTER TABLE purchases DROP CONSTRAINT purchases_item_type_check;
  END IF;
END $$;

ALTER TABLE purchases ADD CONSTRAINT purchases_item_type_check CHECK (item_type IN ('album','video','song'));
