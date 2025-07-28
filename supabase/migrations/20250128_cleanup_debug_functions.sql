-- Cleanup Debug Functions
-- デバッグ関数のクリーンアップ

-- Remove debug RPC function that was created for testing
-- テスト用に作成されたデバッグRPC関数を削除
DROP FUNCTION IF EXISTS get_smart_tag_recommendations_debug(UUID, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);