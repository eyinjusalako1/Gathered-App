-- Backfill user_profiles.email from auth.users for rows where it was never written.
-- Safe to re-run: the WHERE clause limits to NULL rows only.
UPDATE public.user_profiles up
SET    email = au.email
FROM   auth.users au
WHERE  au.id = up.id
  AND  up.email IS NULL
  AND  au.email IS NOT NULL;
