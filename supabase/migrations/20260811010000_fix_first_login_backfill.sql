ALTER TABLE profiles
  ALTER COLUMN is_first_logged_in SET DEFAULT true;

UPDATE profiles
SET is_first_logged_in = false
WHERE created_at < TIMESTAMPTZ '2026-08-11 00:00:00+00';
