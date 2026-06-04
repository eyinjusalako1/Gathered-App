-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: alter-group-memberships-not-null.sql
-- Date: 2026-06-04
--
-- WHY: group_memberships.group_id and group_memberships.user_id were created
-- as nullable columns, most likely because the table was created directly in
-- the Supabase dashboard rather than through a migration. For a junction table
-- these columns are semantically required — a membership row without a group or
-- a user is meaningless and should never exist.
--
-- WHAT: Sets NOT NULL on both columns. Safe to apply because a pre-flight
-- query confirmed zero existing rows have NULL in either column (verified
-- 2026-06-04 before applying).
--
-- PREREQUISITES: group_memberships table must exist.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE group_memberships ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE group_memberships ALTER COLUMN user_id SET NOT NULL;
