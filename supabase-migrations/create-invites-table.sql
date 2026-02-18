-- Create Invites Table
-- This table stores invite codes for groups and app-wide invites

CREATE TABLE IF NOT EXISTS public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code TEXT UNIQUE NOT NULL,
  inviter_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invite_type TEXT NOT NULL CHECK (invite_type IN ('group', 'app')),
  group_id UUID REFERENCES public.fellowship_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invites_code ON public.invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_invites_inviter ON public.invites(inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_invites_group ON public.invites(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invites_type ON public.invites(invite_type);

-- RLS Policies

-- Inviter can read their own invites
CREATE POLICY "Inviters can view their own invites"
  ON public.invites
  FOR SELECT
  USING (auth.uid() = inviter_user_id);

-- Anyone can read invites by code (for invite landing page)
CREATE POLICY "Anyone can view invites by code"
  ON public.invites
  FOR SELECT
  USING (true); -- Public read access for invite resolution

-- Authenticated users can create invites
CREATE POLICY "Authenticated users can create invites"
  ON public.invites
  FOR INSERT
  WITH CHECK (auth.uid() = inviter_user_id);

-- Only allow updating accepted_at once (via trigger)
CREATE POLICY "Allow updating accepted_at"
  ON public.invites
  FOR UPDATE
  USING (accepted_at IS NULL) -- Only if not already accepted
  WITH CHECK (accepted_at IS NOT NULL AND auth.uid() = accepted_by_user_id);

-- Function to ensure accepted_at can only be set once
CREATE OR REPLACE FUNCTION public.check_invite_not_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been accepted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_double_accept
BEFORE UPDATE ON public.invites
FOR EACH ROW
WHEN (OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at)
EXECUTE FUNCTION public.check_invite_not_accepted();





