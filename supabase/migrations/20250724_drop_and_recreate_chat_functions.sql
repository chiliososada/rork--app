-- 先删除现有函数
DROP FUNCTION IF EXISTS get_user_chat_topics(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_user_chat_topics_count(UUID);

-- 重新创建函数（不包含 is_hidden）
CREATE OR REPLACE FUNCTION get_user_chat_topics(
  user_id_param UUID,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  user_id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  image_url TEXT,
  image_aspect_ratio TEXT,
  original_width INTEGER,
  original_height INTEGER,
  -- 聚合数据
  user_nickname TEXT,
  user_avatar_url TEXT,
  user_email TEXT,
  comment_count BIGINT,
  participant_count BIGINT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT,
  is_creator BOOLEAN,
  is_participant BOOLEAN,
  joined_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_topics AS (
    -- 获取用户创建的或参与的话题
    SELECT DISTINCT t.*,
           CASE WHEN t.user_id = user_id_param THEN TRUE ELSE FALSE END as is_creator,
           CASE WHEN tp.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_participant,
           tp.joined_at as participant_joined_at
    FROM topics t
    LEFT JOIN topic_participants tp 
      ON t.id = tp.topic_id 
      AND tp.user_id = user_id_param 
      AND tp.is_active = TRUE
    WHERE (t.user_id = user_id_param OR tp.user_id IS NOT NULL)
  ),
  topic_stats AS (
    -- 获取每个话题的统计信息
    SELECT 
      ut.id as topic_id,
      COUNT(DISTINCT c.id) as comment_count,
      COUNT(DISTINCT cm.user_id) + 1 as participant_count, -- +1 for topic creator
      MAX(cm.created_at) as last_message_time,
      (SELECT message FROM chat_messages WHERE topic_id = ut.id ORDER BY chat_messages.created_at DESC LIMIT 1) as last_message_preview
    FROM user_topics ut
    LEFT JOIN comments c ON ut.id = c.topic_id
    LEFT JOIN chat_messages cm ON ut.id = cm.topic_id
    GROUP BY ut.id
  )
  SELECT 
    ut.id,
    ut.title,
    ut.description,
    ut.user_id,
    ut.latitude,
    ut.longitude,
    ut.location_name,
    ut.created_at,
    ut.image_url,
    ut.image_aspect_ratio,
    ut.original_width,
    ut.original_height,
    u.nickname as user_nickname,
    u.avatar_url as user_avatar_url,
    u.email as user_email,
    COALESCE(ts.comment_count, 0) as comment_count,
    COALESCE(ts.participant_count, 1) as participant_count,
    ts.last_message_time,
    ts.last_message_preview,
    ut.is_creator,
    ut.is_participant,
    ut.participant_joined_at as joined_at
  FROM user_topics ut
  JOIN users u ON ut.user_id = u.id
  JOIN topic_stats ts ON ut.id = ts.topic_id
  ORDER BY 
    -- 参与的话题优先
    CASE WHEN ut.is_creator OR ut.is_participant THEN 0 ELSE 1 END,
    -- 有最新消息的优先
    ts.last_message_time DESC NULLS LAST,
    -- 最后按创建时间排序
    ut.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 重新创建计数函数
CREATE OR REPLACE FUNCTION get_user_chat_topics_count(
  user_id_param UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT t.id)
  INTO total_count
  FROM topics t
  LEFT JOIN topic_participants tp 
    ON t.id = tp.topic_id 
    AND tp.user_id = user_id_param 
    AND tp.is_active = TRUE
  WHERE (t.user_id = user_id_param OR tp.user_id IS NOT NULL);
    
  RETURN total_count;
END;
$$;