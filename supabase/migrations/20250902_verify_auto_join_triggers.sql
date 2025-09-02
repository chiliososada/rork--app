-- topic_participants 自動参加機能の検証と修正
-- 2025-09-02

-- ============================================
-- 1. 現在のテーブル構造を確認
-- ============================================

-- topic_participants テーブルの構造を確認
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'topic_participants'
ORDER BY ordinal_position;

-- ============================================
-- 2. 既存のトリガーを確認
-- ============================================

-- 現在設定されているトリガーの一覧
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND event_object_table IN ('chat_messages', 'comments', 'topics')
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 3. auto_join_topic 関数の再作成（エラーハンドリング改善版）
-- ============================================

-- 既存の関数を削除
DROP FUNCTION IF EXISTS auto_join_topic(UUID, UUID);

-- 改善版の自動参加関数
CREATE OR REPLACE FUNCTION auto_join_topic(
  user_id_param UUID,
  topic_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_already_participant BOOLEAN;
BEGIN
    -- NULL チェック
    IF user_id_param IS NULL OR topic_id_param IS NULL THEN
        RAISE NOTICE '警告: user_id または topic_id が NULL です';
        RETURN FALSE;
    END IF;

    -- 既に参加しているかチェック
    SELECT EXISTS (
        SELECT 1 FROM topic_participants 
        WHERE user_id = user_id_param 
          AND topic_id = topic_id_param
    ) INTO is_already_participant;

    IF is_already_participant THEN
        -- 既に参加している場合は、is_active を TRUE に更新
        UPDATE topic_participants
        SET is_active = TRUE,
            joined_at = CASE 
                WHEN is_active = FALSE THEN NOW() 
                ELSE joined_at 
            END
        WHERE user_id = user_id_param 
          AND topic_id = topic_id_param;
        
        RAISE NOTICE 'ユーザー % は既に話題 % に参加しています（アクティブ状態を更新）', user_id_param, topic_id_param;
        RETURN TRUE;
    ELSE
        -- 新規参加者として追加
        INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
        VALUES (user_id_param, topic_id_param, TRUE, NOW());
        
        RAISE NOTICE 'ユーザー % を話題 % に新規追加しました', user_id_param, topic_id_param;
        RETURN TRUE;
    END IF;

EXCEPTION
    WHEN unique_violation THEN
        -- 同時実行による重複の場合
        RAISE NOTICE '同時実行による重複: ユーザー % は既に話題 % に参加しています', user_id_param, topic_id_param;
        RETURN TRUE;
    WHEN OTHERS THEN
        -- その他のエラー
        RAISE WARNING 'auto_join_topic エラー: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- ============================================
-- 4. トリガー関数の再作成（ログ出力付き）
-- ============================================

-- チャットメッセージ挿入時のトリガー関数
CREATE OR REPLACE FUNCTION trigger_auto_join_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    join_result BOOLEAN;
BEGIN
    -- メッセージ送信者を話題に自動参加させる
    join_result := auto_join_topic(NEW.user_id, NEW.topic_id);
    
    IF NOT join_result THEN
        RAISE NOTICE 'メッセージ送信時の自動参加に失敗: user_id=%, topic_id=%', NEW.user_id, NEW.topic_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- コメント投稿時のトリガー関数
CREATE OR REPLACE FUNCTION trigger_auto_join_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    join_result BOOLEAN;
BEGIN
    -- コメント投稿者を話題に自動参加させる
    join_result := auto_join_topic(NEW.user_id, NEW.topic_id);
    
    IF NOT join_result THEN
        RAISE NOTICE 'コメント投稿時の自動参加に失敗: user_id=%, topic_id=%', NEW.user_id, NEW.topic_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 話題作成時のトリガー関数
CREATE OR REPLACE FUNCTION trigger_auto_join_on_topic_create()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    join_result BOOLEAN;
BEGIN
    -- 話題作成者を自動参加させる
    join_result := auto_join_topic(NEW.user_id, NEW.id);
    
    IF NOT join_result THEN
        RAISE NOTICE '話題作成時の自動参加に失敗: user_id=%, topic_id=%', NEW.user_id, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================
-- 5. トリガーの再作成
-- ============================================

-- 既存のトリガーを削除
DROP TRIGGER IF EXISTS auto_join_on_chat_message ON chat_messages;
DROP TRIGGER IF EXISTS auto_join_on_comment ON comments;
DROP TRIGGER IF EXISTS auto_join_on_topic_create ON topics;

-- トリガーを再作成
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

-- ============================================
-- 6. テスト用のクエリ
-- ============================================

-- 現在の参加者数を確認
SELECT 
    COUNT(*) as total_participants,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT topic_id) as unique_topics,
    COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_participants
FROM topic_participants;

-- 最近の参加者を確認（デバッグ用）
SELECT 
    tp.user_id,
    tp.topic_id,
    tp.is_active,
    tp.joined_at,
    u.nickname as user_name,
    t.title as topic_title
FROM topic_participants tp
LEFT JOIN users u ON u.id = tp.user_id
LEFT JOIN topics t ON t.id = tp.topic_id
ORDER BY tp.joined_at DESC
LIMIT 10;

-- ============================================
-- 7. 既存データの修復（必要に応じて実行）
-- ============================================

-- chat_messages に存在するが topic_participants に存在しないユーザーを追加
INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
SELECT DISTINCT 
    cm.user_id,
    cm.topic_id,
    TRUE as is_active,
    MIN(cm.created_at) as joined_at
FROM chat_messages cm
LEFT JOIN topic_participants tp 
    ON tp.user_id = cm.user_id 
    AND tp.topic_id = cm.topic_id
WHERE tp.id IS NULL
GROUP BY cm.user_id, cm.topic_id
ON CONFLICT (topic_id, user_id) DO NOTHING;

-- comments に存在するが topic_participants に存在しないユーザーを追加
INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
SELECT DISTINCT 
    c.user_id,
    c.topic_id,
    TRUE as is_active,
    MIN(c.created_at) as joined_at
FROM comments c
LEFT JOIN topic_participants tp 
    ON tp.user_id = c.user_id 
    AND tp.topic_id = c.topic_id
WHERE tp.id IS NULL
GROUP BY c.user_id, c.topic_id
ON CONFLICT (topic_id, user_id) DO NOTHING;

-- topics の作成者を topic_participants に追加
INSERT INTO topic_participants (user_id, topic_id, is_active, joined_at)
SELECT DISTINCT 
    t.user_id,
    t.id as topic_id,
    TRUE as is_active,
    t.created_at as joined_at
FROM topics t
LEFT JOIN topic_participants tp 
    ON tp.user_id = t.user_id 
    AND tp.topic_id = t.id
WHERE tp.id IS NULL
ON CONFLICT (topic_id, user_id) DO NOTHING;

-- ============================================
-- 8. 最終確認
-- ============================================

-- 修復後の参加者数を確認
SELECT 
    'After Repair' as status,
    COUNT(*) as total_participants,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT topic_id) as unique_topics,
    COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_participants
FROM topic_participants;

-- トリガーが正しく設定されているか確認
SELECT 
    'Triggers Configured' as status,
    COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name IN ('auto_join_on_chat_message', 'auto_join_on_comment', 'auto_join_on_topic_create');