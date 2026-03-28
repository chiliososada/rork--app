-- ユーザーカテゴリ嗜好追跡のためのRPC関数

-- 1. ユーザーカテゴリ使用統計テーブル（存在しない場合のみ作成）
CREATE TABLE IF NOT EXISTS public.user_category_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category_key)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS user_category_usage_user_id_idx ON public.user_category_usage(user_id);
CREATE INDEX IF NOT EXISTS user_category_usage_category_key_idx ON public.user_category_usage(category_key);
CREATE INDEX IF NOT EXISTS user_category_usage_usage_count_idx ON public.user_category_usage(usage_count DESC);

-- 2. カテゴリ使用を追跡するRPC関数
CREATE OR REPLACE FUNCTION track_category_usage(
  user_id_param UUID,
  category_key_param TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_category_usage (user_id, category_key, usage_count, last_used_at)
  VALUES (user_id_param, category_key_param, 1, NOW())
  ON CONFLICT (user_id, category_key)
  DO UPDATE SET
    usage_count = user_category_usage.usage_count + 1,
    last_used_at = NOW();
END;
$$;

-- 3. ユーザーのカテゴリ嗜好を取得するRPC関数
CREATE OR REPLACE FUNCTION get_user_category_preferences(
  user_id_param UUID,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  category_key TEXT,
  usage_count INTEGER,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_ratio DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  total_usage INTEGER;
BEGIN
  -- ユーザーの総使用回数を取得
  SELECT COALESCE(SUM(ucu.usage_count), 0) INTO total_usage
  FROM user_category_usage ucu
  WHERE ucu.user_id = user_id_param;
  
  -- 使用率を含むカテゴリ嗜好を返す
  RETURN QUERY
  SELECT
    ucu.category_key,
    ucu.usage_count,
    ucu.last_used_at,
    CASE 
      WHEN total_usage > 0 THEN ROUND((ucu.usage_count::DECIMAL / total_usage::DECIMAL) * 100, 2)
      ELSE 0::DECIMAL
    END as usage_ratio
  FROM user_category_usage ucu
  WHERE ucu.user_id = user_id_param
  ORDER BY ucu.usage_count DESC, ucu.last_used_at DESC
  LIMIT limit_count;
END;
$$;

-- 4. 全体のカテゴリ人気度を取得するRPC関数（デフォルトソート用）
CREATE OR REPLACE FUNCTION get_popular_categories(
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  category_key TEXT,
  total_usage INTEGER,
  unique_users INTEGER,
  popularity_score DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ucu.category_key,
    SUM(ucu.usage_count)::INTEGER as total_usage,
    COUNT(DISTINCT ucu.user_id)::INTEGER as unique_users,
    -- 人気度スコア：総使用回数 * ユニークユーザー数の平方根
    ROUND((SUM(ucu.usage_count) * SQRT(COUNT(DISTINCT ucu.user_id)))::DECIMAL, 2) as popularity_score
  FROM user_category_usage ucu
  GROUP BY ucu.category_key
  ORDER BY popularity_score DESC, total_usage DESC
  LIMIT limit_count;
END;
$$;

-- 5. ユーザーのカテゴリ嗜好をリセットする関数（管理用）
CREATE OR REPLACE FUNCTION reset_user_category_preferences(
  user_id_param UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM user_category_usage
  WHERE user_id = user_id_param;
END;
$$;

-- テスト用のサンプルデータ挿入（開発環境でのみ実行）
-- INSERT INTO user_category_usage (user_id, category_key, usage_count) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'social', 15),
--   ('00000000-0000-0000-0000-000000000001', 'food', 12),
--   ('00000000-0000-0000-0000-000000000001', 'recommended', 8),
--   ('00000000-0000-0000-0000-000000000001', 'nearby', 5);