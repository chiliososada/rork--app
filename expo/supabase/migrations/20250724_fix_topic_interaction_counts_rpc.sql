-- 修复 get_topic_interaction_counts RPC 函数
-- 这个函数用于批量获取话题的交互统计数据

-- 先删除可能存在的旧版本
DROP FUNCTION IF EXISTS get_topic_interaction_counts(UUID[]);
DROP FUNCTION IF EXISTS get_topic_interaction_counts(TEXT[]);

-- 创建新版本的函数（修复列名歧义）
CREATE OR REPLACE FUNCTION get_topic_interaction_counts(topic_ids UUID[])
RETURNS TABLE (
  topic_id UUID,
  likes_count INTEGER,
  favorites_count INTEGER,
  comments_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as topic_id,
    COALESCE(likes.count, 0)::INTEGER as likes_count,
    COALESCE(favorites.count, 0)::INTEGER as favorites_count,
    COALESCE(comments.count, 0)::INTEGER as comments_count
  FROM 
    unnest(topic_ids) AS t(id)
  LEFT JOIN (
    SELECT tl.topic_id, COUNT(*)::INTEGER as count
    FROM topic_likes tl
    WHERE tl.topic_id = ANY(topic_ids)
    GROUP BY tl.topic_id
  ) likes ON t.id = likes.topic_id
  LEFT JOIN (
    SELECT tf.topic_id, COUNT(*)::INTEGER as count
    FROM topic_favorites tf
    WHERE tf.topic_id = ANY(topic_ids)
    GROUP BY tf.topic_id
  ) favorites ON t.id = favorites.topic_id
  LEFT JOIN (
    SELECT c.topic_id, COUNT(*)::INTEGER as count
    FROM comments c
    WHERE c.topic_id = ANY(topic_ids)
    GROUP BY c.topic_id
  ) comments ON t.id = comments.topic_id;
END;
$$;

-- 确保匿名用户可以调用这个函数
GRANT EXECUTE ON FUNCTION get_topic_interaction_counts(UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION get_topic_interaction_counts(UUID[]) TO authenticated;

-- 测试函数是否工作
-- 注释掉的测试查询，可以在 Supabase SQL Editor 中手动运行
-- SELECT * FROM get_topic_interaction_counts(ARRAY[]::UUID[]);