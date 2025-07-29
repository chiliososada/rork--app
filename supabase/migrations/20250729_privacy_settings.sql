-- Privacy Settings for User Profiles
-- ユーザープロフィールのプライバシー設定

-- 1. Add privacy settings columns to users table
ALTER TABLE public.users 
ADD COLUMN is_profile_public BOOLEAN DEFAULT TRUE,
ADD COLUMN is_followers_visible BOOLEAN DEFAULT TRUE;

-- 2. Create indexes for privacy settings
CREATE INDEX users_is_profile_public_idx ON public.users(is_profile_public);
CREATE INDEX users_is_followers_visible_idx ON public.users(is_followers_visible);

-- 3. Update user privacy settings function
CREATE OR REPLACE FUNCTION update_user_privacy_settings(
  user_id_param UUID,
  is_profile_public_param BOOLEAN,
  is_followers_visible_param BOOLEAN
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update privacy settings
  UPDATE users
  SET 
    is_profile_public = is_profile_public_param,
    is_followers_visible = is_followers_visible_param
  WHERE id = user_id_param;
  
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'プライバシー設定を更新しました'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'ユーザーが見つかりません'::TEXT;
  END IF;
END;
$$;

-- 4. Get user profile with privacy check
CREATE OR REPLACE FUNCTION get_user_profile_with_privacy(
  requested_user_id UUID,
  viewing_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  avatar_url TEXT,
  email TEXT,
  gender TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  followers_count INTEGER,
  following_count INTEGER,
  is_profile_public BOOLEAN,
  is_followers_visible BOOLEAN,
  can_view_profile BOOLEAN,
  can_view_followers BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  profile_public BOOLEAN;
  followers_visible BOOLEAN;
  is_self BOOLEAN;
BEGIN
  -- Check if viewing own profile
  is_self := (requested_user_id = viewing_user_id);
  
  -- Get privacy settings
  SELECT u.is_profile_public, u.is_followers_visible 
  INTO profile_public, followers_visible
  FROM users u
  WHERE u.id = requested_user_id;
  
  RETURN QUERY
  SELECT
    u.id,
    u.nickname,
    u.avatar_url,
    CASE 
      WHEN is_self OR profile_public THEN u.email
      ELSE NULL
    END as email,
    CASE 
      WHEN is_self OR profile_public THEN u.gender
      ELSE NULL
    END as gender,
    u.created_at,
    CASE 
      WHEN is_self OR followers_visible THEN 
        (SELECT COUNT(*)::INTEGER FROM user_follows WHERE following_id = requested_user_id)
      ELSE NULL
    END as followers_count,
    CASE 
      WHEN is_self OR followers_visible THEN 
        (SELECT COUNT(*)::INTEGER FROM user_follows WHERE follower_id = requested_user_id)
      ELSE NULL
    END as following_count,
    u.is_profile_public,
    u.is_followers_visible,
    (is_self OR profile_public) as can_view_profile,
    (is_self OR followers_visible) as can_view_followers
  FROM users u
  WHERE u.id = requested_user_id;
END;
$$;

-- 5. Update get_recent_followers to check privacy settings
CREATE OR REPLACE FUNCTION get_recent_followers(
  user_id_param UUID,
  viewing_user_id UUID DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  follower_id UUID,
  follower_name TEXT,
  follower_avatar TEXT,
  followed_at TIMESTAMP WITH TIME ZONE,
  is_following_back BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  is_self BOOLEAN;
  followers_visible BOOLEAN;
BEGIN
  -- Check if viewing own followers or if followers are visible
  is_self := (user_id_param = viewing_user_id);
  
  SELECT u.is_followers_visible INTO followers_visible
  FROM users u
  WHERE u.id = user_id_param;
  
  -- If not self and followers not visible, return empty
  IF NOT is_self AND NOT followers_visible THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT
    uf.follower_id,
    u.nickname as follower_name,
    u.avatar_url as follower_avatar,
    uf.created_at as followed_at,
    (uf_back.id IS NOT NULL) as is_following_back
  FROM user_follows uf
  JOIN users u ON u.id = uf.follower_id
  LEFT JOIN user_follows uf_back
    ON uf_back.follower_id = user_id_param AND uf_back.following_id = uf.follower_id
  WHERE uf.following_id = user_id_param
  ORDER BY uf.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 6. Update get_following_users to check privacy settings
CREATE OR REPLACE FUNCTION get_following_users(
  user_id_param UUID,
  viewing_user_id UUID DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  following_id UUID,
  following_name TEXT,
  following_avatar TEXT,
  followed_at TIMESTAMP WITH TIME ZONE,
  is_followed_back BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  is_self BOOLEAN;
  followers_visible BOOLEAN;
BEGIN
  -- Check if viewing own following list or if followers are visible
  is_self := (user_id_param = viewing_user_id);
  
  SELECT u.is_followers_visible INTO followers_visible
  FROM users u
  WHERE u.id = user_id_param;
  
  -- If not self and followers not visible, return empty
  IF NOT is_self AND NOT followers_visible THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT
    uf.following_id,
    u.nickname as following_name,
    u.avatar_url as following_avatar,
    uf.created_at as followed_at,
    (uf_back.id IS NOT NULL) as is_followed_back
  FROM user_follows uf
  JOIN users u ON u.id = uf.following_id
  LEFT JOIN user_follows uf_back
    ON uf_back.follower_id = uf.following_id AND uf_back.following_id = user_id_param
  WHERE uf.follower_id = user_id_param
  ORDER BY uf.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 7. Create batch check privacy settings function
CREATE OR REPLACE FUNCTION check_users_privacy_settings(user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  is_profile_public BOOLEAN,
  is_followers_visible BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.is_profile_public,
    u.is_followers_visible
  FROM users u
  WHERE u.id = ANY(user_ids);
END;
$$;

-- 8. Update get_user_follow_stats to respect privacy settings
CREATE OR REPLACE FUNCTION get_user_follow_stats(
  user_ids UUID[], 
  viewing_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  followers_count INTEGER,
  following_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    CASE 
      WHEN u.id = viewing_user_id OR u.is_followers_visible THEN 
        COALESCE(followers.count, 0)::INTEGER
      ELSE NULL
    END as followers_count,
    CASE 
      WHEN u.id = viewing_user_id OR u.is_followers_visible THEN 
        COALESCE(following.count, 0)::INTEGER
      ELSE NULL
    END as following_count
  FROM
    unnest(user_ids) AS u_id(id)
  JOIN users u ON u.id = u_id.id
  LEFT JOIN (
    SELECT following_id, COUNT(*)::INTEGER as count
    FROM user_follows
    WHERE following_id = ANY(user_ids)
    GROUP BY following_id
  ) followers ON u.id = followers.following_id
  LEFT JOIN (
    SELECT follower_id, COUNT(*)::INTEGER as count
    FROM user_follows
    WHERE follower_id = ANY(user_ids)
    GROUP BY follower_id
  ) following ON u.id = following.follower_id;
END;
$$;

-- 9. Add comment explaining privacy settings usage
COMMENT ON COLUMN public.users.is_profile_public IS 'プロフィール情報（メール、性別など）を他のユーザーに公開するかどうか';
COMMENT ON COLUMN public.users.is_followers_visible IS 'フォロワー・フォロー中リストを他のユーザーに公開するかどうか';