-- Add storage_path column to promotions for exact storage deletion
ALTER TABLE IF EXISTS promotions
  ADD COLUMN IF NOT EXISTS storage_path TEXT;
