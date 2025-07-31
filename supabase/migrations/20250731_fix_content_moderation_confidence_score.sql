-- コンテンツモデレーションシステムの修正
-- confidence_score フィールドの適切な処理

-- moderate_content 関数を修正して confidence_score を適切に処理
DROP FUNCTION IF EXISTS moderate_content(TEXT, TEXT, UUID, UUID, INET, TEXT);

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
  block_threshold INTEGER DEFAULT 8;
  final_action TEXT DEFAULT 'approved';
  is_auto_blocked BOOLEAN DEFAULT FALSE;
  moderation_log_id UUID;
  calculated_confidence DECIMAL(3,2) DEFAULT 0.5; -- デフォルト信頼度
BEGIN
  -- 設定値を取得
  SELECT (config_value::TEXT)::BOOLEAN INTO auto_block_enabled
  FROM content_filter_config
  WHERE config_key = 'keyword_filtering_enabled' AND is_active = TRUE;
  
  SELECT (config_value::TEXT)::INTEGER INTO block_threshold
  FROM content_filter_config
  WHERE config_key = 'auto_block_threshold' AND is_active = TRUE;
  
  -- デフォルト値の設定
  auto_block_enabled := COALESCE(auto_block_enabled, TRUE);
  block_threshold := COALESCE(block_threshold, 8);
  
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
  
  -- 信頼度スコアを計算（キーワードマッチ数と重要度に基づく）
  IF total_severity > 0 THEN
    calculated_confidence := LEAST(1.0, (total_severity::DECIMAL / 10.0));
  ELSE
    calculated_confidence := 0.1; -- マッチなしの場合は低い信頼度
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
  
  -- モデレーションログに記録（confidence_score を含める）
  INSERT INTO content_moderation_logs (
    content_type, content_id, user_id, original_content,
    moderation_action, violation_categories, severity_score, confidence_score,
    detection_method, ip_address, user_agent
  ) VALUES (
    content_type_param, content_id_param, user_id_param, content_text,
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