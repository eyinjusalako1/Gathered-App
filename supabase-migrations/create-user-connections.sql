-- Create user_connections table for People Discovery
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id),
  CHECK (requester_id != recipient_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_connections_requester 
ON user_connections(requester_id, status);

CREATE INDEX IF NOT EXISTS idx_user_connections_recipient 
ON user_connections(recipient_id, status);

CREATE INDEX IF NOT EXISTS idx_user_connections_status 
ON user_connections(status);

-- Create index for finding connections between two users
CREATE INDEX IF NOT EXISTS idx_user_connections_both_users 
ON user_connections(requester_id, recipient_id);

-- Enable RLS
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Users can view connections where they are requester or recipient
CREATE POLICY "Users can view their connections"
ON user_connections
FOR SELECT
TO authenticated
USING (
  requester_id = auth.uid() OR recipient_id = auth.uid()
);

-- RLS Policy 2: Users can create connection requests (as requester)
CREATE POLICY "Users can create connection requests"
ON user_connections
FOR INSERT
TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'pending'
);

-- RLS Policy 3: Recipients can update status to accepted/rejected
CREATE POLICY "Recipients can respond to connection requests"
ON user_connections
FOR UPDATE
TO authenticated
USING (
  recipient_id = auth.uid()
  AND status = 'pending'
)
WITH CHECK (
  recipient_id = auth.uid()
  AND status IN ('accepted', 'rejected')
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_connections_updated_at
BEFORE UPDATE ON user_connections
FOR EACH ROW
EXECUTE FUNCTION update_user_connections_updated_at();





