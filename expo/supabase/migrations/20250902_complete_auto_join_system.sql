-- ============================================
-- 完全な自動参加システム実装
-- 2025-09-02 Final Version
-- ============================================

-- 事前クリーンアップ
DROP TRIGGER IF EXISTS auto_join_on_chat_message ON chat_messages;
DROP TRIGGER IF EXISTS auto_join_on_comment ON comments;
DROP TRIGGER IF EXISTS auto_join_on_topic_create ON topics;
DROP TRIGGER IF EXISTS auto_join_on_topic_like ON topic_likes;

DROP FUNCTION IF EXISTS trigger_auto_join_on_message();
DROP FUNCTION IF EXISTS trigger_auto_join_on_comment();
DROP FUNCTION IF EXISTS trigger_auto_join_on_topic_create();
DROP FUNCTION IF EXISTS trigger_auto_join_on_like();
DROP FUNCTION IF EXISTS auto_join_topic(UUID, UUID);
DROP FUNCTION IF EXISTS repair_missing_participants();

-- ============================================
-- 1. 基本関数：ユーザーを話題に参加させる
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
BEGIN
    -- NULLチェック
    IF p_user_id IS NULL OR p_topic_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'user_idまたはtopic_idがNULLです',
            'user_id', p_user_id,
            'topic_id', p_topic_id
        );
    END IF;

    -- 話題が存在するかチェック
    IF NOT EXISTS (SELECT 1 FROM topics WHERE id = p_topic_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '指定された話題が存在しません',
            'topic_id', p_topic_id
        );
    END IF;

    -- ユーザーが存在するかチェック
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '指定されたユーザーが存在しません',
            'user_id', p_user_id
        );
    END IF;

    -- 既存レコードのチェック
    SELECT * INTO v_existing_record
    FROM topic_participants
    WHERE user_id = p_user_id AND topic_id = p_topic_id;

    IF FOUND THEN
        -- 既存レコードがある場合
        IF v_existing_record.is_active THEN
            -- 既にアクティブ
            v_result := jsonb_build_object(
                'success', true,
                'action', 'already_active',
                'message', 'ユーザーは既にアクティブな参加者です',
                'participant_id', v_existing_record.id
            );
        ELSE
            -- 非アクティブを再アクティブ化
            UPDATE topic_participants
            SET is_active = TRUE,
                joined_at = NOW()
            WHERE id = v_existing_record.id
            RETURNING id INTO v_participant_id;
            
            v_result := jsonb_build_object(
                'success', true,
                'action', 'reactivated',
                'message', 'ユーザーを再アクティブ化しました',
                'participant_id', v_participant_id
            );
        END IF;
    ELSE
        -- 新規参加
        INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
        VALUES (p_user_id, p_topic_id, TRUE, NOW())
        RETURNING id INTO v_participant_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'joined',
            'message', '新規参加者として追加しました',
            'participant_id', v_participant_id
        );
    END IF;

    RETURN v_result;

EXCEPTION
    WHEN unique_violation THEN
        -- 同時実行による重複エラー - 問題なし
        RETURN jsonb_build_object(
            'success', true,
            'action', 'concurrent_join',
            'message', '同時実行により既に参加済みです'
        );
    WHEN OTHERS THEN
        -- その他のエラー
        RAISE WARNING 'auto_join_topic エラー - user_id: %, topic_id: %, error: %', 
                     p_user_id, p_topic_id, SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', '参加処理中にエラーが発生しました'
        );
END;
$$;

