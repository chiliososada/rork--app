-- Smart Tag System Migration
-- TokyoPark智能标签系统数据库架构

-- 1. カスタムタグテーブル
CREATE TABLE IF NOT EXISTS public.custom_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- 正規化されたタグ名（小文字、スペース除去）
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT FALSE, -- 管理者承認済みタグ
  UNIQUE(normalized_name)
);

-- 2. ユーザータグ使用履歴テーブル
CREATE TABLE IF NOT EXISTS public.user_tag_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tag_name)
);

-- 3. 位置ベースタグ統計テーブル
CREATE TABLE IF NOT EXISTS public.location_tag_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 時間帯別タグ統計テーブル
CREATE TABLE IF NOT EXISTS public.time_based_tag_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT NOT NULL,
  hour_of_day INTEGER CHECK (hour_of_day >= 0 AND hour_of_day < 24),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week < 7),
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tag_name, hour_of_day, day_of_week)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS custom_tags_normalized_idx ON public.custom_tags(normalized_name);
CREATE INDEX IF NOT EXISTS custom_tags_usage_idx ON public.custom_tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS user_tag_preferences_user_id_idx ON public.user_tag_preferences(user_id);
CREATE INDEX IF NOT EXISTS user_tag_preferences_usage_idx ON public.user_tag_preferences(user_id, usage_count DESC);
CREATE INDEX IF NOT EXISTS location_tag_stats_location_idx ON public.location_tag_stats(latitude, longitude);
CREATE INDEX IF NOT EXISTS location_tag_stats_tag_idx ON public.location_tag_stats(tag_name);
CREATE INDEX IF NOT EXISTS time_based_tag_stats_time_idx ON public.time_based_tag_stats(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS time_based_tag_stats_tag_idx ON public.time_based_tag_stats(tag_name);