-- Safely add purchases.user_email and backfill in both directions when possible
-- This script is idempotent and guarded for environments with differing schemas

-- 1) Ensure column exists (no error if already present)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2) Helpful index for lookups by email
CREATE INDEX IF NOT EXISTS idx_purchases_user_email ON purchases(user_email);

-- 3) Backfill user_email from users when purchases.user_id is present
--    And backfill user_id from users when purchases.user_email is present (optional normalization)
DO $$
DECLARE
  has_users_table BOOLEAN := FALSE;
  has_users_email BOOLEAN := FALSE;
  has_purchases_user_id BOOLEAN := FALSE;
  has_purchases_user_email BOOLEAN := FALSE;
BEGIN
  -- Detect presence of users table and relevant columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_name = 'users' AND t.table_schema = 'public'
  ) INTO has_users_table;

  IF has_users_table THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_name = 'users' AND c.table_schema = 'public' AND c.column_name = 'email'
    ) INTO has_users_email;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = 'purchases' AND c.table_schema = 'public' AND c.column_name = 'user_id'
  ) INTO has_purchases_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = 'purchases' AND c.table_schema = 'public' AND c.column_name = 'user_email'
  ) INTO has_purchases_user_email;

  -- Backfill purchases.user_email from users.email when user_id is present
  IF has_users_table AND has_users_email AND has_purchases_user_id AND has_purchases_user_email THEN
    UPDATE purchases p
    SET user_email = u.email
    FROM users u
    WHERE p.user_id = u.id
      AND (p.user_email IS NULL OR length(trim(p.user_email)) = 0);
  END IF;

  -- Optionally backfill purchases.user_id from users.id when only email exists
  IF has_users_table AND has_users_email AND has_purchases_user_id AND has_purchases_user_email THEN
    UPDATE purchases p
    SET user_id = u.id
    FROM users u
    WHERE p.user_id IS NULL
      AND p.user_email IS NOT NULL
      AND length(trim(p.user_email)) > 0
      AND lower(u.email) = lower(p.user_email);
  END IF;
END $$;
