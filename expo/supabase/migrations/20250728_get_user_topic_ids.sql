-- 创建获取用户所有相关topic ID的RPC函数
CREATE OR REPLACE FUNCTION get_user_topic_ids(user_id_param UUID)
RETURNS TABLE (topic_id UUID)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- 用户创建的topics
  SELECT t.id as topic_id
  FROM topics t
  WHERE t.user_id = user_id_param
    AND (t.is_hidden IS NULL OR t.is_hidden = false)
  
  UNION
  
  -- 用户参与的topics
  SELECT tp.topic_id
  FROM topic_participants tp
  JOIN topics t ON t.id = tp.topic_id
  WHERE tp.user_id = user_id_param
    AND tp.is_active = true
    AND (t.is_hidden IS NULL OR t.is_hidden = false);
END;
$$;