-- Smart Tag System RPC Functions
-- TokyoPark智能标签系统RPC函数

-- タグ検索関数（自動補完用）
CREATE OR REPLACE FUNCTION search_tags(
  search_query TEXT,
  user_id_param UUID DEFAULT NULL,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  tag_name TEXT,
  source TEXT, -- 'preset', 'custom', 'user_history'
  usage_count INTEGER,
  relevance_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH all_tags AS (
    -- プリセットタグ
    SELECT 
      t.tag_name,
      'preset'::TEXT as source,
      t.usage_count,
      1.0 as base_score
    FROM tag_usage_stats t
    WHERE t.tag_name ILIKE search_query || '%'
    
    UNION ALL
    
    -- カスタムタグ
    SELECT 
      ct.tag_name,
      'custom'::TEXT as source,
      ct.usage_count,
      CASE WHEN ct.is_verified THEN 0.9 ELSE 0.7 END as base_score
    FROM custom_tags ct
    WHERE ct.normalized_name ILIKE LOWER(search_query) || '%'
    
    UNION ALL
    
    -- ユーザー履歴タグ
    SELECT 
      utp.tag_name,
      'user_history'::TEXT as source,
      utp.usage_count,
      1.2 as base_score
    FROM user_tag_preferences utp
    WHERE utp.user_id = user_id_param
      AND utp.tag_name ILIKE search_query || '%'
  )
  SELECT 
    tag_name,
    source,
    usage_count,
    base_score * (1 + LOG(usage_count + 1) / 10) as relevance_score
  FROM all_tags
  ORDER BY relevance_score DESC, usage_count DESC
  LIMIT limit_count;
END;
$$;

-- 位置ベースタグ推薦関数
CREATE OR REPLACE FUNCTION get_location_based_tags(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 1.0,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  tag_name TEXT,
  usage_count BIGINT,
  distance_km FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lts.tag_name,
    SUM(lts.usage_count)::BIGINT as usage_count,
    AVG(
      6371 * acos(
        LEAST(1.0, -- 防止acos输入超过1
          cos(radians(user_lat)) * 
          cos(radians(lts.latitude)) * 
          cos(radians(lts.longitude) - radians(user_lng)) + 
          sin(radians(user_lat)) * 
          sin(radians(lts.latitude))
        )
      )
    )::FLOAT as distance_km
  FROM location_tag_stats lts
  WHERE 
    6371 * acos(
      LEAST(1.0,
        cos(radians(user_lat)) * 
        cos(radians(lts.latitude)) * 
        cos(radians(lts.longitude) - radians(user_lng)) + 
        sin(radians(user_lat)) * 
        sin(radians(lts.latitude))
      )
    ) <= radius_km
  GROUP BY lts.tag_name
  ORDER BY usage_count DESC, distance_km ASC
  LIMIT limit_count;
END;
$$;

-- 時間ベースタグ推薦関数
CREATE OR REPLACE FUNCTION get_time_based_tags(
  current_hour INTEGER,
  current_day_of_week INTEGER,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  tag_name TEXT,
  usage_count BIGINT,
  relevance_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tbts.tag_name,
    SUM(tbts.usage_count)::BIGINT as usage_count,
    SUM(
      CASE 
        -- 同じ時間帯の重み付け
        WHEN tbts.hour_of_day = current_hour THEN tbts.usage_count * 1.0
        WHEN ABS(tbts.hour_of_day - current_hour) = 1 THEN tbts.usage_count * 0.7
        WHEN ABS(tbts.hour_of_day - current_hour) = 2 THEN tbts.usage_count * 0.4
        ELSE tbts.usage_count * 0.1
      END
    )::FLOAT as relevance_score
  FROM time_based_tag_stats tbts
  WHERE tbts.day_of_week = current_day_of_week
  GROUP BY tbts.tag_name
  ORDER BY relevance_score DESC
  LIMIT limit_count;
END;
$$;

-- スマートタグ推薦関数（総合）
CREATE OR REPLACE FUNCTION get_smart_tag_recommendations(
  user_id_param UUID,
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  tag_name TEXT,
  recommendation_type TEXT,
  score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_hour INTEGER;
  current_day INTEGER;
BEGIN
  -- 現在時刻を取得（日本時間）
  current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Tokyo');
  current_day := EXTRACT(DOW FROM NOW() AT TIME ZONE 'Asia/Tokyo');
  
  RETURN QUERY
  WITH recommendations AS (
    -- ユーザー履歴ベース
    (SELECT 
      utp.tag_name,
      'personal'::TEXT as recommendation_type,
      utp.usage_count::FLOAT * 2.0 as score
    FROM user_tag_preferences utp
    WHERE utp.user_id = user_id_param
    ORDER BY utp.last_used_at DESC
    LIMIT 5)
    
    UNION ALL
    
    -- 位置ベース
    (SELECT 
      lbt.tag_name,
      'location'::TEXT as recommendation_type,
      lbt.usage_count::FLOAT * 1.5 as score
    FROM get_location_based_tags(user_lat, user_lng, 1.0, 5) lbt)
    
    UNION ALL
    
    -- 時間ベース
    (SELECT 
      tbt.tag_name,
      'time'::TEXT as recommendation_type,
      tbt.relevance_score as score
    FROM get_time_based_tags(current_hour, current_day, 5) tbt)
    
    UNION ALL
    
    -- 人気タグ
    (SELECT 
      t.tag_name,
      'popular'::TEXT as recommendation_type,
      t.usage_count::FLOAT as score
    FROM tag_usage_stats t
    ORDER BY t.usage_count DESC
    LIMIT 5)
  )
  SELECT 
    r.tag_name,
    r.recommendation_type,
    r.score
  FROM recommendations r
  GROUP BY r.tag_name, r.recommendation_type, r.score
  ORDER BY r.score DESC
  LIMIT limit_count;
END;
$$;

-- 既存のrecord_tag_usage関数を削除（戻り値型変更のため）
DROP FUNCTION IF EXISTS record_tag_usage(UUID, TEXT[], DOUBLE PRECISION, DOUBLE PRECISION);

-- タグ使用記録関数
CREATE OR REPLACE FUNCTION record_tag_usage(
  user_id_param UUID,
  tag_names TEXT[],
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  tag TEXT;
  current_hour INTEGER;
  current_day INTEGER;
  normalized_tag TEXT;
  processed_count INTEGER := 0;
  error_count INTEGER := 0;
  result JSON;
BEGIN
  current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Tokyo');
  current_day := EXTRACT(DOW FROM NOW() AT TIME ZONE 'Asia/Tokyo');
  
  FOREACH tag IN ARRAY tag_names
  LOOP
    BEGIN
      -- タグの正規化
      normalized_tag := LOWER(TRIM(tag));
      
      -- カスタムタグとして登録（既存でない場合）
      INSERT INTO custom_tags (tag_name, normalized_name, created_by, usage_count)
      VALUES (tag, normalized_tag, user_id_param, 1)
      ON CONFLICT (normalized_name) 
      DO UPDATE SET usage_count = custom_tags.usage_count + 1;
      
      -- ユーザー履歴を更新
      INSERT INTO user_tag_preferences (user_id, tag_name, usage_count, last_used_at)
      VALUES (user_id_param, tag, 1, NOW())
      ON CONFLICT (user_id, tag_name)
      DO UPDATE SET 
        usage_count = user_tag_preferences.usage_count + 1,
        last_used_at = NOW();
      
      -- 位置統計を更新
      INSERT INTO location_tag_stats (tag_name, latitude, longitude, usage_count, last_used_at)
      VALUES (tag, user_lat, user_lng, 1, NOW());
      
      -- 時間統計を更新
      INSERT INTO time_based_tag_stats (tag_name, hour_of_day, day_of_week, usage_count, last_used_at)
      VALUES (tag, current_hour, current_day, 1, NOW())
      ON CONFLICT (tag_name, hour_of_day, day_of_week) 
      DO UPDATE SET 
        usage_count = time_based_tag_stats.usage_count + 1,
        last_used_at = NOW();
      
      -- 既存のtag_usage_statsも更新（プリセットタグの場合）
      INSERT INTO tag_usage_stats (tag_name, category, usage_count, last_used_at)
      VALUES (tag, 'custom', 1, NOW())
      ON CONFLICT (tag_name, category) 
      DO UPDATE SET 
        usage_count = tag_usage_stats.usage_count + 1,
        last_used_at = NOW();
      
      processed_count := processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      -- ログエラーを記録（デバッグ用）
      RAISE WARNING 'Error processing tag %: %', tag, SQLERRM;
    END;
  END LOOP;
  
  -- 結果を返す
  result := json_build_object(
    'processed_tags', processed_count,
    'errors', error_count,
    'total_tags', array_length(tag_names, 1)
  );
  
  RETURN result;
END;
$$;

-- タグの正規化関数（ユーティリティ）
CREATE OR REPLACE FUNCTION normalize_tag(tag_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- 小文字化、前後の空白除去、連続する空白を単一に
  RETURN LOWER(REGEXP_REPLACE(TRIM(tag_text), '\s+', ' ', 'g'));
END;
$$;

-- 人気カスタムタグを定期的にプリセットに昇格させる関数（管理者用）
CREATE OR REPLACE FUNCTION promote_popular_custom_tags(
  min_usage_count INTEGER DEFAULT 100,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  promoted_tag TEXT,
  usage_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH popular_custom AS (
    SELECT 
      ct.tag_name,
      ct.usage_count
    FROM custom_tags ct
    WHERE ct.usage_count >= min_usage_count
      AND ct.is_verified = FALSE
    ORDER BY ct.usage_count DESC
    LIMIT limit_count
  )
  UPDATE custom_tags
  SET is_verified = TRUE
  FROM popular_custom
  WHERE custom_tags.tag_name = popular_custom.tag_name
  RETURNING custom_tags.tag_name, custom_tags.usage_count;
END;
$$;