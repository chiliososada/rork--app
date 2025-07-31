-- 自己紹介(bio)表示サポートのためのRPC関数更新
-- 2025-07-31 作成

-- 1. 既存のget_user_profile_with_privacy関数を削除（戻り値型変更のため）
DROP FUNCTION IF EXISTS get_user_profile_with_privacy(uuid,uuid);

-- 2. get_user_profile_with_privacy関数を新しいbioフィールドを含めて再作成
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
  bio TEXT,
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
    CASE 
      WHEN is_self OR profile_public THEN u.bio
      ELSE NULL
    END as bio,
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

-- 3. 自己紹介表示用の簡単なRPC関数も作成（オプショナル）
CREATE OR REPLACE FUNCTION get_user_bio_if_visible(
  requested_user_id UUID,
  viewing_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  bio TEXT,
  can_view BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  profile_public BOOLEAN;
  is_self BOOLEAN;
  user_bio TEXT;
BEGIN
  -- Check if viewing own profile
  is_self := (requested_user_id = viewing_user_id);
  
  -- Get privacy settings and bio
  SELECT u.is_profile_public, u.bio
  INTO profile_public, user_bio
  FROM users u
  WHERE u.id = requested_user_id;
  
  -- Return bio if visible, otherwise null
  RETURN QUERY
  SELECT
    CASE 
      WHEN is_self OR profile_public THEN user_bio
      ELSE NULL
    END as bio,
    (is_self OR profile_public) as can_view;
END;
$$;

-- 4. コメントを追加
COMMENT ON FUNCTION get_user_profile_with_privacy IS 'プライバシー設定を考慮してユーザープロフィール情報（bio含む）を取得する';
COMMENT ON FUNCTION get_user_bio_if_visible IS '自己紹介文を表示権限に基づいて取得する';