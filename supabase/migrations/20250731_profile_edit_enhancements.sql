-- プロフィール編集機能のためのデータベース拡張
-- 2025-07-31 作成

-- 1. usersテーブルにbio(自己紹介)フィールドを追加
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. usersテーブルにプライバシー設定フィールドを追加（既存チェック）
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_followers_visible BOOLEAN DEFAULT TRUE;

-- 3. プロフィール更新用RPC関数
CREATE OR REPLACE FUNCTION update_user_profile(
  user_id_param UUID,
  nickname_param TEXT DEFAULT NULL,
  bio_param TEXT DEFAULT NULL,
  gender_param TEXT DEFAULT NULL,
  avatar_url_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  updated_user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ユーザーの存在確認
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_id_param) THEN
    RETURN QUERY SELECT FALSE, 'ユーザーが見つかりません'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- プロフィール情報を更新
  UPDATE users 
  SET 
    nickname = COALESCE(nickname_param, nickname),
    bio = COALESCE(bio_param, bio),
    gender = COALESCE(gender_param, gender),
    avatar_url = COALESCE(avatar_url_param, avatar_url)
  WHERE id = user_id_param;

  -- 成功を返す
  RETURN QUERY SELECT TRUE, 'プロフィールを更新しました'::TEXT, user_id_param;
END;
$$;

-- 4. プライバシー設定更新用RPC関数
CREATE OR REPLACE FUNCTION update_user_privacy_settings(
  user_id_param UUID,
  is_profile_public_param BOOLEAN DEFAULT NULL,
  is_followers_visible_param BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ユーザーの存在確認
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_id_param) THEN
    RETURN QUERY SELECT FALSE, 'ユーザーが見つかりません'::TEXT;
    RETURN;
  END IF;

  -- プライバシー設定を更新
  UPDATE users 
  SET 
    is_profile_public = COALESCE(is_profile_public_param, is_profile_public),
    is_followers_visible = COALESCE(is_followers_visible_param, is_followers_visible)
  WHERE id = user_id_param;

  -- 成功を返す
  RETURN QUERY SELECT TRUE, 'プライバシー設定を更新しました'::TEXT;
END;
$$;

-- 5. ユーザープロフィール取得用RPC関数（拡張版）
CREATE OR REPLACE FUNCTION get_user_profile_extended(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  email TEXT,
  bio TEXT,
  gender TEXT,
  avatar_url TEXT,
  is_profile_public BOOLEAN,
  is_followers_visible BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nickname,
    u.email,
    u.bio,
    u.gender,
    u.avatar_url,
    u.is_profile_public,
    u.is_followers_visible,
    u.created_at
  FROM users u
  WHERE u.id = user_id_param;
END;
$$;

-- 6. インデックスの作成（検索性能向上のため）
CREATE INDEX IF NOT EXISTS users_nickname_idx ON public.users(nickname);
CREATE INDEX IF NOT EXISTS users_gender_idx ON public.users(gender);

-- 7. コメント
COMMENT ON COLUMN public.users.bio IS 'ユーザーの自己紹介文';
COMMENT ON FUNCTION update_user_profile IS 'ユーザープロフィール情報を更新する';
COMMENT ON FUNCTION update_user_privacy_settings IS 'ユーザーのプライバシー設定を更新する';
COMMENT ON FUNCTION get_user_profile_extended IS 'ユーザープロフィール情報を取得する（拡張版）';