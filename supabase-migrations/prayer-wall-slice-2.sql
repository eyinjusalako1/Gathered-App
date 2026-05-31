-- ─────────────────────────────────────────────────────────────────────────────
-- Prayer Wall — Slice 2: group walls + comments + updated INSERT policy
--
-- Run in Supabase SQL editor in chunks. Each chunk is safe to stop between.
-- Chunk boundaries are marked: ── CHUNK N ──
-- Prerequisites: add-prayer-wall.sql (Slice 1) must already be applied.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── CHUNK 1: prayer_comments table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prayer_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_id  UUID        NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chronological fetch per prayer (primary read path)
CREATE INDEX IF NOT EXISTS prayer_comments_prayer_created_idx
  ON public.prayer_comments (prayer_id, created_at DESC);
-- Supports cascade deletes and user-scoped queries
CREATE INDEX IF NOT EXISTS prayer_comments_user_id_idx
  ON public.prayer_comments (user_id);


-- ── CHUNK 2: update INSERT policy on prayer_requests ─────────────────────────
-- Slice 1 restricted inserts to global-only (group_id IS NULL).
-- Slice 2 relaxes this: also allow group posts where the author is an active member.
-- user_id = auth.uid() is always required.

DROP POLICY IF EXISTS "prayer_requests_insert" ON public.prayer_requests;

CREATE POLICY "prayer_requests_insert"
  ON public.prayer_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = prayer_requests.group_id
          AND gm.user_id  = auth.uid()
          AND gm.status   = 'active'
      )
    )
  );


-- ── CHUNK 3: RLS for prayer_comments ─────────────────────────────────────────

ALTER TABLE public.prayer_comments ENABLE ROW LEVEL SECURITY;

-- A user can read a comment if they can see the parent prayer.
-- WHY: uses same EXISTS shape as prayer_interactions SELECT so the visibility
-- rules stay in one place (prayer_requests) rather than being re-derived here.
CREATE POLICY "prayer_comments_select"
  ON public.prayer_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prayer_requests pr
      WHERE pr.id = prayer_comments.prayer_id
        AND (
          pr.group_id IS NULL
          OR EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = pr.group_id
              AND gm.user_id  = auth.uid()
              AND gm.status   = 'active'
          )
        )
    )
  );

-- Comments are only allowed on group prayers and only by active members.
-- WHY group_id IS NOT NULL: no comments on the global wall — group = accountability context.
CREATE POLICY "prayer_comments_insert"
  ON public.prayer_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM prayer_requests pr
      WHERE pr.id = prayer_comments.prayer_id
        AND pr.group_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM group_memberships gm
          WHERE gm.group_id = pr.group_id
            AND gm.user_id  = auth.uid()
            AND gm.status   = 'active'
        )
    )
  );

CREATE POLICY "prayer_comments_delete"
  ON public.prayer_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ── CHUNK 4: RPC — get_group_prayer_wall ─────────────────────────────────────
-- Returns prayers for a specific group wall. Verifies membership server-side —
-- non-members get an empty result set, not an error.
-- Same return shape as get_global_prayer_wall plus comment_count.

CREATE OR REPLACE FUNCTION get_group_prayer_wall(
  p_user_id  UUID,
  p_group_id UUID,
  p_status   TEXT DEFAULT 'praying'
)
RETURNS TABLE (
  id            UUID,
  content       TEXT,
  category      TEXT,
  is_anonymous  BOOLEAN,
  status        TEXT,
  prayed_count  INTEGER,
  created_at    TIMESTAMPTZ,
  answered_at   TIMESTAMPTZ,
  author_name   TEXT,
  author_avatar TEXT,
  has_prayed    BOOLEAN,
  is_own        BOOLEAN,
  comment_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    pr.id,
    pr.content,
    pr.category,
    pr.is_anonymous,
    pr.status,
    pr.prayed_count,
    pr.created_at,
    pr.answered_at,
    CASE WHEN pr.is_anonymous THEN NULL
         ELSE COALESCE(up.name, split_part(up.email, '@', 1), 'Unknown User')
    END                                                              AS author_name,
    CASE WHEN pr.is_anonymous THEN NULL
         ELSE up.avatar_url
    END                                                              AS author_avatar,
    EXISTS (
      SELECT 1 FROM prayer_interactions pi
      WHERE  pi.prayer_id = pr.id
        AND  pi.user_id   = p_user_id
    )                                                                AS has_prayed,
    pr.user_id = p_user_id                                           AS is_own,
    COALESCE(cc.cnt, 0)                                              AS comment_count
  FROM  prayer_requests pr
  LEFT JOIN user_profiles up ON up.id = pr.user_id
  LEFT JOIN (
    SELECT prayer_id, COUNT(*)::INTEGER AS cnt
    FROM   prayer_comments
    GROUP  BY prayer_id
  ) cc ON cc.prayer_id = pr.id
  WHERE pr.group_id = p_group_id
    AND pr.status   = p_status
    -- Membership guard: returns empty set for non-members without revealing data
    AND EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = p_group_id
        AND gm.user_id  = p_user_id
        AND gm.status   = 'active'
    )
  ORDER BY pr.created_at DESC