-- ============================================
-- 2. トリガー関数：チャットメッセージ送信時
-- ============================================
CREATE OR REPLACE FUNCTION trigger_auto_join_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- メッセージ送信者を話題に自動参加
    v_result := auto_join_topic(NEW.user_id, NEW.topic_id);
    
    -- デバッグログ
    IF NOT (v_result->>'success')::boolean THEN
        RAISE NOTICE 'メッセージ送信時の自動参加失敗: %', v_result;
    ELSE
        RAISE NOTICE 'メッセージ送信時の自動参加成功: user_id=%, topic_id=%, action=%', 
                     NEW.user_id, NEW.topic_id, v_result->>'action';
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================
-- 3. トリガー関数：コメント投稿時
-- ============================================
CREATE OR REPLACE FUNCTION trigger_auto_join_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- コメント投稿者を話題に自動参加
    v_result := auto_join_topic(NEW.user_id, NEW.topic_id);
    
    IF NOT (v_result->>'success')::boolean THEN
        RAISE NOTICE 'コメント投稿時の自動参加失敗: %', v_result;
    ELSE
        RAISE NOTICE 'コメント投稿時の自動参加成功: user_id=%, topic_id=%, action=%', 
                     NEW.user_id, NEW.topic_id, v_result->>'action';
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================
-- 4. トリガー関数：話題作成時
-- ============================================
CREATE OR REPLACE FUNCTION trigger_auto_join_on_topic_create()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- 話題作成者を自動参加
    v_result := auto_join_topic(NEW.user_id, NEW.id);
    
    IF NOT (v_result->>'success')::boolean THEN
        RAISE NOTICE '話題作成時の自動参加失敗: %', v_result;
    ELSE
        RAISE NOTICE '話題作成時の自動参加成功: user_id=%, topic_id=%, action=%', 
                     NEW.user_id, NEW.id, v_result->>'action';
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================
-- 5. トリガー関数：いいね時（オプション）
-- ============================================
CREATE OR REPLACE FUNCTION trigger_auto_join_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- いいね時の自動参加（設定可能）
    v_result := auto_join_topic(NEW.user_id, NEW.topic_id);
    
    IF NOT (v_result->>'success')::boolean THEN
        RAISE NOTICE 'いいね時の自動参加失敗: %', v_result;
    ELSE
        RAISE NOTICE 'いいね時の自動参加成功: user_id=%, topic_id=%, action=%', 
                     NEW.user_id, NEW.topic_id, v_result->>'action';
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================
-- 6. トリガーの作成
-- ============================================

-- メッセージ送信時の自動参加
CREATE TRIGGER auto_join_on_chat_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_join_on_message();

-- コメント投稿時の自動参加
CREATE TRIGGER auto_join_on_comment
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_join_on_comment();

-- 話題作成時の自動参加
CREATE TRIGGER auto_join_on_topic_create
    AFTER INSERT ON topics
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_join_on_topic_create();

-- いいね時の自動参加（オプション - 必要に応じてコメントアウト）
CREATE TRIGGER auto_join_on_topic_like
    AFTER INSERT ON topic_likes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_join_on_like();

-- ============================================
-- 7. 既存データの修復関数
-- ============================================
CREATE OR REPLACE FUNCTION repair_missing_participants()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_chat_count INTEGER := 0;
    v_comment_count INTEGER := 0;
    v_topic_count INTEGER := 0;
    v_like_count INTEGER := 0;
    v_total_before INTEGER := 0;
    v_total_after INTEGER := 0;
BEGIN
    -- 修復前の参加者数
    SELECT COUNT(*) INTO v_total_before FROM topic_participants;

    -- チャットメッセージから修復
    WITH missing_participants AS (
        SELECT DISTINCT 
            cm.user_id,
            cm.topic_id,
            MIN(cm.created_at) as first_message
        FROM chat_messages cm
        LEFT JOIN topic_participants tp 
            ON tp.user_id = cm.user_id 
            AND tp.topic_id = cm.topic_id
        WHERE tp.id IS NULL
            AND cm.user_id IS NOT NULL
            AND cm.topic_id IS NOT NULL
        GROUP BY cm.user_id, cm.topic_id
    )
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT user_id, topic_id, TRUE, first_message
    FROM missing_participants
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_chat_count = ROW_COUNT;

    -- コメントから修復
    WITH missing_participants AS (
        SELECT DISTINCT 
            c.user_id,
            c.topic_id,
            MIN(c.created_at) as first_comment
        FROM comments c
        LEFT JOIN topic_participants tp 
            ON tp.user_id = c.user_id 
            AND tp.topic_id = c.topic_id
        WHERE tp.id IS NULL
            AND c.user_id IS NOT NULL
            AND c.topic_id IS NOT NULL
        GROUP BY c.user_id, c.topic_id
    )
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT user_id, topic_id, TRUE, first_comment
    FROM missing_participants
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_comment_count = ROW_COUNT;

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
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_topic_count = ROW_COUNT;

    -- いいねから修復（オプション）
    WITH missing_participants AS (
        SELECT DISTINCT 
            tl.user_id,
            tl.topic_id,
            MIN(tl.created_at) as first_like
        FROM topic_likes tl
        LEFT JOIN topic_participants tp 
            ON tp.user_id = tl.user_id 
            AND tp.topic_id = tl.topic_id
        WHERE tp.id IS NULL
            AND tl.user_id IS NOT NULL
            AND tl.topic_id IS NOT NULL
        GROUP BY tl.user_id, tl.topic_id
    )
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT user_id, topic_id, TRUE, first_like
    FROM missing_participants
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_like_count = ROW_COUNT;

    -- 修復後の参加者数
    SELECT COUNT(*) INTO v_total_after FROM topic_participants;

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
        'timestamp', NOW()
    );
