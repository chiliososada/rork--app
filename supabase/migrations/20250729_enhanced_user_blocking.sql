-- Enhanced User Blocking System
-- 強化されたユーザーブロックシステム

-- 1. Add additional columns to existing user_blocks table
ALTER TABLE public.user_blocks 
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS is_mutual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_blocks_updated_at_trigger ON public.user_blocks;
CREATE TRIGGER user_blocks_updated_at_trigger
  BEFORE UPDATE ON public.user_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_user_blocks_updated_at();

-- 3. Enhanced toggle_block function with reason support
CREATE OR REPLACE FUNCTION toggle_block_with_reason(
  blocker_id_param UUID,
  blocked_id_param UUID,
  reason_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  action TEXT,
  is_blocked BOOLEAN,
  is_mutual BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  existing_block UUID;
  reverse_block UUID;
  mutual_block BOOLEAN := FALSE;
BEGIN
  -- Check for existing block
  SELECT id INTO existing_block
  FROM user_blocks
  WHERE blocker_id = blocker_id_param
    AND blocked_id = blocked_id_param;

  -- Check for reverse block (mutual blocking detection)
  SELECT id INTO reverse_block
  FROM user_blocks
  WHERE blocker_id = blocked_id_param
    AND blocked_id = blocker_id_param;

  IF reverse_block IS NOT NULL THEN
    mutual_block := TRUE;
  END IF;

  IF existing_block IS NOT NULL THEN
    -- Unblock user
    DELETE FROM user_blocks WHERE id = existing_block;
    
    -- Update mutual status on reverse block if exists
    IF reverse_block IS NOT NULL THEN
      UPDATE user_blocks 
      SET is_mutual = FALSE, updated_at = NOW()
      WHERE id = reverse_block;
    END IF;
    
    RETURN QUERY SELECT 'unblocked'::TEXT, FALSE, FALSE;
  ELSE
    -- Block user
    INSERT INTO user_blocks (blocker_id, blocked_id, reason, is_mutual)
    VALUES (blocker_id_param, blocked_id_param, reason_param, mutual_block);

    -- Update mutual status on reverse block if exists
    IF reverse_block IS NOT NULL THEN
      UPDATE user_blocks 
      SET is_mutual = TRUE, updated_at = NOW()
      WHERE id = reverse_block;
    END IF;

    -- Remove follow relationships when blocking
    DELETE FROM user_follows
    WHERE (follower_id = blocker_id_param AND following_id = blocked_id_param)
       OR (follower_id = blocked_id_param AND following_id = blocker_id_param);

    RETURN QUERY SELECT 'blocked'::TEXT, TRUE, mutual_block;
  END IF;
END;
$$;

-- 4. Get blocked users list for a user
CREATE OR REPLACE FUNCTION get_blocked_users(user_id_param UUID)
RETURNS TABLE (
  blocked_user_id UUID,
  blocked_user_name TEXT,
  blocked_user_avatar TEXT,
  reason TEXT,
  is_mutual BOOLEAN,
  blocked_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ub.blocked_id as blocked_user_id,
    u.nickname as blocked_user_name,
    u.avatar_url as blocked_user_avatar,
    ub.reason,
    ub.is_mutual,
    ub.created_at as blocked_at
  FROM user_blocks ub
  JOIN users u ON u.id = ub.blocked_id
  WHERE ub.blocker_id = user_id_param
  ORDER BY ub.created_at DESC;
END;
$$;

-- 5. Check if a user is blocked (bidirectional check)
CREATE OR REPLACE FUNCTION is_user_blocked(
  user1_id UUID,
  user2_id UUID
)
RETURNS TABLE (
  is_blocked_by_user1 BOOLEAN,
  is_blocked_by_user2 BOOLEAN,
  is_any_blocked BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  blocked_by_1 BOOLEAN := FALSE;
  blocked_by_2 BOOLEAN := FALSE;
BEGIN
  -- Check if user1 blocked user2
  SELECT EXISTS(
    SELECT 1 FROM user_blocks 
    WHERE blocker_id = user1_id AND blocked_id = user2_id
  ) INTO blocked_by_1;

  -- Check if user2 blocked user1
  SELECT EXISTS(
    SELECT 1 FROM user_blocks 
    WHERE blocker_id = user2_id AND blocked_id = user1_id
  ) INTO blocked_by_2;

  RETURN QUERY SELECT 
    blocked_by_1,
    blocked_by_2,
    (blocked_by_1 OR blocked_by_2) as is_any_blocked;
END;
$$;

-- 6. Get all blocked user IDs for content filtering
CREATE OR REPLACE FUNCTION get_all_blocked_user_ids(user_id_param UUID)
RETURNS UUID[]
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ARRAY(
    -- Users blocked by the current user
    SELECT blocked_id FROM user_blocks WHERE blocker_id = user_id_param
    UNION
    -- Users who blocked the current user (bidirectional blocking)
    SELECT blocker_id FROM user_blocks WHERE blocked_id = user_id_param
  );
END;
$$;

-- 7. Clean up orphaned blocks (users who no longer exist)
CREATE OR REPLACE FUNCTION cleanup_orphaned_blocks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_blocks ub
  WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE id = ub.blocker_id
  ) OR NOT EXISTS (
    SELECT 1 FROM users WHERE id = ub.blocked_id
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 8. Add index for performance optimization
CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx ON public.user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS user_blocks_mutual_idx ON public.user_blocks(blocker_id, blocked_id) WHERE is_mutual = TRUE;

-- 9. Add RLS (Row Level Security) policies for user_blocks table
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own blocks
CREATE POLICY "Users can view their own blocks" ON public.user_blocks
  FOR SELECT USING (
    auth.uid() = blocker_id OR auth.uid() = blocked_id
  );

-- Policy: Users can only create blocks where they are the blocker
CREATE POLICY "Users can create their own blocks" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Policy: Users can only delete their own blocks
CREATE POLICY "Users can delete their own blocks" ON public.user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- Policy: Users can update their own blocks
CREATE POLICY "Users can update their own blocks" ON public.user_blocks
  FOR UPDATE USING (auth.uid() = blocker_id);