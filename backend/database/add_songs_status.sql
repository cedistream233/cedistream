-- Add status and published_at to songs if missing
DO $$
BEGIN
  IF to_regclass('public.songs') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='songs' AND column_name='status'
    ) THEN
      ALTER TABLE songs ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='songs' AND column_name='published_at'
    ) THEN
      ALTER TABLE songs ADD COLUMN published_at TIMESTAMPTZ;
    END IF;
  END IF;
END $$;
