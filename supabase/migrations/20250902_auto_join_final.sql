-- ============================================
-- 自動参加システム - 最終版
-- 2025-09-02 Final Implementation
-- ============================================
-- 
-- 前提条件: 20250902_cleanup_auto_join.sql を先に実行済み
-- 目的: 安定した自動参加システムの構築
-- 
-- 機能:
-- - チャットメッセージ送信時の自動参加
-- - コメント投稿時の自動参加  
-- - 話題作成時の自動参加（作成者）
-- - いいね時の自動参加（オプション）
-- - 既存データの修復機能
-- - 詳細なログ出力とエラーハンドリング
-- 
-- ============================================

-- 開始ログ
SELECT 
    '🚀 自動参加システム最終版のインストール開始' as status,
    NOW()::text as started_at;

-- ============================================
-- 1. メイン関数: auto_join_topic
-- ============================================
CREATE OR REPLACE FUNCTION auto_join_topic(
    p_user_id UUID,
    p_topic_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_existing_record RECORD;
    v_participant_id UUID;
    v_user_exists BOOLEAN;
    v_topic_exists BOOLEAN;
    v_function_start_time TIMESTAMP;
BEGIN
    v_function_start_time := NOW();
    
    -- 入力パラメータのログ
    RAISE NOTICE '[auto_join_topic] 開始 - user_id: %, topic_id: %', p_user_id, p_topic_id;
    
    -- ====================================
    -- 基本的な検証
    -- ====================================
    
    -- NULL チェック
    IF p_user_id IS NULL OR p_topic_id IS NULL THEN
        RAISE WARNING '[auto_join_topic] 無効なパラメータ: user_id=%, topic_id=%', p_user_id, p_topic_id;
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_PARAMS',
            'message', 'user_id または topic_id が NULL です',
            'user_id', p_user_id,
            'topic_id', p_topic_id,
            'timestamp', v_function_start_time
        );
    END IF;

    -- ユーザー存在チェック
    SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
        RAISE WARNING '[auto_join_topic] ユーザーが存在しません: user_id=%', p_user_id;
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'USER_NOT_FOUND',
            'message', '指定されたユーザーが存在しません',
            'user_id', p_user_id,
            'topic_id', p_topic_id,
            'timestamp', v_function_start_time
        );
    END IF;

    -- 話題存在チェック
    SELECT EXISTS(SELECT 1 FROM topics WHERE id = p_topic_id AND (is_hidden IS NULL OR is_hidden = false)) INTO v_topic_exists;
    IF NOT v_topic_exists THEN
        RAISE WARNING '[auto_join_topic] 話題が存在しないか非表示です: topic_id=%', p_topic_id;
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOPIC_NOT_FOUND',
            'message', '指定された話題が存在しないか、非表示になっています',
            'user_id', p_user_id,
            'topic_id', p_topic_id,
            'timestamp', v_function_start_time
        );
    END IF;

    -- ====================================
    -- 参加状態の確認と処理
    -- ====================================

    -- 既存の参加記録をチェック
    SELECT * INTO v_existing_record
    FROM topic_participants
    WHERE user_id = p_user_id AND topic_id = p_topic_id;

    IF FOUND THEN
        -- 既存レコードがある場合
        IF v_existing_record.is_active THEN
            -- 既にアクティブな参加者
            RAISE NOTICE '[auto_join_topic] ユーザーは既にアクティブな参加者: user_id=%, topic_id=%', p_user_id, p_topic_id;
            v_result := jsonb_build_object(
                'success', true,
                'action', 'already_active',
                'message', 'ユーザーは既にアクティブな参加者です',
                'participant_id', v_existing_record.id,
                'joined_at', v_existing_record.joined_at,
                'execution_time_ms', EXTRACT(MILLISECONDS FROM (NOW() - v_function_start_time))
            );
        ELSE
            -- 非アクティブな参加者を再アクティブ化
            UPDATE topic_participants
            SET is_active = TRUE,
                joined_at = NOW()
            WHERE id = v_existing_record.id
            RETURNING id INTO v_participant_id;
            
            RAISE NOTICE '[auto_join_topic] 参加者を再アクティブ化: user_id=%, topic_id=%, participant_id=%', 
                         p_user_id, p_topic_id, v_participant_id;
            
            v_result := jsonb_build_object(
                'success', true,
                'action', 'reactivated',
                'message', '非アクティブな参加者を再アクティブ化しました',
                'participant_id', v_participant_id,
                'joined_at', NOW(),
                'execution_time_ms', EXTRACT(MILLISECONDS FROM (NOW() - v_function_start_time))
            );
        END IF;
    ELSE
        -- 新規参加者として追加
        INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
        VALUES (p_user_id, p_topic_id, TRUE, NOW())
        RETURNING id INTO v_participant_id;
        
        RAISE NOTICE '[auto_join_topic] 新規参加者を追加: user_id=%, topic_id=%, participant_id=%', 
                     p_user_id, p_topic_id, v_participant_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'joined',
            'message', '新規参加者として追加しました',
            'participant_id', v_participant_id,
            'joined_at', NOW(),
            'execution_time_ms', EXTRACT(MILLISECONDS FROM (NOW() - v_function_start_time))
        );
    END IF;

    RETURN v_result;

