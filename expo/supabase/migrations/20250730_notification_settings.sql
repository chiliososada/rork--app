-- 通知設定テーブルの作成
-- ユーザーごとの通知設定を管理

CREATE TABLE public.user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- 基本通知設定
  push_notifications BOOLEAN DEFAULT TRUE,
  
  -- アクティビティ通知設定
  message_notifications BOOLEAN DEFAULT TRUE,   -- メッセージやコメント通知
  follow_notifications BOOLEAN DEFAULT TRUE,    -- フォロー通知
  like_notifications BOOLEAN DEFAULT TRUE,      -- いいね通知
  comment_notifications BOOLEAN DEFAULT TRUE,   -- コメント通知
  
  -- プッシュ通知用デバイス情報
  device_token TEXT,                            -- FCM/APNS デバイストークン
  device_platform TEXT CHECK (device_platform IN ('ios', 'android', 'web')),
  
  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- ユーザーごとに1つの設定のみ
  UNIQUE(user_id)
);

-- インデックスの作成
CREATE INDEX user_notification_settings_user_id_idx ON public.user_notification_settings(user_id);
CREATE INDEX user_notification_settings_device_token_idx ON public.user_notification_settings(device_token) WHERE device_token IS NOT NULL;

-- RLS（Row Level Security）の有効化
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

-- ポリシー: ユーザーは自分の通知設定のみアクセス可能
CREATE POLICY "Users can view their own notification settings" ON public.user_notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings" ON public.user_notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings" ON public.user_notification_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- デフォルト設定作成用の関数
CREATE OR REPLACE FUNCTION create_default_notification_settings(user_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_notification_settings (
    user_id,
    push_notifications,
    message_notifications,
    follow_notifications,
    like_notifications,
    comment_notifications
  ) VALUES (
    user_id_param,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- 通知設定を取得する関数（デフォルト値付き）
CREATE OR REPLACE FUNCTION get_user_notification_settings(user_id_param UUID)
RETURNS TABLE (
  user_id UUID,
  push_notifications BOOLEAN,
  message_notifications BOOLEAN,
  follow_notifications BOOLEAN,
  like_notifications BOOLEAN,
  comment_notifications BOOLEAN,
  device_token TEXT,
  device_platform TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 設定が存在しない場合はデフォルト設定を作成
  PERFORM create_default_notification_settings(user_id_param);
  
  -- 設定を返す
  RETURN QUERY
  SELECT 
    uns.user_id,
    uns.push_notifications,
    uns.message_notifications,
    uns.follow_notifications,
    uns.like_notifications,
    uns.comment_notifications,
    uns.device_token,
    uns.device_platform
  FROM public.user_notification_settings uns
  WHERE uns.user_id = user_id_param;
END;
$$;

-- 通知設定を更新する関数
CREATE OR REPLACE FUNCTION update_notification_settings(
  user_id_param UUID,
  push_notifications_param BOOLEAN DEFAULT NULL,
  message_notifications_param BOOLEAN DEFAULT NULL,
  follow_notifications_param BOOLEAN DEFAULT NULL,
  like_notifications_param BOOLEAN DEFAULT NULL,
  comment_notifications_param BOOLEAN DEFAULT NULL,
  device_token_param TEXT DEFAULT NULL,
  device_platform_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- 設定が存在しない場合はデフォルト設定を作成
  PERFORM create_default_notification_settings(user_id_param);
  
  -- 設定を更新（NULL以外のパラメータのみ）
  UPDATE public.user_notification_settings
  SET 
    push_notifications = COALESCE(push_notifications_param, push_notifications),
    message_notifications = COALESCE(message_notifications_param, message_notifications),
    follow_notifications = COALESCE(follow_notifications_param, follow_notifications),
    like_notifications = COALESCE(like_notifications_param, like_notifications),
    comment_notifications = COALESCE(comment_notifications_param, comment_notifications),
    device_token = COALESCE(device_token_param, device_token),
    device_platform = COALESCE(device_platform_param, device_platform),
    updated_at = NOW()
  WHERE user_id = user_id_param;
  
  RETURN FOUND;
END;
$$;

-- 通知可能なユーザーを取得する関数（特定の通知タイプ）
CREATE OR REPLACE FUNCTION get_notification_enabled_users(
  user_ids UUID[],
  notification_type TEXT -- 'message', 'follow', 'like', 'comment'
)
RETURNS TABLE (
  user_id UUID,
  device_token TEXT,
  device_platform TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uns.user_id,
    uns.device_token,
    uns.device_platform
  FROM public.user_notification_settings uns
  WHERE 
    uns.user_id = ANY(user_ids)
    AND uns.push_notifications = TRUE
    AND uns.device_token IS NOT NULL
    AND CASE 
      WHEN notification_type = 'message' THEN uns.message_notifications
      WHEN notification_type = 'follow' THEN uns.follow_notifications
      WHEN notification_type = 'like' THEN uns.like_notifications
      WHEN notification_type = 'comment' THEN uns.comment_notifications
      ELSE FALSE
    END = TRUE;
END;
$$;