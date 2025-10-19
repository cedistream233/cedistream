-- Add a deterministic storage for uploaded profile image path/object name so we can delete it
ALTER TABLE users
  ADD COLUMN profile_image_path TEXT;

-- Optionally index if you plan to query by path (not necessary now)
-- CREATE INDEX idx_users_profile_image_path ON users(profile_image_path);