EXCEPTION
    WHEN unique_violation THEN
        -- 同時実行による重複エラー（正常な状況）
        RAISE NOTICE '[auto_join_topic] 同時実行による重複 - user_id=%, topic_id=%', p_user_id, p_topic_id;
        RETURN jsonb_build_object(
            'success', true,
            'action', 'concurrent_join',
            'message', '同時実行により既に参加済みです',
            'user_id', p_user_id,
            'topic_id', p_topic_id,
            'execution_time_ms', EXTRACT(MILLISECONDS FROM (NOW() - v_function_start_time))
        );
    WHEN OTHERS THEN
        -- その他の予期しないエラー
        RAISE EXCEPTION '[auto_join_topic] 予期しないエラー - user_id=%, topic_id=%, error=%', 
                    p_user_id, p_topic_id, SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNEXPECTED_ERROR',
            'error', SQLERRM,
            'message', '参加処理中に予期しないエラーが発生しました',
            'user_id', p_user_id,
            'topic_id', p_topic_id,
            'execution_time_ms', EXTRACT(MILLISECONDS FROM (NOW() - v_function_start_time))
        );
END;
$$;

-- ============================================
-- 2. トリガー関数: チャットメッセージ送信時
-- ============================================
CREATE OR REPLACE FUNCTION trigger_auto_join_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- トリガー開始ログ
    RAISE NOTICE '[trigger_auto_join_on_message] 開始 - message_id=%, user_id=%, topic_id=%', 
                 NEW.id, NEW.user_id, NEW.topic_id;
    
    -- 自動参加処理を実行
    v_result := auto_join_topic(NEW.user_id, NEW.topic_id);
    
    -- 結果のログ出力
    IF (v_result->>'success')::boolean THEN
        RAISE NOTICE '[trigger_auto_join_on_message] 成功 - action=%, message_id=%', 
                     v_result->>'action', NEW.id;
    ELSE
        RAISE WARNING '[trigger_auto_join_on_message] 失敗 - error=%, message_id=%', 
                      v_result->>'message', NEW.id;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- トリガーエラーはレコード挿入を阻害しないよう警告レベルで記録
        RAISE WARNING '[trigger_auto_join_on_message] トリガーエラー - message_id=%, error=%', 
                      NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- ============================================
-- 3. トリガー関数: コメント投稿時
-- ============================================
CREATE OR REPLACE FUNCTION trigger_auto_join_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    RAISE NOTICE '[trigger_auto_join_on_comment] 開始 - comment_id=%, user_id=%, topic_id=%', 
                 NEW.id, NEW.user_id, NEW.topic_id;
    
    v_result := auto_join_topic(NEW.user_id, NEW.topic_id);
    
    IF (v_result->>'success')::boolean THEN
        RAISE NOTICE '[trigger_auto_join_on_comment] 成功 - action=%, comment_id=%', 
                     v_result->>'action', NEW.id;
    ELSE
        RAISE WARNING '[trigger_auto_join_on_comment] 失敗 - error=%, comment_id=%', 
                      v_result->>'message', NEW.id;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[trigger_auto_join_on_comment] トリガーエラー - comment_id=%, error=%', 
                      NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- ============================================
