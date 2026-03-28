-- ============================================
-- 話題参加者自動管理システム
-- 2025-09-02 v2
-- ============================================

-- 1. 基本関数：ユーザーを話題に参加させる
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
                'message', 'ユーザーは既にアクティブです',
                'participant_id', v_existing_record.id
            );
        ELSE
            -- 非アクティブを再アクティブ化
            UPDATE topic_participants
            SET is_active = TRUE,
                joined_at = NOW()
            WHERE id = v_existing_record.id;
            
            v_result := jsonb_build_object(
                'success', true,
                'action', 'reactivated',
                'message', 'ユーザーを再アクティブ化しました',
                'participant_id', v_existing_record.id
            );
        END IF;
    ELSE
        -- 新規参加
        INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
        VALUES (p_user_id, p_topic_id, TRUE, NOW())
        RETURNING id INTO v_existing_record;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'joined',
            'message', '新規参加者として追加しました',
            'participant_id', v_existing_record.id
        );
    END IF;

    RETURN v_result;

EXCEPTION
    WHEN unique_violation THEN
        -- 同時実行による重複
        RETURN jsonb_build_object(
            'success', true,
            'action', 'concurrent_join',
            'message', '同時実行により既に参加済み'
        );
    WHEN OTHERS THEN
        -- その他のエラー
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
    
    -- ログ出力（デバッグ用）
    IF NOT (v_result->>'success')::boolean THEN
        RAISE NOTICE 'メッセージ送信時の自動参加失敗: %', v_result;
    END IF;
    
    -- 通知用のイベントを発行
    PERFORM pg_notify(
        'participant_joined',
        json_build_object(
            'topic_id', NEW.topic_id,
            'user_id', NEW.user_id,
            'action', v_result->>'action',
            'timestamp', NOW()
        )::text
    );
    
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
    END IF;
    
    -- 通知用のイベントを発行
    PERFORM pg_notify(
        'participant_joined',
        json_build_object(
            'topic_id', NEW.topic_id,
            'user_id', NEW.user_id,
            'action', v_result->>'action',
            'timestamp', NOW()
        )::text
    );
    
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
    END IF;
    
    -- 通知用のイベントを発行
    PERFORM pg_notify(
        'participant_joined',
        json_build_object(
            'topic_id', NEW.id,
            'user_id', NEW.user_id,
            'action', 'creator_joined',
            'timestamp', NOW()
        )::text
    );
    
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
    v_preference BOOLEAN;
BEGIN
    -- ユーザー設定を確認（将来的に実装）
    -- ここでは常にTRUEとする
    v_preference := TRUE;
    
    IF v_preference THEN
        v_result := auto_join_topic(NEW.user_id, NEW.topic_id);
        
        IF NOT (v_result->>'success')::boolean THEN
            RAISE NOTICE 'いいね時の自動参加失敗: %', v_result;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================
-- 6. トリガーの削除と再作成
-- ============================================

-- 既存トリガーの削除
DROP TRIGGER IF EXISTS auto_join_on_chat_message ON chat_messages;
DROP TRIGGER IF EXISTS auto_join_on_comment ON comments;
DROP TRIGGER IF EXISTS auto_join_on_topic_create ON topics;
DROP TRIGGER IF EXISTS auto_join_on_topic_like ON topic_likes;

-- トリガーの作成
CREATE TRIGGER auto_join_on_chat_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_join_on_message();

CREATE TRIGGER auto_join_on_comment
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_join_on_comment();

CREATE TRIGGER auto_join_on_topic_create
    AFTER INSERT ON topics
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_join_on_topic_create();

-- いいね時の自動参加（オプション - コメントアウトで無効化可能）
CREATE TRIGGER auto_join_on_topic_like
    AFTER INSERT ON topic_likes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_join_on_like();

-- ============================================
-- 7. バッチ処理用関数：既存データの修復
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
BEGIN
    -- チャットメッセージからの修復
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT DISTINCT 
        cm.user_id,
        cm.topic_id,
        TRUE,
        MIN(cm.created_at)
    FROM chat_messages cm
    LEFT JOIN topic_participants tp 
        ON tp.user_id = cm.user_id 
        AND tp.topic_id = cm.topic_id
    WHERE tp.id IS NULL
        AND cm.user_id IS NOT NULL
        AND cm.topic_id IS NOT NULL
    GROUP BY cm.user_id, cm.topic_id
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_chat_count = ROW_COUNT;

    -- コメントからの修復
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT DISTINCT 
        c.user_id,
        c.topic_id,
        TRUE,
        MIN(c.created_at)
    FROM comments c
    LEFT JOIN topic_participants tp 
        ON tp.user_id = c.user_id 
        AND tp.topic_id = c.topic_id
    WHERE tp.id IS NULL
        AND c.user_id IS NOT NULL
        AND c.topic_id IS NOT NULL
    GROUP BY c.user_id, c.topic_id
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_comment_count = ROW_COUNT;

    -- 話題作成者からの修復
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

    -- いいねからの修復（オプション）
    INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
    SELECT DISTINCT 
        tl.user_id,
        tl.topic_id,
        TRUE,
        tl.created_at
    FROM topic_likes tl
    LEFT JOIN topic_participants tp 
        ON tp.user_id = tl.user_id 
        AND tp.topic_id = tl.topic_id
    WHERE tp.id IS NULL
        AND tl.user_id IS NOT NULL
        AND tl.topic_id IS NOT NULL
    ON CONFLICT (topic_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_like_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'repaired', jsonb_build_object(
            'from_messages', v_chat_count,
            'from_comments', v_comment_count,
            'from_topics', v_topic_count,
            'from_likes', v_like_count,
            'total', v_chat_count + v_comment_count + v_topic_count + v_like_count
        ),
        'timestamp', NOW()
    );
END;
$$;

-- ============================================
-- 8. 監視用ビュー
-- ============================================
CREATE OR REPLACE VIEW topic_participation_stats AS
SELECT 
    t.id as topic_id,
    t.title,
    t.created_at as topic_created_at,
    COUNT(DISTINCT tp.user_id) as participant_count,
    COUNT(DISTINCT CASE WHEN tp.is_active THEN tp.user_id END) as active_participant_count,
    MAX(tp.joined_at) as last_join_date,
    COUNT(DISTINCT cm.id) as message_count,
    COUNT(DISTINCT c.id) as comment_count
FROM topics t
LEFT JOIN topic_participants tp ON tp.topic_id = t.id
LEFT JOIN chat_messages cm ON cm.topic_id = t.id
LEFT JOIN comments c ON c.topic_id = t.id
GROUP BY t.id, t.title, t.created_at;

-- ============================================
-- 9. 実行：既存データの修復
-- ============================================
SELECT repair_missing_participants();

-- ============================================
-- 10. 統計情報の確認
-- ============================================
SELECT 
    'Statistics After Setup' as status,
    COUNT(DISTINCT tp.user_id) as unique_users,
    COUNT(DISTINCT tp.topic_id) as unique_topics,
    COUNT(*) as total_participations,
    COUNT(CASE WHEN tp.is_active THEN 1 END) as active_participations,
    ROUND(AVG(sub.participant_count), 2) as avg_participants_per_topic
FROM topic_participants tp
CROSS JOIN LATERAL (
    SELECT COUNT(*) as participant_count
    FROM topic_participants tp2
    WHERE tp2.topic_id = tp.topic_id
) sub;

-- トリガー確認
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name LIKE 'auto_join_%'
ORDER BY trigger_name;