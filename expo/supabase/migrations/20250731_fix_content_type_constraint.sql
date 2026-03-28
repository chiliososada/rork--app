-- content_moderation_logsテーブルのcontent_type制約を修正
-- 'message'を'chat_message'に統一

-- 制約を一時的に削除
ALTER TABLE public.content_moderation_logs DROP CONSTRAINT IF EXISTS content_moderation_logs_content_type_check;

-- 新しい制約を追加（'message'も許可）
ALTER TABLE public.content_moderation_logs ADD CONSTRAINT content_moderation_logs_content_type_check 
CHECK (content_type IN (
  'topic', 
  'comment', 
  'chat_message', 
  'message',  -- プライベートメッセージ用
  'user_profile'
));

-- 既存の'message'データを'chat_message'に更新（もしあれば）
UPDATE public.content_moderation_logs 
SET content_type = 'chat_message' 
WHERE content_type = 'message';

-- moderate_content関数を更新してcontent_typeの統一を確保
CREATE OR REPLACE FUNCTION moderate_content(
  content_text TEXT,
  content_type_param TEXT,
  content_id_param UUID,
  user_id_param UUID,
  ip_address_param INET DEFAULT NULL,
  user_agent_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  action TEXT,
  is_blocked BOOLEAN,
  severity_score INTEGER,
  violation_categories TEXT[],
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  matched_keywords RECORD;
  total_severity INTEGER DEFAULT 0;
  violations TEXT[] DEFAULT ARRAY[]::TEXT[];
  auto_block_enabled BOOLEAN DEFAULT FALSE;
  block_threshold DECIMAL DEFAULT 8.0;
  final_action TEXT DEFAULT 'approved';
  is_auto_blocked BOOLEAN DEFAULT FALSE;
  moderation_log_id UUID;
  calculated_confidence DECIMAL(3,2) DEFAULT 0.5;
  normalized_content_type TEXT;
BEGIN
  -- content_typeを正規化（messageをchat_messageに統一）
  normalized_content_type := CASE 
    WHEN content_type_param = 'message' THEN 'chat_message'
    ELSE content_type_param
  END;

  -- 設定値を取得
  SELECT (config_value::TEXT)::BOOLEAN INTO auto_block_enabled
  FROM content_filter_config
  WHERE config_key = 'keyword_filtering_enabled' AND is_active = TRUE;
  
  SELECT (config_value::TEXT)::DECIMAL INTO block_threshold
  FROM content_filter_config
  WHERE config_key = 'auto_block_threshold' AND is_active = TRUE;
  
  -- デフォルト値の設定
  auto_block_enabled := COALESCE(auto_block_enabled, TRUE);
  block_threshold := COALESCE(block_threshold, 8.0);
  
  -- キーワードフィルタリング有効時のみ実行
  IF auto_block_enabled THEN
    -- 禁止キーワードをチェック
    FOR matched_keywords IN
      SELECT bk.keyword, bk.category, bk.severity, bk.auto_block, bk.keyword_type
      FROM banned_keywords bk
      WHERE bk.is_active = TRUE
        AND bk.language_code = 'ja'
        AND (
          (bk.keyword_type = 'exact_match' AND content_text ILIKE '%' || bk.keyword || '%') OR
          (bk.keyword_type = 'partial_match' AND content_text ILIKE '%' || bk.keyword || '%') OR
          (bk.keyword_type = 'regex_pattern' AND content_text ~ bk.keyword)
        )
    LOOP
      total_severity := total_severity + matched_keywords.severity;
      violations := array_append(violations, matched_keywords.category);
      
      -- 自動ブロック対象のキーワードが見つかった場合
      IF matched_keywords.auto_block THEN
        is_auto_blocked := TRUE;
      END IF;
    END LOOP;
  END IF;
  
  -- 最終的なアクションを決定
  IF is_auto_blocked OR total_severity >= block_threshold THEN
    final_action := 'auto_blocked';
    is_auto_blocked := TRUE;
  ELSIF total_severity >= 5 THEN
    final_action := 'flagged';
  ELSE
    final_action := 'approved';
  END IF;
  
  -- 信頼度スコアを計算
  calculated_confidence := LEAST(1.0, GREATEST(0.0, total_severity / 10.0));
  
  -- モデレーションログに記録
  INSERT INTO content_moderation_logs (
    content_type, content_id, user_id, original_content,
    moderation_action, violation_categories, severity_score, confidence_score,
    detection_method, ip_address, user_agent
  ) VALUES (
    normalized_content_type, content_id_param, user_id_param, content_text,
    final_action, to_jsonb(violations), total_severity, calculated_confidence,
    'keyword_filter', ip_address_param, user_agent_param
  ) RETURNING id INTO moderation_log_id;
  
  -- 自動制裁の適用（高い重要度の場合）
  IF final_action = 'auto_blocked' AND total_severity >= 9 THEN
    INSERT INTO user_sanctions (
      user_id, sanction_type, reason, violation_categories,
      severity_level, expires_at, issued_by, related_moderation_log_id
    ) VALUES (
      user_id_param, 'temporary_mute', 'Automatic sanction for severe content violation',
      to_jsonb(violations), total_severity,
      NOW() + INTERVAL '24 hours', NULL, moderation_log_id
    );
  END IF;
  
  -- 結果を返す
  RETURN QUERY SELECT
    final_action as action,
    is_auto_blocked as is_blocked,
    total_severity as severity_score,
    violations as violation_categories,
    CASE
      WHEN final_action = 'approved' THEN 'コンテンツが承認されました'
      WHEN final_action = 'flagged' THEN 'コンテンツにフラグが付けられました'
      WHEN final_action = 'auto_blocked' THEN 'コンテンツは自動的にブロックされました'
      ELSE 'コンテンツが処理されました'
    END as message;
END;
$$;