-- 4. トリガー関数: 話題作成時
-- ============================================
CREATE OR REPLACE FUNCTION trigger_auto_join_on_topic_create()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    RAISE NOTICE '[trigger_auto_join_on_topic_create] 開始 - topic_id=%, creator_id=%', 
                 NEW.id, NEW.user_id;
    
    v_result := auto_join_topic(NEW.user_id, NEW.id);
    
    IF (v_result->>'success')::boolean THEN
        RAISE NOTICE '[trigger_auto_join_on_topic_create] 成功 - action=%, topic_id=%', 
                     v_result->>'action', NEW.id;
    ELSE
        RAISE WARNING '[trigger_auto_join_on_topic_create] 失敗 - error=%, topic_id=%', 
                      v_result->>'message', NEW.id;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[trigger_auto_join_on_topic_create] トリガーエラー - topic_id=%, error=%', 
                      NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- ============================================
-- 5. トリガー関数: いいね時（オプション）
-- ============================================
CREATE OR REPLACE FUNCTION trigger_auto_join_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    RAISE NOTICE '[trigger_auto_join_on_like] 開始 - like_id=%, user_id=%, topic_id=%', 
                 NEW.id, NEW.user_id, NEW.topic_id;
    
    v_result := auto_join_topic(NEW.user_id, NEW.topic_id);
    
    IF (v_result->>'success')::boolean THEN
        RAISE NOTICE '[trigger_auto_join_on_like] 成功 - action=%, like_id=%', 
                     v_result->>'action', NEW.id;
    ELSE
        RAISE NOTICE '[trigger_auto_join_on_like] スキップ - reason=%, like_id=%', 
                     v_result->>'message', NEW.id;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[trigger_auto_join_on_like] トリガーエラー - like_id=%, error=%', 
                      NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- ============================================
-- 6. トリガーの作成
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '🔧 トリガーを作成中...';
    
    -- メッセージ送信時の自動参加
    CREATE TRIGGER auto_join_on_chat_message
        AFTER INSERT ON chat_messages
        FOR EACH ROW
        EXECUTE FUNCTION trigger_auto_join_on_message();
    RAISE NOTICE '   ✅ auto_join_on_chat_message トリガー作成完了';

    -- コメント投稿時の自動参加
    CREATE TRIGGER auto_join_on_comment
        AFTER INSERT ON comments
        FOR EACH ROW
        EXECUTE FUNCTION trigger_auto_join_on_comment();
    RAISE NOTICE '   ✅ auto_join_on_comment トリガー作成完了';

    -- 話題作成時の自動参加
    CREATE TRIGGER auto_join_on_topic_create
        AFTER INSERT ON topics
        FOR EACH ROW
        EXECUTE FUNCTION trigger_auto_join_on_topic_create();
    RAISE NOTICE '   ✅ auto_join_on_topic_create トリガー作成完了';

    -- いいね時の自動参加（オプション - 必要に応じてコメントアウト可能）
    CREATE TRIGGER auto_join_on_topic_like
        AFTER INSERT ON topic_likes
        FOR EACH ROW
        EXECUTE FUNCTION trigger_auto_join_on_like();
    RAISE NOTICE '   ✅ auto_join_on_topic_like トリガー作成完了';
    
END $$;

-- ============================================
-- 7. データ修復関数
-- ============================================
CREATE OR REPLACE FUNCTION repair_missing_participants()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_repair_start_time TIMESTAMP;
    v_chat_count INTEGER := 0;
    v_comment_count INTEGER := 0;
    v_topic_count INTEGER := 0;
    v_like_count INTEGER := 0;
    v_total_before INTEGER := 0;
    v_total_after INTEGER := 0;
