-- ============================================
-- 自動参加システム検証スクリプト
-- 2025-09-02
-- ============================================
-- 
-- 目的: 自動参加システムが正しく動作しているかを簡単に確認
-- 使用方法: このスクリプトをSupabase SQL Editorで実行
-- 
-- ============================================

-- 検証開始メッセージ
SELECT '🧪 自動参加システムの検証を開始します' as status, NOW()::text as started_at;

-- ============================================
-- 1. システム構成の確認
-- ============================================

-- インストールされたトリガーの確認
SELECT 
    '📋 インストール済みトリガー' as check_type,
    trigger_name,
    event_object_table as target_table,
    action_timing || ' ' || event_manipulation as trigger_event
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name LIKE 'auto_join_%'
ORDER BY event_object_table, trigger_name;

-- インストールされた関数の確認
SELECT 
    '🔧 インストール済み関数' as check_type,
    routine_name as function_name,
    data_type as return_type,
    CASE 
        WHEN routine_name LIKE 'trigger_%' THEN 'Trigger Function'
        WHEN routine_name = 'auto_join_topic' THEN 'Main Function'
        WHEN routine_name = 'repair_missing_participants' THEN 'Utility Function'
        ELSE 'Other Function'
    END as function_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND (routine_name LIKE '%auto_join%' OR routine_name = 'repair_missing_participants')
ORDER BY function_type, routine_name;

-- ============================================
-- 2. テーブル構造の確認
-- ============================================

-- topic_participants テーブルの構造確認
SELECT 
    '📊 topic_participants テーブル構造' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'topic_participants'
ORDER BY ordinal_position;

-- ============================================
-- 3. 現在のデータ状況
-- ============================================

