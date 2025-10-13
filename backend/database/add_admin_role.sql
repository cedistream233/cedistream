-- Migration: allow 'admin' in users.role and ensure constraint exists

-- Drop existing role check constraint if present (no DO $$ block to avoid splitter issues)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Recreate role check to include admin
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('creator','supporter','admin'));
