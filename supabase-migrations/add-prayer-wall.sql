-- ─────────────────────────────────────────────────────────────────────────────
-- Prayer Wall — Slice 1 foundation
--
-- Run in Supabase SQL editor in chunks. Each chunk is safe to stop between.
-- Chunk boundaries are marked: ── CHUNK N ──
-- ─────────────────────────────────────────────────────────────────────────────


-- ── CHUNK 1: Tables + indexes ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id     UUID        REFERENCES fellowship_groups(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  category     TEXT        CHECK (category IN ('for_someone_else', 'for_myself', 'praise_report')),
  is_anonymous BOOLEAN     NOT NULL DEFAULT FALSE,
  status       TEXT        NOT NULL DEFAULT 'praying' CHECK (status IN ('praying', 'answered')),
  prayed_count INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at  TIMESTAMPTZ
);

-- Supports group wall queries (Slice 2) and global status-filtered queries
CREATE INDEX IF NOT EXISTS prayer_requests_group_created_idx
  ON public.prayer_requests (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prayer_requests_status_created_idx
  ON public.prayer_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS prayer_requests_user_id_idx
  ON public.prayer_requests (user_id);

CREATE TABLE IF NOT EXISTS public.prayer_interactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_id  UUID        NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prayer_id, user_id)
);

CREATE INDEX IF NOT EXISTS prayer_interactions_prayer_id_idx
  ON public.prayer_interactions (prayer_id);
CREATE INDEX IF NOT EXISTS prayer_interactions_user_id_idx
  ON public.prayer_interactions (user_id);


-- ── CHUNK 2: RLS policies ─────────────────────────────────────────────────────

ALTER TABLE public.prayer_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_interactions ENABLE ROW LEVEL SECURITY;

-- prayer_requests ─────────────────────────────────────────────────────────────

-- Global prayers are visible to all authenticated users.
-- Group prayers are visible only to active members of that group.
-- WHY: policy is written correctly for Slice 2 now so no refactor is needed later.
CREATE POLICY "prayer_requests_select"
  ON public.prayer_requests FOR SELECT
  TO authenticated
  USING (
    group_id IS NULL
    OR EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = prayer_requests.group_id
        AND gm.user_id  = auth.uid()
        AND gm.status   = 'active'
    )
  );

-- Slice 1: global only (group_id must be NULL). Slice 2 will relax this.
CREATE POLICY "prayer_requests_insert"
  ON public.prayer_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND group_id IS NULL);

-- Author-only updates. Column-level restrictions enforced by trigger (chunk 4).
CREATE POLICY "prayer_requests_update"
  ON public.prayer_requests FOR UPDATE
  TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prayer_requests_delete"
  ON public.prayer_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- prayer_interactions ─────────────────────────────────────────────────────────

-- A user can read interactions on any prayer they are allowed to see.
CREATE POLICY "prayer_interactions_select"
  ON public.prayer_interactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prayer_requests pr
      WHERE pr.id = prayer_interactions.prayer_id
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

CREATE POLICY "prayer_interactions_insert"
  ON public.prayer_interactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prayer_interactions_delete"
  ON public.prayer_interactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ── CHUNK 3: prayed_count trigger ─────────────────────────────────────────────
-- Keeps the denormalised counter accurate after any INSERT or DELETE on
-- prayer_interactions — including deletes from cascading or other paths.

CREATE OR REPLACE FUNCTION sync_prayed_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE prayer_requests
       SET prayed_count = prayed_count + 1
     WHERE id = NEW.prayer_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- GREATEST guards against prayed_count going negative via concurrent deletes
    UPDATE prayer_requests
       SET prayed_count = GREATEST(prayed_count - 1, 0)
     WHERE id = OLD.prayer_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_prayed_count_trigger ON public.prayer_interactions;
CREATE TRIGGER sync_prayed_count_trigger
  AFTER INSERT OR DELETE ON public.prayer_interactions
  FOR EACH ROW EXECUTE FUNCTION sync_prayed_count();


