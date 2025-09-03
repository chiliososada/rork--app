-- ============================================
-- 自動参加システムのクリーンアップ
-- 2025-09-02
-- ============================================
-- 
-- 目的: 既存の自動参加関数とトリガーを完全に削除
-- 実行前に: 重要なデータのバックアップを確認してください
-- 実行順序: このファイルを最初に実行してから、次のマイグレーションを実行
-- 
-- ============================================

-- 実行前の確認とログ
SELECT 
    'クリーンアップ開始' as status,
    'Cleanup started at: ' || NOW()::text as message;

-- ============================================
-- 1. 既存トリガーの削除
-- ============================================
DO $$
BEGIN
    -- トリガー削除のログ出力
    RAISE NOTICE '🗑️ 既存のトリガーを削除中...';
    
    -- chat_messages テーブルのトリガー
    DROP TRIGGER IF EXISTS auto_join_on_chat_message ON chat_messages;
    RAISE NOTICE '   ✅ auto_join_on_chat_message トリガーを削除';
    
    -- comments テーブルのトリガー
    DROP TRIGGER IF EXISTS auto_join_on_comment ON comments;
    RAISE NOTICE '   ✅ auto_join_on_comment トリガーを削除';
    
    -- topics テーブルのトリガー
    DROP TRIGGER IF EXISTS auto_join_on_topic_create ON topics;
    RAISE NOTICE '   ✅ auto_join_on_topic_create トリガーを削除';
    
    -- topic_likes テーブルのトリガー
    DROP TRIGGER IF EXISTS auto_join_on_topic_like ON topic_likes;
    RAISE NOTICE '   ✅ auto_join_on_topic_like トリガーを削除';
    
    -- その他の可能性のあるトリガー
    DROP TRIGGER IF EXISTS auto_join_on_like ON topic_likes;
    RAISE NOTICE '   ✅ auto_join_on_like トリガーを削除（存在する場合）';
    
END $$;

-- ============================================
-- 2. 既存トリガー関数の削除
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '🗑️ 既存のトリガー関数を削除中...';
    
    DROP FUNCTION IF EXISTS trigger_auto_join_on_message();
    RAISE NOTICE '   ✅ trigger_auto_join_on_message() 関数を削除';
    
    DROP FUNCTION IF EXISTS trigger_auto_join_on_comment();
    RAISE NOTICE '   ✅ trigger_auto_join_on_comment() 関数を削除';
    
    DROP FUNCTION IF EXISTS trigger_auto_join_on_topic_create();
    RAISE NOTICE '   ✅ trigger_auto_join_on_topic_create() 関数を削除';
    
    DROP FUNCTION IF EXISTS trigger_auto_join_on_like();
    RAISE NOTICE '   ✅ trigger_auto_join_on_like() 関数を削除';
    
END $$;

-- ============================================
-- 3. メイン関数の削除（戻り値型に関係なく）
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '🗑️ メインの auto_join_topic 関数を削除中...';
    
    -- BOOLEAN版を削除
    DROP FUNCTION IF EXISTS auto_join_topic(UUID, UUID);
    RAISE NOTICE '   ✅ auto_join_topic(UUID, UUID) -> BOOLEAN 版を削除';
    
    -- JSONB版も削除（存在する場合）
    DROP FUNCTION IF EXISTS auto_join_topic(UUID, UUID) CASCADE;
    RAISE NOTICE '   ✅ auto_join_topic(UUID, UUID) -> JSONB 版を削除（CASCADE）';
    
    -- パラメータ名付きの関数も削除
    DROP FUNCTION IF EXISTS auto_join_topic(p_user_id UUID, p_topic_id UUID);
    RAISE NOTICE '   ✅ auto_join_topic(p_user_id UUID, p_topic_id UUID) 版を削除';
    
    DROP FUNCTION IF EXISTS auto_join_topic(user_id_param UUID, topic_id_param UUID);
    RAISE NOTICE '   ✅ auto_join_topic(user_id_param UUID, topic_id_param UUID) 版を削除';
    
END $$;

-- ============================================
-- 4. その他の関連関数の削除
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '🗑️ その他の関連関数を削除中...';
    
    DROP FUNCTION IF EXISTS repair_missing_participants();
    RAISE NOTICE '   ✅ repair_missing_participants() 関数を削除';
    
    -- もし古いバージョンがあれば
    DROP FUNCTION IF EXISTS fix_missing_participants();
    RAISE NOTICE '   ✅ fix_missing_participants() 関数を削除（存在する場合）';
    
END $$;

-- ============================================
-- 5. 関連ビューの削除
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '🗑️ 関連ビューを削除中...';
    
    DROP VIEW IF EXISTS topic_participation_stats;
    RAISE NOTICE '   ✅ topic_participation_stats ビューを削除';
    
END $$;

-- ============================================
-- 6. 削除後の確認
-- ============================================

-- 残存トリガーの確認
SELECT 
    '削除後のトリガー確認' as check_type,
    COUNT(*) as remaining_triggers
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name LIKE '%auto_join%';

-- 残存関数の確認
SELECT 
    '削除後の関数確認' as check_type,
    COUNT(*) as remaining_functions
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE '%auto_join%';

-- 残存関数の詳細リスト（もしあれば）
SELECT 
    '残存関数の詳細' as info,
    routine_name,
    data_type as return_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE '%auto_join%';

-- ============================================
-- 7. topic_participants テーブルの確認
-- ============================================

-- テーブル構造は保持されているか確認
SELECT 
    'topic_participants テーブル確認' as check_type,
    COUNT(*) as record_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT topic_id) as unique_topics,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_participants
FROM topic_participants;

-- ============================================
-- 8. 完了メッセージ
-- ============================================
SELECT 
    'クリーンアップ完了' as status,
    'すべての自動参加関数とトリガーが削除されました。次のマイグレーションを実行してください。' as message,
    NOW()::text as completed_at;

-- ============================================
-- 重要な注意事項
-- ============================================
/*
⚠️ 重要な注意事項:

1. このスクリプトは既存の自動参加システムを完全に削除します
2. topic_participants テーブルのデータは保持されます
3. このスクリプト実行後は、手動で参加者を追加する必要があります
4. 次のマイグレーション (20250902_auto_join_final.sql) を続けて実行してください

📋 次の手順:
1. このクリーンアップスクリプトを実行
2. エラーがないことを確認
3. 20250902_auto_join_final.sql を実行
4. テスト用のメッセージを送信して動作確認

🔍 トラブルシューティング:
- まだエラーが発生する場合は、Supabase ダッシュボードの SQL エディタで
  手動で関数を確認・削除してください
- テーブル依存関係エラーが出る場合は、CASCADE オプションを使用してください
*/