BEGIN
    v_repair_start_time := NOW();
    RAISE NOTICE '[repair_missing_participants] 修復開始: %', v_repair_start_time;

    -- 修復前の参加者数
    SELECT COUNT(*) INTO v_total_before FROM topic_participants;
    RAISE NOTICE '[repair_missing_participants] 修復前の参加者数: %', v_total_before;

    -- チャットメッセージから修復
    WITH missing_chat_participants AS (
        SELECT DISTINCT 
            cm.user_id,
            cm.topic_id,
            MIN(cm.created_at) as first_message_at
        FROM chat_messages cm
        LEFT JOIN topic_participants tp 
            ON tp.user_id = cm.user_id 
            AND tp.topic_id = cm.topic_id
        WHERE tp.id IS NULL
            AND cm.user_id IS NOT NULL
            AND cm.topic_id IS NOT NULL
            AND EXISTS(SELECT 1 FROM users WHERE id = cm.user_id)
            AND EXISTS(SELECT 1 FROM topics WHERE id = cm.topic_id)
        GROUP BY cm.user_id, cm.topic_id
    )
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT user_id, topic_id, TRUE, first_message_at
    FROM missing_chat_participants
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_chat_count = ROW_COUNT;
    RAISE NOTICE '[repair_missing_participants] チャットメッセージから修復: % 件', v_chat_count;

    -- コメントから修復
    WITH missing_comment_participants AS (
        SELECT DISTINCT 
            c.user_id,
            c.topic_id,
            MIN(c.created_at) as first_comment_at
        FROM comments c
        LEFT JOIN topic_participants tp 
            ON tp.user_id = c.user_id 
            AND tp.topic_id = c.topic_id
        WHERE tp.id IS NULL
            AND c.user_id IS NOT NULL
            AND c.topic_id IS NOT NULL
            AND EXISTS(SELECT 1 FROM users WHERE id = c.user_id)
            AND EXISTS(SELECT 1 FROM topics WHERE id = c.topic_id)
        GROUP BY c.user_id, c.topic_id
    )
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT user_id, topic_id, TRUE, first_comment_at
    FROM missing_comment_participants
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_comment_count = ROW_COUNT;
    RAISE NOTICE '[repair_missing_participants] コメントから修復: % 件', v_comment_count;

    -- 話題作成者から修復
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT DISTINCT 
        t.user_id,
        t.id,
        TRUE,
        t.created_at
    FROM topics t
    LEFT JOIN topic_participants tp 
        ON tp.user_id = t.user_id 
        AND tp.topic_id = t.id
    WHERE tp.id IS NULL
        AND t.user_id IS NOT NULL
        AND EXISTS(SELECT 1 FROM users WHERE id = t.user_id)
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_topic_count = ROW_COUNT;
    RAISE NOTICE '[repair_missing_participants] 話題作成者から修復: % 件', v_topic_count;

    -- いいねから修復（オプション）
    WITH missing_like_participants AS (
        SELECT DISTINCT 
            tl.user_id,
            tl.topic_id,
            MIN(tl.created_at) as first_like_at
        FROM topic_likes tl
        LEFT JOIN topic_participants tp 
            ON tp.user_id = tl.user_id 
            AND tp.topic_id = tl.topic_id
        WHERE tp.id IS NULL
            AND tl.user_id IS NOT NULL
            AND tl.topic_id IS NOT NULL
            AND EXISTS(SELECT 1 FROM users WHERE id = tl.user_id)
            AND EXISTS(SELECT 1 FROM topics WHERE id = tl.topic_id)
        GROUP BY tl.user_id, tl.topic_id
    )
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT user_id, topic_id, TRUE, first_like_at
    FROM missing_like_participants
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_like_count = ROW_COUNT;
    RAISE NOTICE '[repair_missing_participants] いいねから修復: % 件', v_like_count;

    -- 修復後の参加者数
    SELECT COUNT(*) INTO v_total_after FROM topic_participants;
    RAISE NOTICE '[repair_missing_participants] 修復完了 - 修復前: %, 修復後: %, 追加: %', 
                 v_total_before, v_total_after, (v_total_after - v_total_before);

    RETURN jsonb_build_object(
        'success', true,
        'repair_summary', jsonb_build_object(
            'before_count', v_total_before,
            'after_count', v_total_after,
            'total_added', v_total_after - v_total_before,
            'from_messages', v_chat_count,
            'from_comments', v_comment_count,
            'from_topics', v_topic_count,
            'from_likes', v_like_count
        ),
        'execution_time_ms', EXTRACT(MILLISECONDS FROM (NOW() - v_repair_start_time)),
        'timestamp', NOW()
    );
