-- Add edited_at to group_chat_messages
ALTER TABLE group_chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL;

-- Allow members to UPDATE their own group messages
CREATE POLICY "Users can edit their own group messages"
ON group_chat_messages
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add metadata + edited_at to dm_messages (metadata already used for reply_to)
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS metadata JSONB NULL;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL;

-- Allow users to UPDATE their own DM messages
CREATE POLICY "Users can edit their own DM messages"
ON public.dm_messages
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
