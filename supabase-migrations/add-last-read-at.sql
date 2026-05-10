-- ─────────────────────────────────────────────────────────────────────────────
-- Unread count infrastructure
--
-- Strategy: derived counting. No counter columns to keep in sync —
-- unread = COUNT(messages WHERE created_at > last_read_at AND sender != me).
-- NULL last_read_at means "never opened" → every message is unread.
-- We do NOT backfill existing rows; NULL is the correct initial state.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE group_memberships
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

ALTER TABLE dm_thread_members
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;


-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_group_chat_list
--
-- Returns one row per active group membership with the last message and
-- the unread count for that group. Replaces the N+1 pattern in chat/page.tsx
-- (getUserJoinedGroups + one fetch per group).
--
-- WHY SECURITY DEFINER: the function is called from API routes using the
-- service role, but marking it DEFINER means it could also be called safely
-- from the client JWT context — the p_user_id parameter acts as the guard.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_group_chat_list(p_user_id UUID)
RETURNS TABLE (
  group_id                 UUID,
  group_name               TEXT,
  member_count             BIGINT,
  last_message_text        TEXT,
  last_message_at          TIMESTAMPTZ,
  last_message_sender_name TEXT,
  last_message_type        TEXT,
  last_message_metadata    JSONB,
  unread_count             BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH my_groups AS (
    -- All groups this user is an active member of, with their read cursor
    SELECT gm.group_id, gm.last_read_at
    FROM   group_memberships gm
    WHERE  gm.user_id = p_user_id
      AND  gm.status  = 'active'
  ),
  member_counts AS (
    SELECT gm.group_id, COUNT(*) AS cnt
    FROM   group_memberships gm
    WHERE  gm.group_id IN (SELECT group_id FROM my_groups)
      AND  gm.status = 'active'
    GROUP BY gm.group_id
  ),
  last_msgs AS (
    -- One row per group: the most recent message, including type + metadata
    -- for devotion share preview reconstruction on the client.
    SELECT DISTINCT ON (gcm.group_id)
      gcm.group_id,
      gcm.content    AS content,
      gcm.created_at AS created_at,
      gcm.user_id    AS sender_id,
      gcm.type       AS type,
      gcm.metadata   AS metadata
    FROM  group_chat_messages gcm
    WHERE gcm.group_id IN (SELECT group_id FROM my_groups)
    ORDER BY gcm.group_id, gcm.created_at DESC
  ),
  unread AS (
    -- Messages after the read cursor, sent by others
    SELECT  gcm.group_id,
            COUNT(*) AS cnt
    FROM    group_chat_messages gcm
    JOIN    my_groups mg ON mg.group_id = gcm.group_id
    WHERE   gcm.user_id  != p_user_id
      AND   gcm.created_at > COALESCE(mg.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY gcm.group_id
  )
  SELECT
    fg.id                       AS group_id,
    fg.name                     AS group_name,
    COALESCE(mc.cnt, 0)         AS member_count,
    lm.content                  AS last_message_text,
    lm.created_at               AS last_message_at,
    up.name                     AS last_message_sender_name,
    lm.type                     AS last_message_type,
    lm.metadata                 AS last_message_metadata,
    COALESCE(u.cnt, 0)          AS unread_count
  FROM    my_groups mg
  JOIN    fellowship_groups fg  ON fg.id = mg.group_id
  LEFT JOIN member_counts mc    ON mc.group_id = fg.id
  LEFT JOIN last_msgs lm        ON lm.group_id = fg.id
  LEFT JOIN user_profiles up    ON up.id = lm.sender_id
  LEFT JOIN unread u            ON u.group_id = fg.id
  ORDER BY COALESCE(lm.created_at, '1970-01-01'::timestamptz) DESC
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_dm_chat_list
--
-- Same shape as get_group_chat_list but for DM threads.
-- Replaces the 4-round-trip implementation in /api/chat/dm/threads.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dm_chat_list(p_user_id UUID)
RETURNS TABLE (
  thread_id              UUID,
  other_user_id          UUID,
  other_user_name        TEXT,
  other_user_avatar      TEXT,
  last_message_text      TEXT,
  last_message_at        TIMESTAMPTZ,
  last_message_sender_id UUID,
  unread_count           BIGINT,
  updated_at             TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH my_threads AS (
    SELECT dtm.thread_id, dtm.last_read_at
    FROM   dm_thread_members dtm
    WHERE  dtm.user_id = p_user_id
  ),
  other_members AS (
    SELECT DISTINCT ON (dtm.thread_id)
      dtm.thread_id,
      dtm.user_id AS other_user_id
    FROM  dm_thread_members dtm
    WHERE dtm.thread_id IN (SELECT thread_id FROM my_threads)
      AND dtm.user_id != p_user_id
  ),
  last_msgs AS (
    SELECT DISTINCT ON (dm.thread_id)
      dm.thread_id,
      dm.content    AS content,
      dm.created_at AS created_at,
      dm.user_id    AS sender_id
    FROM  dm_messages dm
    WHERE dm.thread_id IN (SELECT thread_id FROM my_threads)
    ORDER BY dm.thread_id, dm.created_at DESC
  ),
  unread AS (
    SELECT  dm.thread_id,
            COUNT(*) AS cnt
    FROM    dm_messages dm
    JOIN    my_threads mt ON mt.thread_id = dm.thread_id
    WHERE   dm.user_id  != p_user_id
      AND   dm.created_at > COALESCE(mt.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY dm.thread_id
  )
  SELECT
    dt.id                       AS thread_id,
    om.other_user_id,
    up.name                     AS other_user_name,
    up.avatar_url               AS other_user_avatar,
    lm.content                  AS last_message_text,
    lm.created_at               AS last_message_at,
    lm.sender_id                AS last_message_sender_id,
    COALESCE(u.cnt, 0)          AS unread_count,
    dt.updated_at
  FROM    my_threads mt
  JOIN    dm_threads dt         ON dt.id = mt.thread_id
  LEFT JOIN other_members om    ON om.thread_id = mt.thread_id
  LEFT JOIN user_profiles up    ON up.id = om.other_user_id
  LEFT JOIN last_msgs lm        ON lm.thread_id = mt.thread_id
  LEFT JOIN unread u            ON u.thread_id = mt.thread_id
  ORDER BY COALESCE(lm.created_at, '1970-01-01'::timestamptz) DESC
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_total_unread_count
--
-- Single integer: sum of unread messages across all groups + DMs.
-- Used by the bottom nav badge. Designed to be cheap — one index scan per
-- junction table, one aggregation pass. Called every 30 s from the client.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_total_unread_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE((
    SELECT SUM(cnt)::INTEGER
    FROM (
      -- Unread group messages, aggregated per group then summed
      SELECT COUNT(*) AS cnt
      FROM   group_chat_messages gcm
      JOIN   group_memberships gm ON gm.group_id = gcm.group_id
      WHERE  gm.user_id   = p_user_id
        AND  gm.status    = 'active'
        AND  gcm.user_id != p_user_id
        AND  gcm.created_at > COALESCE(gm.last_read_at, '1970-01-01'::timestamptz)
      GROUP BY gcm.group_id

      UNION ALL

      -- Unread DM messages, aggregated per thread then summed
      SELECT COUNT(*) AS cnt
      FROM   dm_messages dm
      JOIN   dm_thread_members dtm ON dtm.thread_id = dm.thread_id
      WHERE  dtm.user_id  = p_user_id
        AND  dm.user_id  != p_user_id
        AND  dm.created_at > COALESCE(dtm.last_read_at, '1970-01-01'::timestamptz)
      GROUP BY dm.thread_id
    ) counts
  ), 0)
$$;
