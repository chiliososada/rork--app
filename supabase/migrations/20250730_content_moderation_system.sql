-- サーバーサイドコンテンツモデレーションシステム
-- 不適切なコンテンツの検出と管理機能

-- 1. コンテンツモデレーションログテーブル
CREATE TABLE public.content_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 対象コンテンツ情報
  content_type TEXT NOT NULL CHECK (content_type IN (
    'topic', 'comment', 'chat_message', 'user_profile'
  )),
  content_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- コンテンツ詳細
  original_content TEXT NOT NULL,
  content_language TEXT,
  
  -- モデレーション結果
  moderation_action TEXT NOT NULL CHECK (moderation_action IN (
    'approved',        -- 承認済み
    'flagged',         -- フラグ付き（要注意）
    'blocked',         -- ブロック済み
    'auto_blocked',    -- 自動ブロック
    'user_reported',   -- ユーザー報告
    'manual_review',   -- 手動レビュー待ち
    'deleted'          -- 削除済み
  )),
  
  -- 検出された問題
  violation_categories JSONB DEFAULT '[]'::JSONB, -- ['spam', 'harassment', 'adult_content', 'hate_speech', 'violence']
  severity_score INTEGER CHECK (severity_score >= 0 AND severity_score <= 100),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- AI/自動検出情報
  detection_method TEXT CHECK (detection_method IN (
    'keyword_filter', 'ai_classifier', 'user_report', 'manual_review', 'pattern_matching'
  )),
  detection_model_version TEXT,
  
  -- レビュー情報
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  
  -- システム情報
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  -- 時間戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 禁止キーワードテーブル
CREATE TABLE public.banned_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- キーワード情報
  keyword TEXT NOT NULL,
  keyword_type TEXT NOT NULL CHECK (keyword_type IN (
    'exact_match',     -- 完全一致
    'partial_match',   -- 部分一致
    'regex_pattern',   -- 正規表現パターン
    'phonetic_match'   -- 音韻的類似
  )),
  
  -- 分類
  category TEXT NOT NULL CHECK (category IN (
    'profanity',       -- 冒涜的言葉
    'hate_speech',     -- ヘイトスピーチ
    'harassment',      -- ハラスメント
    'spam',            -- スパム
    'adult_content',   -- アダルトコンテンツ
    'violence',        -- 暴力的表現
    'discrimination',  -- 差別的表現
    'personal_info'    -- 個人情報
  )),
  
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
  language_code TEXT DEFAULT 'ja',
  
  -- 設定
  is_active BOOLEAN DEFAULT TRUE,
  auto_block BOOLEAN DEFAULT FALSE, -- 自動ブロックするかどうか
  
  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(keyword, keyword_type, language_code)
);

-- 3. ユーザー報告テーブル
CREATE TABLE public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 報告者情報
  reporter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 対象コンテンツ
  content_type TEXT NOT NULL CHECK (content_type IN (
    'topic', 'comment', 'chat_message', 'user_profile', 'user_behavior'
  )),
  content_id UUID,
  
  -- 報告内容
  report_reason TEXT NOT NULL CHECK (report_reason IN (
    'spam',
    'harassment',
    'hate_speech',
    'adult_content',
    'violence',
    'discrimination',
    'false_information',
    'copyright_violation',
    'personal_information',
    'other'
  )),
  report_description TEXT,
  
  -- ステータス
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- 待機中
    'investigating', -- 調査中
    'resolved',     -- 解決済み
    'dismissed',    -- 却下
    'duplicate'     -- 重複報告
  )),
  
  -- 処理情報
  assigned_to UUID REFERENCES public.users(id),
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  action_taken TEXT,
  
  -- メタデータ
  ip_address INET,
  user_agent TEXT,
  
  -- 時間戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ユーザー制裁テーブル
CREATE TABLE public.user_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 対象ユーザー
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 制裁情報
  sanction_type TEXT NOT NULL CHECK (sanction_type IN (
    'warning',         -- 警告
    'temporary_mute',  -- 一時的なミュート
    'permanent_mute',  -- 永久ミュート
    'temporary_ban',   -- 一時的な停止
    'permanent_ban',   -- 永久停止
    'content_restriction', -- コンテンツ制限
    'shadow_ban'       -- シャドウバン
  )),
  
  -- 詳細
  reason TEXT NOT NULL,
  violation_categories JSONB DEFAULT '[]'::JSONB,
  severity_level INTEGER CHECK (severity_level >= 1 AND severity_level <= 10),
  
  -- 期間設定
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULLの場合は永久
  
  -- ステータス
  is_active BOOLEAN DEFAULT TRUE,
  is_appealed BOOLEAN DEFAULT FALSE,
  
  -- 処理者情報
  issued_by UUID REFERENCES public.users(id),
  reviewed_by UUID REFERENCES public.users(id),
  
  -- 関連するレポートやログ
  related_report_id UUID REFERENCES public.user_reports(id),
  related_moderation_log_id UUID REFERENCES public.content_moderation_logs(id),
  
  -- メタデータ
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. コンテンツフィルター設定テーブル
CREATE TABLE public.content_filter_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 設定項目
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  
  -- カテゴリー
  category TEXT NOT NULL CHECK (category IN (
    'keyword_filtering',
    'ai_moderation',
    'user_reporting',
    'auto_sanctions',
    'review_thresholds'
  )),
  
  -- ステータス
  is_active BOOLEAN DEFAULT TRUE,
  version INTEGER DEFAULT 1,
  
  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. インデックスの作成
