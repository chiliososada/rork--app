-- Fix Missing Constraints for Smart Tag System
-- 智能标签系统缺失约束修复

-- Add missing unique constraint to tag_usage_stats if it doesn't exist
DO $$ 
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tag_usage_stats_tag_category_unique' 
    AND table_name = 'tag_usage_stats'
  ) THEN
    -- Add the unique constraint
    ALTER TABLE tag_usage_stats 
    ADD CONSTRAINT tag_usage_stats_tag_category_unique 
    UNIQUE (tag_name, category);
  END IF;
END $$;

-- Ensure all tables have proper constraints

-- Check and add constraint for custom_tags if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'custom_tags_normalized_name_key' 
    AND table_name = 'custom_tags'
  ) THEN
    -- This should already exist from the original migration, but just in case
    ALTER TABLE custom_tags 
    ADD CONSTRAINT custom_tags_normalized_name_key 
    UNIQUE (normalized_name);
  END IF;
END $$;

-- Check and add constraint for user_tag_preferences if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_tag_preferences_user_tag_unique' 
    AND table_name = 'user_tag_preferences'
  ) THEN
    ALTER TABLE user_tag_preferences 
    ADD CONSTRAINT user_tag_preferences_user_tag_unique 
    UNIQUE (user_id, tag_name);
  END IF;
END $$;

-- Check and add constraint for time_based_tag_stats if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'time_based_tag_stats_tag_time_unique' 
    AND table_name = 'time_based_tag_stats'
  ) THEN
    ALTER TABLE time_based_tag_stats 
    ADD CONSTRAINT time_based_tag_stats_tag_time_unique 
    UNIQUE (tag_name, hour_of_day, day_of_week);
  END IF;
END $$;