-- 全体統計
SELECT 
    '📈 現在のデータ統計' as info,
    COUNT(*) as total_participants,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT topic_id) as unique_topics,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_participants,
    ROUND(
        COUNT(CASE WHEN is_active = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 
        2
    ) as active_percentage
FROM topic_participants;

-- ============================================
-- 4. 実際のテスト実行
-- ============================================

-- テスト用データの準備
WITH test_data AS (
    SELECT 
        u.id as user_id,
        u.nickname,
        t.id as topic_id,
        t.title
    FROM users u
    CROSS JOIN topics t
    WHERE NOT EXISTS (
        SELECT 1 FROM topic_participants tp 
        WHERE tp.user_id = u.id AND tp.topic_id = t.id
    )
    LIMIT 1
)
SELECT 
    '🎯 テスト対象データ' as test_info,
    user_id,
    nickname as user_name,
    topic_id,
    title as topic_name
FROM test_data;

-- auto_join_topic 関数の直接テスト
DO $$
DECLARE
    test_user_id UUID;
    test_topic_id UUID;
    result JSONB;
BEGIN
    -- テスト用のユーザーと話題を取得
    SELECT u.id, t.id INTO test_user_id, test_topic_id
    FROM users u
    CROSS JOIN topics t
    WHERE NOT EXISTS (
        SELECT 1 FROM topic_participants tp 
        WHERE tp.user_id = u.id AND tp.topic_id = t.id
    )
    LIMIT 1;
    
    IF test_user_id IS NOT NULL AND test_topic_id IS NOT NULL THEN
        -- 関数を直接テスト
        result := auto_join_topic(test_user_id, test_topic_id);
        
        RAISE NOTICE '🧪 auto_join_topic 関数テスト結果: %', result;
        
        -- 結果を確認
        IF (result->>'success')::boolean THEN
            RAISE NOTICE '✅ 関数テスト成功: %', result->>'action';
        ELSE
            RAISE WARNING '❌ 関数テスト失敗: %', result->>'message';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ テスト用データが見つかりません（全ユーザーが全話題に参加済み？）';
    END IF;
END $$;

-- ============================================
-- 5. トリガーテスト
-- ============================================

-- テストメッセージの送信（トリガーをテスト）
DO $$
DECLARE
    test_user_id UUID;
    test_topic_id UUID;
    test_message_id UUID;
    participant_count_before INTEGER;
    participant_count_after INTEGER;
BEGIN
    -- 既存の未参加ユーザーと話題の組み合わせを探す
    SELECT u.id, t.id INTO test_user_id, test_topic_id
    FROM users u
    CROSS JOIN topics t
    WHERE NOT EXISTS (
        SELECT 1 FROM topic_participants tp 
        WHERE tp.user_id = u.id AND tp.topic_id = t.id
    )
    LIMIT 1;
    
    IF test_user_id IS NOT NULL AND test_topic_id IS NOT NULL THEN
        -- 参加前の状態
        SELECT COUNT(*) INTO participant_count_before
        FROM topic_participants 
        WHERE user_id = test_user_id AND topic_id = test_topic_id;
        
        RAISE NOTICE '🧪 トリガーテスト開始 - user: %, topic: %, 参加前: %', 
                     test_user_id, test_topic_id, participant_count_before;
        
        -- テストメッセージを送信（これによりトリガーが発動するはず）
        INSERT INTO chat_messages (user_id, topic_id, message)
        VALUES (test_user_id, test_topic_id, '🧪 自動参加システムテストメッセージ - ' || NOW()::text)
        RETURNING id INTO test_message_id;
        
        -- 少し待つ（トリガーの実行を待つ）
        PERFORM pg_sleep(0.1);
        
        -- 参加後の状態
        SELECT COUNT(*) INTO participant_count_after
        FROM topic_participants 
        WHERE user_id = test_user_id AND topic_id = test_topic_id;
        
        RAISE NOTICE '✅ テストメッセージ送信完了 - message_id: %, 参加後: %', 
                     test_message_id, participant_count_after;
        
        -- 結果の判定
        IF participant_count_after > participant_count_before THEN
            RAISE NOTICE '🎉 トリガーテスト成功！ 自動参加が動作しています';
        ELSE
            RAISE WARNING '❌ トリガーテスト失敗！ 自動参加が動作していません';
        END IF;
        
    ELSE
        RAISE NOTICE '⚠️ トリガーテスト用データが見つかりません';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '❌ トリガーテスト中にエラー: %', SQLERRM;
END $$;

-- ============================================
-- 6. 最新の参加者活動の確認
-- ============================================

-- 最近の参加者（直近10件）
SELECT 
    '👥 最新の参加者（直近10件）' as info,
    tp.joined_at,
    u.nickname as user_name,
    t.title as topic_name,
    tp.is_active,
    '⏰ ' || EXTRACT(EPOCH FROM (NOW() - tp.joined_at))::INTEGER || '秒前' as joined_ago
FROM topic_participants tp
JOIN users u ON u.id = tp.user_id
JOIN topics t ON t.id = tp.topic_id
ORDER BY tp.joined_at DESC
LIMIT 10;

-- ============================================
-- 7. システム健全性チェック
-- ============================================

-- 孤立した参加者レコード（存在しないユーザーや話題を参照）
SELECT 
    '🔍 データ整合性チェック' as check_type,
    'orphaned_participants' as issue_type,
    COUNT(*) as count
FROM topic_participants tp
LEFT JOIN users u ON u.id = tp.user_id
LEFT JOIN topics t ON t.id = tp.topic_id
WHERE u.id IS NULL OR t.id IS NULL;

-- 重複参加者レコード
SELECT 
    '🔍 データ整合性チェック' as check_type,
    'duplicate_participants' as issue_type,
    COUNT(*) - COUNT(DISTINCT (user_id, topic_id)) as count
FROM topic_participants;

-- ============================================
-- 8. パフォーマンスチェック
-- ============================================

-- インデックスの確認
SELECT 
    '⚡ インデックス確認' as check_type,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'topic_participants'
    AND schemaname = 'public'
ORDER BY indexname;

-- ============================================
-- 9. 統計ビューの確認
-- ============================================

-- topic_participation_stats ビューの動作確認
SELECT 
    '📊 統計ビュー確認（トップ5話題）' as info,
    topic_id,
    title,
    active_participants,
    message_count,
    comment_count,
    like_count
FROM topic_participation_stats
WHERE active_participants > 0
ORDER BY active_participants DESC, message_count DESC
LIMIT 5;

-- ============================================
-- 10. 最終検証結果
-- ============================================

-- 最終チェックサマリー
WITH system_check AS (
    SELECT 
        (SELECT COUNT(*) FROM information_schema.triggers 
         WHERE trigger_schema = 'public' AND trigger_name LIKE 'auto_join_%') as trigger_count,
        (SELECT COUNT(*) FROM information_schema.routines 
         WHERE routine_schema = 'public' AND routine_name LIKE '%auto_join%') as function_count,
        (SELECT COUNT(*) FROM topic_participants) as participant_count,
        (SELECT COUNT(DISTINCT user_id) FROM topic_participants) as unique_users,
        (SELECT COUNT(DISTINCT topic_id) FROM topic_participants) as unique_topics
)
SELECT 
    '🏁 最終検証結果' as summary,
    CASE 
        WHEN trigger_count >= 4 AND function_count >= 4 THEN '✅ システム正常'
        ELSE '❌ システム不完全'
    END as system_status,
    trigger_count || ' トリガー' as triggers,
    function_count || ' 関数' as functions,
    participant_count || ' 参加記録' as participants,
    unique_users || ' ユーザー' as users,
    unique_topics || ' 話題' as topics
FROM system_check;

-- 完了メッセージ
SELECT 
    '🎉 検証完了' as status,
    '上記の結果を確認してください。エラーがある場合はAUTO_JOIN_SETUP_GUIDE.mdを参照してください。' as message,
    NOW()::text as completed_at;

-- ============================================
-- 補足: 次のステップ
-- ============================================

/*
📋 検証後の確認事項:

✅ 成功の場合:
- システムステータスが「✅ システム正常」
- トリガーが4個以上
- 関数が4個以上
- テストメッセージで自動参加が動作

❌ 失敗の場合:
1. AUTO_JOIN_SETUP_GUIDE.md のトラブルシューティングを確認
2. エラーメッセージを記録
3. 必要に応じてクリーンアップから再実行

📱 アプリケーション側の確認:
1. React Nativeアプリを再起動
2. 新しいメッセージを送信
3. topic_participants テーブルで自動参加を確認
4. リアルタイム接続ログを確認

🚀 本番運用準備:
- いいね時の自動参加が必要かどうか決定
- パフォーマンス監視の設定
- ログレベルの調整（本番では NOTICE レベルを下げることを推奨）
*/