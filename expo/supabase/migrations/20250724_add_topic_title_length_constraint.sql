-- 为话题标题添加长度约束
-- 限制标题最大长度为50字符，确保移动端显示友好

-- 添加CHECK约束限制标题长度
ALTER TABLE public.topics 
ADD CONSTRAINT topic_title_length_check 
CHECK (char_length(title) <= 50 AND char_length(title) > 0);

-- 添加索引以提高标题搜索性能
CREATE INDEX IF NOT EXISTS topics_title_idx ON public.topics(title);

-- 注释说明
COMMENT ON CONSTRAINT topic_title_length_check ON public.topics IS '话题标题长度限制：1-50字符';