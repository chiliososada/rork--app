-- Smart Tag System Permissions
-- TokyoPark智能标签系统权限设置

-- Grant execute permissions on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION search_tags(TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_location_based_tags(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_time_based_tags(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_smart_tag_recommendations(UUID, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION record_tag_usage(UUID, TEXT[], DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION normalize_tag(TEXT) TO authenticated;

-- Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON TABLE custom_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE user_tag_preferences TO authenticated;
GRANT SELECT, INSERT ON TABLE location_tag_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE time_based_tag_stats TO authenticated;

-- Grant usage on sequences (for UUID generation)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Enable RLS (Row Level Security) on new tables
ALTER TABLE custom_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tag_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_tag_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_based_tag_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (remove existing policies first to avoid conflicts)

-- custom_tags: Users can read all tags, but only update their own
DROP POLICY IF EXISTS "custom_tags_select_policy" ON custom_tags;
DROP POLICY IF EXISTS "custom_tags_insert_policy" ON custom_tags;
DROP POLICY IF EXISTS "custom_tags_update_policy" ON custom_tags;

CREATE POLICY "custom_tags_select_policy" ON custom_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_tags_insert_policy" ON custom_tags FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "custom_tags_update_policy" ON custom_tags FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- user_tag_preferences: Users can only access their own preferences
DROP POLICY IF EXISTS "user_tag_preferences_select_policy" ON user_tag_preferences;
DROP POLICY IF EXISTS "user_tag_preferences_insert_policy" ON user_tag_preferences;
DROP POLICY IF EXISTS "user_tag_preferences_update_policy" ON user_tag_preferences;

CREATE POLICY "user_tag_preferences_select_policy" ON user_tag_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_tag_preferences_insert_policy" ON user_tag_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_tag_preferences_update_policy" ON user_tag_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- location_tag_stats: All users can read and insert (for recommendations and recording)
DROP POLICY IF EXISTS "location_tag_stats_select_policy" ON location_tag_stats;
DROP POLICY IF EXISTS "location_tag_stats_insert_policy" ON location_tag_stats;

CREATE POLICY "location_tag_stats_select_policy" ON location_tag_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "location_tag_stats_insert_policy" ON location_tag_stats FOR INSERT TO authenticated WITH CHECK (true);

-- time_based_tag_stats: All users can read, insert and update (for recommendations and recording)
DROP POLICY IF EXISTS "time_based_tag_stats_select_policy" ON time_based_tag_stats;
DROP POLICY IF EXISTS "time_based_tag_stats_insert_policy" ON time_based_tag_stats;
DROP POLICY IF EXISTS "time_based_tag_stats_update_policy" ON time_based_tag_stats;

CREATE POLICY "time_based_tag_stats_select_policy" ON time_based_tag_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "time_based_tag_stats_insert_policy" ON time_based_tag_stats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "time_based_tag_stats_update_policy" ON time_based_tag_stats FOR UPDATE TO authenticated USING (true);