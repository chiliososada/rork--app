-- Content Reporting System
-- コンテンツ通報システム

-- 1. Create report categories table
CREATE TABLE public.report_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT UNIQUE NOT NULL,
  display_name_ja TEXT NOT NULL,
  display_name_en TEXT NOT NULL,
  description_ja TEXT,
  description_en TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  requires_details BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('topic', 'comment', 'chat_message', 'user', 'private_message')),
  content_id UUID, -- Can be topic_id, comment_id, message_id, or null for user reports
  category_id UUID REFERENCES public.report_categories(id),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed', 'escalated')),
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5), -- 1=low, 5=critical
  admin_notes TEXT,
  admin_id UUID REFERENCES public.users(id), -- Admin who handled the report
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure content_id is provided for content reports
  CONSTRAINT check_content_id_for_content_reports 
    CHECK (
      (content_type = 'user' AND content_id IS NULL) OR 
      (content_type != 'user' AND content_id IS NOT NULL)
    )
);

-- 3. Insert default report categories (Japanese-focused)
INSERT INTO public.report_categories (category_key, display_name_ja, display_name_en, description_ja, description_en, requires_details, sort_order) VALUES
('spam', 'スパム', 'Spam', 'スパムや宣伝目的の投稿', 'Spam or promotional content', FALSE, 1),
('harassment', 'ハラスメント', 'Harassment', 'いじめや嫌がらせ行為', 'Bullying or harassment behavior', TRUE, 2),
('inappropriate_content', '不適切な内容', 'Inappropriate Content', '性的、暴力的、または不適切な内容', 'Sexual, violent, or inappropriate content', TRUE, 3),
('hate_speech', 'ヘイトスピーチ', 'Hate Speech', '差別的発言や憎悪表現', 'Discriminatory or hateful speech', TRUE, 4),
('false_information', '虚偽情報', 'False Information', 'デマや偽情報の拡散', 'Spreading misinformation or false information', TRUE, 5),
('privacy_violation', 'プライバシー侵害', 'Privacy Violation', '個人情報の無断公開', 'Unauthorized disclosure of personal information', TRUE, 6),
('copyright_violation', '著作権侵害', 'Copyright Violation', '著作権の侵害', 'Copyright infringement', TRUE, 7),
('underage_user', '年齢制限違反', 'Underage User', '未成年者の利用', 'Underage user violation', TRUE, 8),
('impersonation', 'なりすまし', 'Impersonation', '他人になりすます行為', 'Impersonating another person', TRUE, 9),
('other', 'その他', 'Other', 'その他の問題', 'Other issues not listed above', TRUE, 10);

-- 4. Create indexes for performance
CREATE INDEX reports_reporter_id_idx ON public.reports(reporter_id);
CREATE INDEX reports_reported_user_id_idx ON public.reports(reported_user_id);
CREATE INDEX reports_content_type_id_idx ON public.reports(content_type, content_id);
CREATE INDEX reports_status_idx ON public.reports(status);
CREATE INDEX reports_created_at_idx ON public.reports(created_at DESC);
CREATE INDEX reports_category_id_idx ON public.reports(category_id);

-- 5. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_updated_at_trigger
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();

