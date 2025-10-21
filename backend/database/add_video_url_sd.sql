-- Add video_url_sd column to videos table for SD variant produced by postprocessing
ALTER TABLE IF EXISTS videos
  ADD COLUMN IF NOT EXISTS video_url_sd TEXT;
