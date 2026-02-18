-- Align blocked_users schema for forward-only migrations.
-- Safe to run after an existing table was created with older columns.

-- Ensure UUID generator is available for defaults.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure columns exist.
ALTER TABLE public.blocked_users
ADD COLUMN IF NOT EXISTS blocker_id UUID;

ALTER TABLE public.blocked_users
ADD COLUMN IF NOT EXISTS blocked_id UUID;

ALTER TABLE public.blocked_users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Ensure defaults.
ALTER TABLE public.blocked_users
ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.blocked_users
ALTER COLUMN created_at SET DEFAULT NOW();

-- Ensure NOT NULL for core columns.
ALTER TABLE public.blocked_users
ALTER COLUMN blocker_id SET NOT NULL;

ALTER TABLE public.blocked_users
ALTER COLUMN blocked_id SET NOT NULL;

-- Ensure foreign keys (idempotent-ish).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blocked_users_blocker_fkey'
  ) THEN
    ALTER TABLE public.blocked_users
    ADD CONSTRAINT blocked_users_blocker_fkey
    FOREIGN KEY (blocker_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blocked_users_blocked_fkey'
  ) THEN
    ALTER TABLE public.blocked_users
    ADD CONSTRAINT blocked_users_blocked_fkey
    FOREIGN KEY (blocked_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Prevent self-block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blocked_users_no_self_block'
  ) THEN
    ALTER TABLE public.blocked_users
    ADD CONSTRAINT blocked_users_no_self_block CHECK (blocker_id <> blocked_id);
  END IF;
END $$;

-- Ensure unique pair.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blocked_users_unique_pair'
  ) THEN
    ALTER TABLE public.blocked_users
    ADD CONSTRAINT blocked_users_unique_pair UNIQUE (blocker_id, blocked_id);
  END IF;
END $$;

-- Indexes.
CREATE INDEX IF NOT EXISTS blocked_users_blocker_idx ON public.blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON public.blocked_users (blocked_id);

-- RLS + policies.
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Blocker can read own blocks" ON public.blocked_users;
CREATE POLICY "Blocker can read own blocks"
  ON public.blocked_users
  FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Blocker can create blocks" ON public.blocked_users;
CREATE POLICY "Blocker can create blocks"
  ON public.blocked_users
  FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Blocker can delete blocks" ON public.blocked_users;
CREATE POLICY "Blocker can delete blocks"
  ON public.blocked_users
  FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());



