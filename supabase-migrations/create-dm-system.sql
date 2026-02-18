-- Create Direct Message (DM) System Tables
-- This migration creates tables for 1:1 private messaging between connected users

-- ============================================
-- DM THREADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dm_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DM THREAD MEMBERS TABLE (Junction Table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.dm_thread_members (
  thread_id UUID REFERENCES public.dm_threads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

-- ============================================
-- DM MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES public.dm_threads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dm_thread_members_thread_id ON public.dm_thread_members(thread_id);
CREATE INDEX IF NOT EXISTS idx_dm_thread_members_user_id ON public.dm_thread_members(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_thread_id ON public.dm_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_created_at ON public.dm_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_threads_updated_at ON public.dm_threads(updated_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DM THREADS POLICIES
-- ============================================

-- Users can SELECT threads only if they are a member
CREATE POLICY "Users can view threads they are members of"
  ON public.dm_threads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_thread_members
      WHERE dm_thread_members.thread_id = dm_threads.id
      AND dm_thread_members.user_id = auth.uid()
    )
  );

-- Users can INSERT threads (will be used when creating new DM)
CREATE POLICY "Users can create threads"
  ON public.dm_threads
  FOR INSERT
  WITH CHECK (true); -- Thread creation is controlled via API logic

-- ============================================
-- DM THREAD MEMBERS POLICIES
-- ============================================

-- Users can SELECT members of threads they belong to
CREATE POLICY "Users can view members of their threads"
  ON public.dm_thread_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.dm_thread_members dtm2
      WHERE dtm2.thread_id = dm_thread_members.thread_id
      AND dtm2.user_id = auth.uid()
    )
  );

-- Users can INSERT members (controlled via API)
CREATE POLICY "Users can add members to threads"
  ON public.dm_thread_members
  FOR INSERT
  WITH CHECK (true); -- Membership creation is controlled via API logic

-- ============================================
-- DM MESSAGES POLICIES
-- ============================================

-- Users can SELECT messages only if they are a member of the thread
CREATE POLICY "Users can view messages in their threads"
  ON public.dm_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_thread_members
      WHERE dm_thread_members.thread_id = dm_messages.thread_id
      AND dm_thread_members.user_id = auth.uid()
    )
  );

-- Users can INSERT messages only if:
-- 1. user_id = auth.uid() (they are the sender)
-- 2. They are a member of the thread
CREATE POLICY "Users can send messages in their threads"
  ON public.dm_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dm_thread_members
      WHERE dm_thread_members.thread_id = dm_messages.thread_id
      AND dm_thread_members.user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGER: Update thread updated_at on new message
-- ============================================
CREATE OR REPLACE FUNCTION public.update_dm_thread_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.dm_threads
  SET updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dm_thread_updated_at_trigger
AFTER INSERT ON public.dm_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_dm_thread_updated_at();





