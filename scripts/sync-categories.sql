-- 统一CategoryBadge与数据库类别系统
-- 确保数据库包含所有必要的类别配置

-- 首先清理可能存在的重复数据
-- DELETE FROM category_configs WHERE category_key IN ('recommended', 'nearby', 'trending', 'new', 'food', 'event', 'shopping', 'work', 'lifestyle', 'social');

-- 插入标准类别配置（如果不存在的话）
INSERT INTO category_configs (category_key, display_name, icon_emoji, color_code, commercial_priority, is_active, sort_order)
VALUES 
  ('recommended', 'おすすめ', '✨', '#FF6B6B', 100, true, 1),
  ('nearby', '近くの話題', '📍', '#4ECDC4', 90, true, 2),
  ('trending', 'トレンド', '🔥', '#FFE66D', 95, true, 3),
  ('new', '新着', '🆕', '#95E1D3', 80, true, 4),
  ('food', 'グルメ', '🍽️', '#F38181', 70, true, 5),
  ('event', 'イベント', '🎉', '#AA96DA', 60, true, 6),
  ('shopping', 'ショッピング', '🛍️', '#FCBAD3', 50, true, 7),
  ('work', '仕事', '💼', '#3B82F6', 40, true, 8),
  ('lifestyle', 'ライフスタイル', '🌿', '#059669', 30, true, 9),
  ('social', '交流', '👥', '#7C3AED', 20, true, 10)
ON CONFLICT (category_key) 
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  icon_emoji = EXCLUDED.icon_emoji,
  color_code = EXCLUDED.color_code,
  commercial_priority = EXCLUDED.commercial_priority,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- 检查是否有话题使用了无效的类别
-- 这个查询将显示所有使用了数据库中不存在类别的话题
SELECT 
  t.id,
  t.title,
  t.category,
  'Invalid category - not in category_configs' as issue
FROM topics t
LEFT JOIN category_configs cc ON t.category = cc.category_key
WHERE t.category IS NOT NULL 
  AND t.category != ''
  AND cc.category_key IS NULL;

-- 可选：清理无效类别的话题（取消注释下面的SQL来执行）
-- UPDATE topics 
-- SET category = NULL 
-- WHERE category IS NOT NULL 
--   AND category != ''
--   AND category NOT IN (SELECT category_key FROM category_configs WHERE is_active = true);

-- 验证类别配置是否正确插入
SELECT 
  category_key,
  display_name,
  icon_emoji,
  color_code,
  commercial_priority,
  is_active,
  sort_order
FROM category_configs 
WHERE is_active = true
ORDER BY sort_order;