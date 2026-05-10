-- ─────────────────────────────────────────────────────────────────────────────
-- Fix null names in chat list RPCs
--
-- Both get_group_chat_list and get_dm_chat_list previously returned raw
-- up.name, which is NULL for ~22% of existing rows. The client crashed on
-- .charAt(0) at render time. COALESCE here keeps nulls off the wire entirely.
-- Fallback chain: name → email → 'Unknown User'.
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
    SELECT  gcm.group_id,
            COUNT(*) AS cnt
    FROM    group_chat_messages gcm
    JOIN    my_groups mg ON mg.group_id = gcm.group_id
    WHERE   gcm.user_id  != p_user_id
      AND   gcm.created_at > COALESCE(mg.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY gcm.group_id
  )
  SELECT
    fg.id                                               AS group_id,
    fg.name                                             AS group_name,
    COALESCE(mc.cnt, 0)                                 AS member_count,
    lm.content                                          AS last_message_text,
    lm.created_at                                       AS last_message_at,
    COALESCE(up.name, up.email, 'Unknown User')         AS last_message_sender_name,
    lm.type                                             AS last_message_type,
    lm.metadata                                         AS last_message_metadata,
    COALESCE(u.cnt, 0)                                  AS unread_count
  FROM    my_groups mg
  JOIN    fellowship_groups fg  ON fg.id = mg.group_id
  LEFT JOIN member_counts mc    ON mc.group_id = fg.id
  LEFT JOIN last_msgs lm        ON lm.group_id = fg.id
  LEFT JOIN user_profiles up    ON up.id = lm.sender_id
  LEFT JOIN unread u            ON u.group_id = fg.id
  ORDER BY COALESCE(lm.created_at, '1970-01-01'::timestamptz) DESC
$$;


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
    dt.id                                               AS thread_id,
    om.other_user_id,
    COALESCE(up.name, up.email, 'Unknown User')         AS other_user_name,
    up.avatar_url                                       AS other_user_avatar,
    lm.content                                          AS last_message_text,
    lm.created_at                                       AS last_message_at,
    lm.sender_id                                        AS last_message_sender_id,
    COALESCE(u.cnt, 0)                                  AS unread_count,
    dt.updated_at
  FROM    my_threads mt
  JOIN    dm_threads dt         ON dt.id = mt.thread_id
  LEFT JOIN other_members om    ON om.thread_id = mt.thread_id
  LEFT JOIN user_profiles up    ON up.id = om.other_user_id
  LEFT JOIN last_msgs lm        ON lm.thread_id = mt.thread_id
  LEFT JOIN unread u            ON u.thread_id = mt.thread_id
  ORDER BY COALESCE(lm.created_at, '1970-01-01'::timestamptz) DESC
$$;
