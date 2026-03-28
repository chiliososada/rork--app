-- 話題参加者の自動追加機能
-- ユーザーがメッセージを送信時に自動的に参加者テーブルに追加

-- 話題に自動参加するRPC関数
CREATE OR REPLACE FUNCTION auto_join_topic(
  user_id_param UUID,
  topic_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 既に参加している場合はスキップ
  IF EXISTS (
    SELECT 1 FROM topic_participants 
    WHERE user_id = user_id_param 
      AND topic_id = topic_id_param 
      AND is_active = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  -- 参加者テーブルに追加（重複エラーを無視）
  INSERT INTO topic_participants (user_id, topic_id, is_active)
  VALUES (user_id_param, topic_id_param, TRUE)
  ON CONFLICT (topic_id, user_id) 
  DO UPDATE SET 
    is_active = TRUE,
    joined_at = NOW();

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- エラーが発生してもメッセージ送信は継続
    RETURN FALSE;
END;
$$;

-- チャットメッセージ挿入時の自動参加トリガー
CREATE OR REPLACE FUNCTION trigger_auto_join_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- メッセージ送信者を話題に自動参加させる
  PERFORM auto_join_topic(NEW.user_id, NEW.topic_id);
  RETURN NEW;
END;
$$;

-- 既存のトリガーを削除して再作成
DROP TRIGGER IF EXISTS auto_join_on_chat_message ON chat_messages;

CREATE TRIGGER auto_join_on_chat_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_join_on_message();

-- コメント投稿時の自動参加トリガー
CREATE OR REPLACE FUNCTION trigger_auto_join_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- コメント投稿者を話題に自動参加させる
  PERFORM auto_join_topic(NEW.user_id, NEW.topic_id);
  RETURN NEW;
END;
$$;

-- 既存のトリガーを削除して再作成
DROP TRIGGER IF EXISTS auto_join_on_comment ON comments;

CREATE TRIGGER auto_join_on_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_join_on_comment();

-- 話題作成時の自動参加（作成者）
CREATE OR REPLACE FUNCTION trigger_auto_join_on_topic_create()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 話題作成者を自動参加させる
  PERFORM auto_join_topic(NEW.user_id, NEW.id);
  RETURN NEW;
END;
$$;

-- 既存のトリガーを削除して再作成
DROP TRIGGER IF EXISTS auto_join_on_topic_create ON topics;

CREATE TRIGGER auto_join_on_topic_create
  AFTER INSERT ON topics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_join_on_topic_create();