CREATE INDEX content_moderation_logs_content_idx ON public.content_moderation_logs(content_type, content_id);
CREATE INDEX content_moderation_logs_user_id_idx ON public.content_moderation_logs(user_id);
CREATE INDEX content_moderation_logs_action_idx ON public.content_moderation_logs(moderation_action);
CREATE INDEX content_moderation_logs_created_at_idx ON public.content_moderation_logs(created_at DESC);

CREATE INDEX banned_keywords_category_idx ON public.banned_keywords(category);
CREATE INDEX banned_keywords_active_idx ON public.banned_keywords(is_active) WHERE is_active = TRUE;
CREATE INDEX banned_keywords_language_idx ON public.banned_keywords(language_code);

CREATE INDEX user_reports_reporter_id_idx ON public.user_reports(reporter_id);
CREATE INDEX user_reports_reported_user_id_idx ON public.user_reports(reported_user_id);
CREATE INDEX user_reports_status_idx ON public.user_reports(status);
CREATE INDEX user_reports_created_at_idx ON public.user_reports(created_at DESC);

CREATE INDEX user_sanctions_user_id_idx ON public.user_sanctions(user_id);
CREATE INDEX user_sanctions_active_idx ON public.user_sanctions(is_active) WHERE is_active = TRUE;
CREATE INDEX user_sanctions_expires_at_idx ON public.user_sanctions(expires_at) WHERE expires_at IS NOT NULL;

-- 7. RLS (Row Level Security) ポリシー
ALTER TABLE public.content_moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_filter_config ENABLE ROW LEVEL SECURITY;

-- 管理者のみがモデレーションログを閲覧可能
-- CREATE POLICY "Moderators can view moderation logs" ON public.content_moderation_logs
--   FOR SELECT USING (auth.jwt() ->> 'role' = 'moderator' OR auth.jwt() ->> 'role' = 'admin');

-- ユーザーは自分の報告を閲覧可能
CREATE POLICY "Users can view their own reports" ON public.user_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ユーザーは自分の制裁を閲覧可能
CREATE POLICY "Users can view their own sanctions" ON public.user_sanctions
  FOR SELECT USING (auth.uid() = user_id);

-- 8. 初期設定データの挿入
INSERT INTO public.content_filter_config (config_key, config_value, description, category) VALUES
('auto_moderation_enabled', 'true', '自動モデレーションの有効化', 'ai_moderation'),
('keyword_filtering_enabled', 'true', 'キーワードフィルタリングの有効化', 'keyword_filtering'),
('min_confidence_threshold', '0.8', 'AI判定の最小信頼度', 'ai_moderation'),
('auto_block_threshold', '0.9', '自動ブロックの閾値', 'auto_sanctions'),
('max_reports_per_user_per_day', '10', 'ユーザーあたりの1日最大報告数', 'user_reporting'),
('review_queue_priority_threshold', '7', 'レビュー優先度の閾値', 'review_thresholds');

-- 基本的な禁止キーワードの挿入（日本語）
INSERT INTO public.banned_keywords (keyword, keyword_type, category, severity, language_code, auto_block) VALUES
-- プロファニティ
('死ね', 'exact_match', 'harassment', 9, 'ja', true),
('殺す', 'exact_match', 'violence', 10, 'ja', true),
('バカ', 'exact_match', 'harassment', 3, 'ja', false),
('アホ', 'exact_match', 'harassment', 3, 'ja', false),

-- スパム関連
('宣伝', 'partial_match', 'spam', 5, 'ja', false),
('副業', 'partial_match', 'spam', 6, 'ja', false),
('稼げる', 'partial_match', 'spam', 6, 'ja', false),

-- 個人情報関連
('\d{3}-\d{4}-\d{4}', 'regex_pattern', 'personal_info', 8, 'ja', true), -- 電話番号パターン
('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', 'regex_pattern', 'personal_info', 7, 'ja', true); -- メールアドレスパターン

-- 9. RPC関数の作成

