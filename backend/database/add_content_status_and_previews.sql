-- Add publish status and preview support for albums, videos, and songs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Albums: status and published_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='albums' AND column_name='status'
  ) THEN
    ALTER TABLE albums ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='albums' AND column_name='published_at'
  ) THEN
    ALTER TABLE albums ADD COLUMN published_at TIMESTAMPTZ;
  END IF;
END $$;

-- Videos: status and published_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='videos' AND column_name='status'
  ) THEN
    ALTER TABLE videos ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='videos' AND column_name='published_at'
  ) THEN
    ALTER TABLE videos ADD COLUMN published_at TIMESTAMPTZ;
  END IF;
END $$;

-- Songs: preview_url and track_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='songs' AND column_name='preview_url'
  ) THEN
    ALTER TABLE songs ADD COLUMN preview_url TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='songs' AND column_name='track_number'
  ) THEN
    ALTER TABLE songs ADD COLUMN track_number INT;
  END IF;
END $$;