-- 6. Function to submit a report
CREATE OR REPLACE FUNCTION submit_report(
  reporter_id_param UUID,
  reported_user_id_param UUID,
  content_type_param TEXT,
  category_id_param UUID,
  reason_param TEXT,
  content_id_param UUID DEFAULT NULL,
  description_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  report_id UUID,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  new_report_id UUID;
  existing_report UUID;
  category_requires_details BOOLEAN;
BEGIN
  -- Check if user is trying to report themselves
  IF reporter_id_param = reported_user_id_param THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, '自分自身を通報することはできません'::TEXT;
    RETURN;
  END IF;

  -- Check if report already exists for this content
  IF content_id_param IS NOT NULL THEN
    SELECT id INTO existing_report
    FROM reports
    WHERE reporter_id = reporter_id_param
      AND content_type = content_type_param
      AND content_id = content_id_param
      AND status != 'dismissed';

    IF existing_report IS NOT NULL THEN
      RETURN QUERY SELECT existing_report, FALSE, '既にこのコンテンツを通報済みです'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Check if category requires details
  SELECT requires_details INTO category_requires_details
  FROM report_categories
  WHERE id = category_id_param;

  IF category_requires_details AND (description_param IS NULL OR description_param = '') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'この通報カテゴリには詳細な説明が必要です'::TEXT;
    RETURN;
  END IF;

  -- Insert the report
  INSERT INTO reports (
    reporter_id,
    reported_user_id,
    content_type,
    content_id,
    category_id,
    reason,
    description,
    priority
  ) VALUES (
    reporter_id_param,
    reported_user_id_param,
    content_type_param,
    content_id_param,
    category_id_param,
    reason_param,
    description_param,
    CASE 
      WHEN category_id_param IN (
        SELECT id FROM report_categories 
        WHERE category_key IN ('harassment', 'hate_speech', 'underage_user')
      ) THEN 4  -- High priority
      WHEN category_id_param IN (
        SELECT id FROM report_categories 
        WHERE category_key IN ('inappropriate_content', 'privacy_violation')
      ) THEN 3  -- Medium-high priority
      ELSE 2    -- Normal priority
    END
  ) RETURNING id INTO new_report_id;

  RETURN QUERY SELECT new_report_id, TRUE, '通報を受け付けました'::TEXT;
END;
$$;

-- 7. Function to get user's report history
CREATE OR REPLACE FUNCTION get_user_reports(
  user_id_param UUID,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  report_id UUID,
  reported_user_name TEXT,
  content_type TEXT,
  category_name TEXT,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id as report_id,
    u.nickname as reported_user_name,
    r.content_type,
    rc.display_name_ja as category_name,
    r.reason,
    r.status,
    r.created_at,
    r.resolved_at
  FROM reports r
  JOIN users u ON u.id = r.reported_user_id
  JOIN report_categories rc ON rc.id = r.category_id
  WHERE r.reporter_id = user_id_param
  ORDER BY r.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 8. Function to check if content has been reported
CREATE OR REPLACE FUNCTION check_content_reported(
  user_id_param UUID,
  content_type_param TEXT,
  content_id_param UUID
)
RETURNS TABLE (
  is_reported BOOLEAN,
  report_status TEXT,
  report_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (r.id IS NOT NULL) as is_reported,
    r.status as report_status,
    r.created_at as report_date
  FROM reports r
  WHERE r.reporter_id = user_id_param
    AND r.content_type = content_type_param
    AND r.content_id = content_id_param
    AND r.status != 'dismissed'
  ORDER BY r.created_at DESC
  LIMIT 1;
END;
$$;

-- 9. Function to get report statistics (for admin dashboard)
CREATE OR REPLACE FUNCTION get_report_statistics(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_reports INTEGER,
  pending_reports INTEGER,
  resolved_reports INTEGER,
  dismissed_reports INTEGER,
  category_breakdown JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_date TIMESTAMP WITH TIME ZONE;
BEGIN
  start_date := NOW() - (days_back || ' days')::INTERVAL;
  
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_reports,
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as pending_reports,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END)::INTEGER as resolved_reports,
    COUNT(CASE WHEN status = 'dismissed' THEN 1 END)::INTEGER as dismissed_reports,
    jsonb_object_agg(
      rc.display_name_ja,
      category_counts.count
    ) as category_breakdown
  FROM reports r
  JOIN report_categories rc ON rc.id = r.category_id
  JOIN (
    SELECT 
      category_id,
      COUNT(*) as count
    FROM reports
    WHERE created_at >= start_date
    GROUP BY category_id
  ) category_counts ON category_counts.category_id = r.category_id
  WHERE r.created_at >= start_date;
END;
$$;

-- 10. Add RLS policies
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own reports
CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (
    auth.uid() = reporter_id
  );

-- Policy: Users can create reports
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (
    auth.uid() = reporter_id AND
    auth.uid() != reported_user_id -- Cannot report yourself
  );

-- Policy: Only authenticated users can update their pending reports (e.g., to add more details)
CREATE POLICY "Users can update their pending reports" ON public.reports
  FOR UPDATE USING (
    auth.uid() = reporter_id AND 
    status = 'pending'
  );

-- Policy: Anyone can view active report categories
CREATE POLICY "Anyone can view report categories" ON public.report_categories
  FOR SELECT USING (is_active = TRUE);

-- 11. Function to auto-escalate high-priority reports
CREATE OR REPLACE FUNCTION auto_escalate_reports()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  escalated_count INTEGER;
BEGIN
  -- Auto-escalate reports that have been pending for more than 24 hours and are high priority
  UPDATE reports
  SET 
    status = 'escalated',
    updated_at = NOW()
  WHERE 
    status = 'pending'
    AND priority >= 4
    AND created_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS escalated_count = ROW_COUNT;
  RETURN escalated_count;
END;
$$;