-- コンテンツをモデレーション検査
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
  
  -- 最終的なアクションを決定
  IF is_auto_blocked OR total_severity >= block_threshold THEN
    final_action := 'auto_blocked';
    is_auto_blocked := TRUE;
  ELSIF total_severity >= 5 THEN
    final_action := 'flagged';
  ELSE
    final_action := 'approved';
  END IF;
  
  -- モデレーションログに記録
  INSERT INTO content_moderation_logs (
    content_type, content_id, user_id, original_content,
    moderation_action, violation_categories, severity_score,
    detection_method, ip_address, user_agent
  ) VALUES (
    content_type_param, content_id_param, user_id_param, content_text,
    final_action, to_jsonb(violations), total_severity,
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

-- ユーザーレポートを提出
CREATE OR REPLACE FUNCTION submit_user_report(
  reporter_id_param UUID,
  reported_user_id_param UUID,
  content_type_param TEXT,
  content_id_param UUID,
  report_reason_param TEXT,
  report_description_param TEXT DEFAULT NULL,
  ip_address_param INET DEFAULT NULL,
  user_agent_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  report_id UUID,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_report_id UUID;
  daily_report_count INTEGER;
  max_daily_reports INTEGER DEFAULT 10;
BEGIN
  -- 日次レポート制限の確認
  SELECT (config_value::TEXT)::INTEGER INTO max_daily_reports
  FROM content_filter_config
  WHERE config_key = 'max_reports_per_user_per_day' AND is_active = TRUE;
  
  max_daily_reports := COALESCE(max_daily_reports, 10);
  
  -- 今日の報告数をチェック
  SELECT COUNT(*) INTO daily_report_count
  FROM user_reports
  WHERE reporter_id = reporter_id_param
    AND created_at >= CURRENT_DATE;
  
  IF daily_report_count >= max_daily_reports THEN
    RETURN QUERY SELECT
      NULL::UUID as report_id,
      'rate_limited'::TEXT as status,
      '1日の報告上限に達しました'::TEXT as message;
    RETURN;
  END IF;
  
  -- 重複報告のチェック
  IF EXISTS (
    SELECT 1 FROM user_reports
    WHERE reporter_id = reporter_id_param
      AND reported_user_id = reported_user_id_param
      AND content_type = content_type_param
      AND content_id = content_id_param
      AND created_at >= NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN QUERY SELECT
      NULL::UUID as report_id,
      'duplicate'::TEXT as status,
      '同じコンテンツの報告が既に存在します'::TEXT as message;
    RETURN;
  END IF;
  
  -- レポートを挿入
  INSERT INTO user_reports (
    reporter_id, reported_user_id, content_type, content_id,
    report_reason, report_description, ip_address, user_agent
  ) VALUES (
    reporter_id_param, reported_user_id_param, content_type_param, content_id_param,
    report_reason_param, report_description_param, ip_address_param, user_agent_param
  ) RETURNING id INTO new_report_id;
  
  RETURN QUERY SELECT
    new_report_id as report_id,
    'submitted'::TEXT as status,
    '報告が正常に提出されました'::TEXT as message;
END;
$$;

-- ユーザーの制裁状況をチェック
CREATE OR REPLACE FUNCTION check_user_sanctions(user_id_param UUID)
RETURNS TABLE (
  is_sanctioned BOOLEAN,
  active_sanctions JSONB,
  can_post BOOLEAN,
  can_comment BOOLEAN,
  can_chat BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sanctions_data JSONB DEFAULT '[]'::JSONB;
  sanction_record RECORD;
  has_active_sanctions BOOLEAN DEFAULT FALSE;
  posting_allowed BOOLEAN DEFAULT TRUE;
  commenting_allowed BOOLEAN DEFAULT TRUE;
  chatting_allowed BOOLEAN DEFAULT TRUE;
BEGIN
  -- アクティブな制裁を取得
  FOR sanction_record IN
    SELECT sanction_type, reason, starts_at, expires_at
    FROM user_sanctions
    WHERE user_id = user_id_param
      AND is_active = TRUE
      AND starts_at <= NOW()
      AND (expires_at IS NULL OR expires_at > NOW())
  LOOP
    has_active_sanctions := TRUE;
    
    -- 制裁の種類に応じて権限を制限
    CASE sanction_record.sanction_type
      WHEN 'temporary_mute', 'permanent_mute' THEN
        posting_allowed := FALSE;
        commenting_allowed := FALSE;
        chatting_allowed := FALSE;
      WHEN 'temporary_ban', 'permanent_ban' THEN
        posting_allowed := FALSE;
        commenting_allowed := FALSE;
        chatting_allowed := FALSE;
      WHEN 'content_restriction' THEN
        posting_allowed := FALSE;
        commenting_allowed := FALSE;
      WHEN 'shadow_ban' THEN
        -- シャドウバンは表面上は制限なし（内部的に処理）
        NULL;
    END CASE;
    
    -- 制裁データをJSONBに追加
    sanctions_data := sanctions_data || jsonb_build_object(
      'type', sanction_record.sanction_type,
      'reason', sanction_record.reason,
      'starts_at', sanction_record.starts_at,
      'expires_at', sanction_record.expires_at
    );
  END LOOP;
  
  RETURN QUERY SELECT
    has_active_sanctions as is_sanctioned,
    sanctions_data as active_sanctions,
    posting_allowed as can_post,
    commenting_allowed as can_comment,
    chatting_allowed as can_chat;
END;
$$;