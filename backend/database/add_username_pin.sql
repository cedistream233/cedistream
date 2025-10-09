-- Migration: Add username and PIN (hashed) to users table

-- Add username column (nullable initially to avoid failing on existing rows)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- Ensure usernames are unique
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_username_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
END $$;

-- Add pin_hash column for storing hashed 4-digit PIN
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);

-- Note: We intentionally keep username nullable to avoid breaking existing rows.
-- New signups will be required to provide a username; existing users can set one later.