END;
$$;

-- ============================================
-- 8. 統計ビューの作成
-- ============================================
CREATE OR REPLACE VIEW topic_participation_stats AS
SELECT 
    t.id as topic_id,
    t.title,
    t.user_id as creator_id,
    u.nickname as creator_name,
    t.created_at as topic_created_at,
    COUNT(DISTINCT tp.user_id) FILTER (WHERE tp.is_active = true) as active_participants,
    COUNT(DISTINCT tp.user_id) as total_participants,
    COUNT(DISTINCT cm.id) as message_count,
    COUNT(DISTINCT c.id) as comment_count,
    COUNT(DISTINCT tl.id) as like_count,
    MAX(tp.joined_at) as last_join_date,
    GREATEST(MAX(cm.created_at), MAX(c.created_at)) as last_activity_at
FROM topics t
LEFT JOIN users u ON u.id = t.user_id
LEFT JOIN topic_participants tp ON tp.topic_id = t.id
LEFT JOIN chat_messages cm ON cm.topic_id = t.id
LEFT JOIN comments c ON c.topic_id = t.id
LEFT JOIN topic_likes tl ON tl.topic_id = t.id
WHERE (t.is_hidden IS NULL OR t.is_hidden = false)
GROUP BY t.id, t.title, t.user_id, u.nickname, t.created_at;

-- ============================================
-- 9. 既存データの修復実行
-- ============================================
SELECT '📊 修復前の統計' as info, * FROM (
    SELECT 
        COUNT(*) as total_participants,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT topic_id) as unique_topics,
        COUNT(CASE WHEN is_active THEN 1 END) as active_participants
    FROM topic_participants
) stats;

-- 修復実行
SELECT '🔧 既存データの修復を実行中...' as status;
SELECT repair_missing_participants();

-- 修復後の統計
SELECT '📊 修復後の統計' as info, * FROM (
    SELECT 
        COUNT(*) as total_participants,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT topic_id) as unique_topics,
        COUNT(CASE WHEN is_active THEN 1 END) as active_participants
    FROM topic_participants
) stats;

-- ============================================
-- 10. インストール確認
-- ============================================

-- トリガーの確認
SELECT 
    '✅ インストールされたトリガー' as info,
    trigger_name,
    event_object_table as target_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name LIKE 'auto_join_%'
ORDER BY event_object_table, trigger_name;

-- 関数の確認
SELECT 
    '✅ インストールされた関数' as info,
    routine_name as function_name,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE '%auto_join%'
ORDER BY routine_name;

-- 最終確認メッセージ
SELECT 
    '🎉 自動参加システムのインストールが完了しました' as status,
    '新しいメッセージ、コメント、話題作成時に自動参加機能が動作します' as message,
    NOW()::text as completed_at;

-- ============================================
-- 使用方法とテスト手順
-- ============================================
/*
🚀 インストール完了！

📋 テスト手順:
1. 新しいメッセージを送信してみてください
2. 新しいコメントを投稿してみてください
3. 新しい話題を作成してみてください
4. topic_participants テーブルで自動参加を確認

🔍 トラブルシューティング:
- ログを確認: Supabase ダッシュボード → Logs
- 参加者確認: SELECT * FROM topic_participants ORDER BY joined_at DESC LIMIT 10;
- 統計確認: SELECT * FROM topic_participation_stats LIMIT 5;

⚙️ 設定オプション:
- いいね時の自動参加を無効にしたい場合:
  DROP TRIGGER auto_join_on_topic_like ON topic_likes;

📞 サポート:
何か問題がある場合は、上記のログとクエリ結果を確認してください。
*/