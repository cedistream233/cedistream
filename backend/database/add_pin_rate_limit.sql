-- Migration: Add PIN rate-limiting fields

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_lock_until TIMESTAMPTZ;