-- ── CHUNK 4: update guard trigger ─────────────────────────────────────────────
-- Prevents authors from rewriting content or flipping anonymity after posting.
-- Also auto-sets answered_at when status flips to 'answered'.

CREATE OR REPLACE FUNCTION guard_prayer_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content      IS DISTINCT FROM OLD.content      THEN
    RAISE EXCEPTION 'Prayer content cannot be edited after posting.';
  END IF;
  IF NEW.is_anonymous IS DISTINCT FROM OLD.is_anonymous THEN
    RAISE EXCEPTION 'Anonymity cannot be changed after posting.';
  END IF;
  IF NEW.user_id      IS DISTINCT FROM OLD.user_id      THEN
    RAISE EXCEPTION 'Prayer author cannot be changed.';
  END IF;
  IF NEW.group_id     IS DISTINCT FROM OLD.group_id     THEN
    RAISE EXCEPTION 'Prayer group cannot be changed.';
  END IF;

  -- Auto-manage answered_at to match status
  IF NEW.status = 'answered' AND OLD.status != 'answered' THEN
    NEW.answered_at := NOW();
  END IF;
  IF NEW.status = 'praying' AND OLD.status = 'answered' THEN
    NEW.answered_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_prayer_request_update_trigger ON public.prayer_requests;
CREATE TRIGGER guard_prayer_request_update_trigger
  BEFORE UPDATE ON public.prayer_requests
  FOR EACH ROW EXECUTE FUNCTION guard_prayer_request_update();


-- ── CHUNK 5: RPC — get_global_prayer_wall ─────────────────────────────────────
-- The only way clients read prayers. Enforces anonymity server-side so it cannot
-- be bypassed via browser DevTools — anonymous user_id is never returned.

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
  is_own        BOOLEAN
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
         ELSE COALESCE(up.name, up.email, au.email, 'Unknown User')
    END                                                    AS author_name,
    CASE WHEN pr.is_anonymous THEN NULL
         ELSE up.avatar_url
    END                                                    AS author_avatar,
    EXISTS (
      SELECT 1 FROM prayer_interactions pi
      WHERE  pi.prayer_id = pr.id
        AND  pi.user_id   = p_user_id
    )                                                      AS has_prayed,
    pr.user_id = p_user_id                                 AS is_own
  FROM  prayer_requests pr
  LEFT JOIN user_profiles up ON up.id = pr.user_id
  LEFT JOIN auth.users    au ON au.id = pr.user_id
  WHERE pr.group_id IS NULL
    AND pr.status   = p_status
  ORDER BY pr.created_at DESC
$$;


-- ── CHUNK 6: RPC — toggle_prayer_interaction ──────────────────────────────────
-- Inserts or deletes an interaction atomically and returns the new count.
-- SECURITY DEFINER so the prayed_count trigger fires under the function owner's
-- privileges, avoiding permission issues on the denormalised counter update.

CREATE OR REPLACE FUNCTION toggle_prayer_interaction(p_prayer_id UUID)
RETURNS TABLE (prayed_count INTEGER, has_prayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   UUID    := auth.uid();
  v_existed   BOOLEAN;
  v_new_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM prayer_interactions
    WHERE prayer_id = p_prayer_id AND user_id = v_user_id
  ) INTO v_existed;

  IF v_existed THEN
    DELETE FROM prayer_interactions
    WHERE prayer_id = p_prayer_id AND user_id = v_user_id;
  ELSE
    -- ON CONFLICT DO NOTHING guards against a concurrent double-tap race
    INSERT INTO prayer_interactions (prayer_id, user_id)
    VALUES (p_prayer_id, v_user_id)
    ON CONFLICT (prayer_id, user_id) DO NOTHING;
  END IF;

  -- Re-read after trigger has fired so the count is authoritative
  SELECT pr.prayed_count INTO v_new_count
  FROM   prayer_requests pr
  WHERE  pr.id = p_prayer_id;

  RETURN QUERY SELECT v_new_count, NOT v_existed;
END;
$$;
