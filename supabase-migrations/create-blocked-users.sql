CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blocked_users_no_self_block CHECK (blocker_id <> blocked_id),
  CONSTRAINT blocked_users_unique_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS blocked_users_blocker_idx ON public.blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON public.blocked_users (blocked_id);

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