END;
$$;

-- ============================================
-- 8. 監視ビュー（統計情報）
-- ============================================
CREATE OR REPLACE VIEW topic_participation_stats AS
SELECT 
    t.id as topic_id,
    t.title,
    t.user_id as creator_id,
    u.nickname as creator_name,
    t.created_at as topic_created_at,
    COUNT(DISTINCT tp.user_id) as total_participants,
    COUNT(DISTINCT CASE WHEN tp.is_active THEN tp.user_id END) as active_participants,
    COUNT(DISTINCT cm.id) as message_count,
    COUNT(DISTINCT c.id) as comment_count,
    COUNT(DISTINCT tl.id) as like_count,
    MAX(tp.joined_at) as last_join_date,
    MAX(COALESCE(cm.created_at, c.created_at)) as last_activity
FROM topics t
LEFT JOIN users u ON u.id = t.user_id
LEFT JOIN topic_participants tp ON tp.topic_id = t.id
LEFT JOIN chat_messages cm ON cm.topic_id = t.id
LEFT JOIN comments c ON c.topic_id = t.id
LEFT JOIN topic_likes tl ON tl.topic_id = t.id
WHERE t.is_hidden IS NOT TRUE
GROUP BY t.id, t.title, t.user_id, u.nickname, t.created_at
ORDER BY t.created_at DESC;

-- ============================================
-- 9. 既存データの修復実行
-- ============================================
SELECT '修復前の統計' as status, 
       COUNT(*) as total_participants,
       COUNT(DISTINCT user_id) as unique_users,
       COUNT(DISTINCT topic_id) as unique_topics
FROM topic_participants;

-- 修復実行
SELECT repair_missing_participants();

-- 修復後の統計
SELECT '修復後の統計' as status,
       COUNT(*) as total_participants,
       COUNT(DISTINCT user_id) as unique_users,
       COUNT(DISTINCT topic_id) as unique_topics,
       COUNT(CASE WHEN is_active THEN 1 END) as active_participants
FROM topic_participants;

-- ============================================
-- 10. トリガーの確認
-- ============================================
SELECT 
    'トリガー設定確認' as status,
    trigger_name,
    event_manipulation as trigger_event,
    event_object_table as target_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name LIKE 'auto_join_%'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 11. 最終確認とテストクエリ
-- ============================================

-- 話題別参加者数のトップ10
SELECT 
    'トップ10話題（参加者数順）' as info,
    topic_id,
    title,
    active_participants,
    total_participants,
    message_count,
    comment_count
FROM topic_participation_stats
WHERE active_participants > 0
ORDER BY active_participants DESC, total_participants DESC
LIMIT 10;

-- 最近の自動参加アクティビティ
SELECT 
    '最近の参加者（直近20件）' as info,
    tp.joined_at,
    u.nickname as user_name,
    t.title as topic_title,
    tp.is_active
FROM topic_participants tp
JOIN users u ON u.id = tp.user_id
JOIN topics t ON t.id = tp.topic_id
ORDER BY tp.joined_at DESC
LIMIT 20;

-- 完了メッセージ
SELECT 
    'インストール完了' as status,
    '自動参加システムが正常にセットアップされました' as message,
    NOW() as installation_time;