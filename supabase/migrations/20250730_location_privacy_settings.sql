-- 位置情報プライバシー設定
-- Location Privacy Settings for TokyoPark

-- 1. ユーザーテーブルに位置情報設定カラムを追加
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_location_visible BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS save_location_history BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS location_precision TEXT DEFAULT 'exact' CHECK (location_precision IN ('exact', 'area', 'city', 'hidden'));

-- 2. 位置情報履歴テーブルの作成
CREATE TABLE IF NOT EXISTS public.location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_name TEXT,
  area_name TEXT, -- 区レベルの地名
  city_name TEXT, -- 市レベルの地名
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. インデックスの作成
CREATE INDEX IF NOT EXISTS location_history_user_id_idx ON public.location_history(user_id);
CREATE INDEX IF NOT EXISTS location_history_topic_id_idx ON public.location_history(topic_id);
CREATE INDEX IF NOT EXISTS location_history_created_at_idx ON public.location_history(created_at DESC);
CREATE INDEX IF NOT EXISTS users_is_location_visible_idx ON public.users(is_location_visible);

-- 4. 位置情報プライバシー設定を更新する関数
CREATE OR REPLACE FUNCTION update_location_privacy_settings(
  user_id_param UUID,
  is_location_visible_param BOOLEAN,
  save_location_history_param BOOLEAN,
  location_precision_param TEXT DEFAULT 'exact'
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 設定を更新
  UPDATE users
  SET 
    is_location_visible = is_location_visible_param,
    save_location_history = save_location_history_param,
    location_precision = location_precision_param
  WHERE id = user_id_param;
  
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, '位置情報設定を更新しました'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'ユーザーが見つかりません'::TEXT;
  END IF;
END;
$$;

-- 5. 位置情報履歴を保存する関数
CREATE OR REPLACE FUNCTION save_location_history(
  user_id_param UUID,
  topic_id_param UUID,
  latitude_param DOUBLE PRECISION,
  longitude_param DOUBLE PRECISION,
  location_name_param TEXT,
  area_name_param TEXT DEFAULT NULL,
  city_name_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  save_history BOOLEAN;
  history_id UUID;
BEGIN
  -- ユーザーの履歴保存設定を確認
  SELECT save_location_history INTO save_history
  FROM users
  WHERE id = user_id_param;
  
  -- 履歴保存が有効な場合のみ保存
  IF save_history THEN
    INSERT INTO location_history (
      user_id, topic_id, latitude, longitude, 
      location_name, area_name, city_name
    ) VALUES (
      user_id_param, topic_id_param, latitude_param, longitude_param,
      location_name_param, area_name_param, city_name_param
    ) RETURNING id INTO history_id;
    
    RETURN history_id;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 6. 位置情報履歴を削除する関数
CREATE OR REPLACE FUNCTION delete_location_history(
  user_id_param UUID,
  delete_all BOOLEAN DEFAULT TRUE,
  history_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  deleted_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  count_deleted INTEGER;
BEGIN
  IF delete_all THEN
    -- すべての履歴を削除
    DELETE FROM location_history
    WHERE user_id = user_id_param;
    
    GET DIAGNOSTICS count_deleted = ROW_COUNT;
    
    RETURN QUERY SELECT 
      TRUE, 
      count_deleted, 
      format('%s件の位置情報履歴を削除しました', count_deleted)::TEXT;
  ELSE
    -- 特定の履歴を削除
    DELETE FROM location_history
    WHERE id = history_id_param AND user_id = user_id_param;
    
    GET DIAGNOSTICS count_deleted = ROW_COUNT;
    
    IF count_deleted > 0 THEN
      RETURN QUERY SELECT TRUE, count_deleted, '位置情報履歴を削除しました'::TEXT;
    ELSE
      RETURN QUERY SELECT FALSE, 0, '削除する履歴が見つかりません'::TEXT;
    END IF;
  END IF;
END;
$$;

-- 7. プライバシー設定に基づいて位置情報を取得する関数
CREATE OR REPLACE FUNCTION get_topic_location_with_privacy(
  topic_id_param UUID,
  viewing_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  precision_level TEXT,
  is_exact BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  topic_user_id UUID;
  location_visible BOOLEAN;
  location_precision TEXT;
  topic_lat DOUBLE PRECISION;
  topic_lng DOUBLE PRECISION;
  topic_location_name TEXT;
BEGIN
  -- トピックの情報を取得
  SELECT t.user_id, t.latitude, t.longitude, t.location_name
  INTO topic_user_id, topic_lat, topic_lng, topic_location_name
  FROM topics t
  WHERE t.id = topic_id_param;
  
  -- 自分のトピックの場合は常に正確な位置を返す
  IF topic_user_id = viewing_user_id THEN
    RETURN QUERY SELECT 
      topic_lat, 
      topic_lng, 
      topic_location_name,
      'exact'::TEXT,
      TRUE;
    RETURN;
  END IF;
  
  -- ユーザーの位置情報設定を取得
  SELECT u.is_location_visible, u.location_precision
  INTO location_visible, location_precision
  FROM users u
  WHERE u.id = topic_user_id;
  
  -- 位置情報非表示の場合
  IF NOT location_visible THEN
    RETURN QUERY SELECT 
      NULL::DOUBLE PRECISION, 
      NULL::DOUBLE PRECISION, 
      '位置情報非公開'::TEXT,
      'hidden'::TEXT,
      FALSE;
    RETURN;
  END IF;
  
  -- 精度設定に基づいて位置情報を返す
  CASE location_precision
    WHEN 'exact' THEN
      RETURN QUERY SELECT 
        topic_lat, 
        topic_lng, 
        topic_location_name,
        'exact'::TEXT,
        TRUE;
    WHEN 'area' THEN
      -- エリアレベル（約1km四方の精度）に曖昧化
      RETURN QUERY SELECT 
        ROUND(topic_lat::numeric, 2)::DOUBLE PRECISION,
        ROUND(topic_lng::numeric, 2)::DOUBLE PRECISION,
        COALESCE(
          (SELECT area_name FROM location_history 
           WHERE topic_id = topic_id_param LIMIT 1),
          '周辺エリア'
        ),
        'area'::TEXT,
        FALSE;
    WHEN 'city' THEN
      -- 市レベルの精度に曖昧化
      RETURN QUERY SELECT 
        ROUND(topic_lat::numeric, 1)::DOUBLE PRECISION,
        ROUND(topic_lng::numeric, 1)::DOUBLE PRECISION,
        COALESCE(
          (SELECT city_name FROM location_history 
           WHERE topic_id = topic_id_param LIMIT 1),
          '市内'
        ),
        'city'::TEXT,
        FALSE;
    ELSE -- 'hidden'
      RETURN QUERY SELECT 
        NULL::DOUBLE PRECISION, 
        NULL::DOUBLE PRECISION, 
        '位置情報非公開'::TEXT,
        'hidden'::TEXT,
        FALSE;
  END CASE;
END;
$$;

-- 8. 複数のトピックの位置情報をプライバシー設定に基づいて取得
CREATE OR REPLACE FUNCTION get_topics_location_with_privacy(
  topic_ids UUID[],
  viewing_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  topic_id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  precision_level TEXT,
  is_exact BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as topic_id,
    loc.latitude,
    loc.longitude,
    loc.location_name,
    loc.precision_level,
    loc.is_exact
  FROM unnest(topic_ids) AS t(id)
  CROSS JOIN LATERAL get_topic_location_with_privacy(t.id, viewing_user_id) AS loc;
END;
$$;

-- 9. 位置情報履歴を取得する関数
CREATE OR REPLACE FUNCTION get_user_location_history(
  user_id_param UUID,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  history_id UUID,
  topic_id UUID,
  topic_title TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  visited_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lh.id as history_id,
    lh.topic_id,
    t.title as topic_title,
    lh.latitude,
    lh.longitude,
    lh.location_name,
    lh.created_at as visited_at
  FROM location_history lh
  LEFT JOIN topics t ON t.id = lh.topic_id
  WHERE lh.user_id = user_id_param
  ORDER BY lh.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 10. ユーザーの位置情報設定を取得
CREATE OR REPLACE FUNCTION get_user_location_settings(user_id_param UUID)
RETURNS TABLE (
  is_location_visible BOOLEAN,
  save_location_history BOOLEAN,
  location_precision TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.is_location_visible,
    u.save_location_history,
    u.location_precision
  FROM users u
  WHERE u.id = user_id_param;
END;
$$;

-- コメント追加
COMMENT ON COLUMN public.users.is_location_visible IS '位置情報を他のユーザーに表示するかどうか';
COMMENT ON COLUMN public.users.save_location_history IS '位置情報履歴を保存するかどうか';
COMMENT ON COLUMN public.users.location_precision IS '位置情報の精度レベル: exact(正確), area(エリア), city(市), hidden(非表示)';
COMMENT ON TABLE public.location_history IS 'ユーザーの位置情報履歴';