$$;


-- ── CHUNK 5: RPC — get_prayer_comments ───────────────────────────────────────
-- Returns all comments for a prayer in chronological order (oldest first).
-- Returns empty if the caller cannot see the parent prayer.
-- author_name uses split_part(email, '@', 1) to show username only — same chain
-- as the group chat message RPCs in this project.

CREATE OR REPLACE FUNCTION get_prayer_comments(
  p_user_id   UUID,
  p_prayer_id UUID
)
RETURNS TABLE (
  id            UUID,
  content       TEXT,
  created_at    TIMESTAMPTZ,
  author_name   TEXT,
  author_avatar TEXT,
  is_own        BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    pc.id,
    pc.content,
    pc.created_at,
    COALESCE(up.name, split_part(up.email, '@', 1), 'Unknown User') AS author_name,
    up.avatar_url                                                    AS author_avatar,
    pc.user_id = p_user_id                                          AS is_own
  FROM  prayer_comments pc
  LEFT JOIN user_profiles up ON up.id = pc.user_id
  WHERE pc.prayer_id = p_prayer_id
    -- Visibility guard: same shape as the prayer_interactions SELECT policy
    AND EXISTS (
      SELECT 1 FROM prayer_requests pr
      WHERE pr.id = p_prayer_id
        AND (
          pr.group_id IS NULL
          OR EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = pr.group_id
              AND gm.user_id  = p_user_id
              AND gm.status   = 'active'
          )
        )
    )
  ORDER BY pc.created_at ASC
$$;


-- ── CHUNK 6: add comment_count to get_global_prayer_wall ─────────────────────
-- Comments are group-only, so global prayers always return 0.
-- Field added so the client interface is uniform — no code branching on wall type.

CREATE OR REPLACE FUNCTION get_global_prayer_wall(
  p_user_id UUID,
  p_status  TEXT DEFAULT 'praying'
)
RETURNS TABLE (
  id            UUID,
  content       TEXT,
  category      TEXT,
  is_anonymous  BOOLEAN,
  status        TEXT,
  prayed_count  INTEGER,
  created_at    TIMESTAMPTZ,
  answered_at   TIMESTAMPTZ,
  author_name   TEXT,
  author_avatar TEXT,
  has_prayed    BOOLEAN,
  is_own        BOOLEAN,
  comment_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    pr.id,
    pr.content,
    pr.category,
    pr.is_anonymous,
    pr.status,
    pr.prayed_count,
    pr.created_at,
    pr.answered_at,
    CASE WHEN pr.is_anonymous THEN NULL
         ELSE COALESCE(up.name, split_part(up.email, '@', 1), 'Unknown User')
    END                                                    AS author_name,
    CASE WHEN pr.is_anonymous THEN NULL
         ELSE up.avatar_url
    END                                                    AS author_avatar,
    EXISTS (
      SELECT 1 FROM prayer_interactions pi
      WHERE  pi.prayer_id = pr.id
        AND  pi.user_id   = p_user_id
    )                                                      AS has_prayed,
    pr.user_id = p_user_id                                 AS is_own,
    0                                                      AS comment_count
  FROM  prayer_requests pr
  LEFT JOIN user_profiles up ON up.id = pr.user_id
  WHERE pr.group_id IS NULL
    AND pr.status   = p_status
  ORDER BY pr.created_at DESC
$$;
