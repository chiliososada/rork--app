-- Sensitive Words Management System Migration
-- Replaces hardcoded sensitive words with database-driven approach

-- ========== Sensitive Words Table ==========

-- Main sensitive words table
CREATE TABLE public.sensitive_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('violence', 'hate', 'sexual', 'spam', 'fraud', 'other')),
  severity INTEGER DEFAULT 1 CHECK (severity BETWEEN 1 AND 3), -- 1(低) 2(中) 3(高)
  language TEXT DEFAULT 'ja' CHECK (language IN ('ja', 'en', 'zh')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Advanced features
  regex_pattern TEXT, -- Support regex matching
  variations JSONB DEFAULT '[]'::jsonb, -- Store word variations ['バカ', 'ばか', '馬鹿']
  context_exceptions JSONB DEFAULT '[]'::jsonb, -- Exception contexts
  auto_action TEXT DEFAULT 'pending' CHECK (auto_action IN ('pending', 'rejected', 'approved')),
  
  -- Metadata
  description TEXT, -- Admin notes about this word
  source TEXT, -- Where this word came from (import, manual, etc.)
  last_matched_at TIMESTAMP WITH TIME ZONE, -- When was this word last matched
  match_count INTEGER DEFAULT 0 -- How many times this word has been matched
);

-- Performance indexes
CREATE INDEX sensitive_words_active_idx ON public.sensitive_words(is_active, language);
CREATE INDEX sensitive_words_category_idx ON public.sensitive_words(category);
CREATE INDEX sensitive_words_word_idx ON public.sensitive_words(word);
CREATE INDEX sensitive_words_severity_idx ON public.sensitive_words(severity DESC);
CREATE INDEX sensitive_words_updated_idx ON public.sensitive_words(updated_at DESC);

-- Full-text search index for admin interface (using simple config for compatibility)
CREATE INDEX sensitive_words_search_idx ON public.sensitive_words USING gin(to_tsvector('simple', word || ' ' || COALESCE(description, '')));

-- ========== Sensitive Word Matches Log Table ==========

-- Log all matches for analysis and audit
CREATE TABLE public.sensitive_word_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID REFERENCES public.sensitive_words(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('topic', 'comment', 'chat_message')),
  content_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  matched_text TEXT NOT NULL, -- The actual text that matched
  matched_word TEXT NOT NULL, -- The sensitive word that was matched
  context_text TEXT, -- Surrounding context (for analysis)
  match_position INTEGER, -- Position in the content
  severity INTEGER, -- Severity level at time of match
  action_taken TEXT NOT NULL CHECK (action_taken IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional metadata
  user_agent TEXT,
  ip_address INET,
  match_method TEXT DEFAULT 'exact' CHECK (match_method IN ('exact', 'regex', 'variation'))
);

-- Performance indexes for matches log
CREATE INDEX sensitive_word_matches_word_idx ON public.sensitive_word_matches(word_id);
CREATE INDEX sensitive_word_matches_content_idx ON public.sensitive_word_matches(content_type, content_id);
CREATE INDEX sensitive_word_matches_user_idx ON public.sensitive_word_matches(user_id);
CREATE INDEX sensitive_word_matches_created_idx ON public.sensitive_word_matches(created_at DESC);
CREATE INDEX sensitive_word_matches_action_idx ON public.sensitive_word_matches(action_taken);

-- Composite index for analytics
CREATE INDEX sensitive_word_matches_stats_idx ON public.sensitive_word_matches(word_id, created_at DESC, action_taken);

-- ========== RPC Functions ==========

-- Function to get active sensitive words (with caching support)
CREATE OR REPLACE FUNCTION get_active_sensitive_words(
  language_param TEXT DEFAULT 'ja',
  include_variations BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id UUID,
  word TEXT,
  category TEXT,
  severity INTEGER,
  variations JSONB,
  regex_pattern TEXT,
  auto_action TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sw.id,
    sw.word,
    sw.category,
    sw.severity,
    CASE 
      WHEN include_variations THEN sw.variations 
      ELSE '[]'::jsonb 
    END as variations,
    sw.regex_pattern,
    sw.auto_action
  FROM sensitive_words sw
  WHERE 
    sw.is_active = TRUE 
    AND sw.language = language_param
  ORDER BY sw.severity DESC, sw.match_count DESC;
END;
$$;

-- Function to add a new sensitive word
CREATE OR REPLACE FUNCTION add_sensitive_word(
  word_param TEXT,
  category_param TEXT,
  severity_param INTEGER DEFAULT 1,
  language_param TEXT DEFAULT 'ja',
  variations_param JSONB DEFAULT '[]'::jsonb,
  description_param TEXT DEFAULT NULL,
  created_by_param UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_word_id UUID;
BEGIN
  INSERT INTO sensitive_words (
    word,
    category,
    severity,
    language,
    variations,
    description,
    created_by,
    source
  ) VALUES (
    LOWER(TRIM(word_param)),
    category_param,
    severity_param,
    language_param,
    variations_param,
    description_param,
    created_by_param,
    'manual'
  )
  RETURNING id INTO new_word_id;
  
  RETURN new_word_id;
END;
$$;

-- Function to batch import sensitive words
CREATE OR REPLACE FUNCTION bulk_import_sensitive_words(
  words_data JSONB,
  created_by_param UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  word_record JSONB;
  inserted_count INTEGER := 0;
BEGIN
  FOR word_record IN SELECT * FROM jsonb_array_elements(words_data)
  LOOP
    BEGIN
      INSERT INTO sensitive_words (
        word,
        category,
        severity,
        language,
        variations,
        description,
        created_by,
        source
      ) VALUES (
        LOWER(TRIM(word_record->>'word')),
        COALESCE(word_record->>'category', 'other'),
        COALESCE((word_record->>'severity')::INTEGER, 1),
        COALESCE(word_record->>'language', 'ja'),
        COALESCE(word_record->'variations', '[]'::jsonb),
        word_record->>'description',
        created_by_param,
        'bulk_import'
      );
      
      inserted_count := inserted_count + 1;
      
    EXCEPTION WHEN unique_violation THEN
      -- Skip duplicate words
      CONTINUE;
    END;
  END LOOP;
  
  RETURN inserted_count;
END;
$$;

-- Function to log a sensitive word match
CREATE OR REPLACE FUNCTION log_sensitive_word_match(
  word_id_param UUID,
  content_type_param TEXT,
  content_id_param UUID,
  user_id_param UUID,
  matched_text_param TEXT,
  matched_word_param TEXT,
  context_text_param TEXT DEFAULT NULL,
  match_position_param INTEGER DEFAULT NULL,
  action_taken_param TEXT DEFAULT 'pending',
  match_method_param TEXT DEFAULT 'exact'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  match_id UUID;
  word_severity INTEGER;
BEGIN
  -- Get word severity
  SELECT severity INTO word_severity 
  FROM sensitive_words 
  WHERE id = word_id_param;
  
  -- Insert match log
  INSERT INTO sensitive_word_matches (
    word_id,
    content_type,
    content_id,
    user_id,
    matched_text,
    matched_word,
    context_text,
    match_position,
    severity,
    action_taken,
    match_method
  ) VALUES (
    word_id_param,
    content_type_param,
    content_id_param,
    user_id_param,
    matched_text_param,
    matched_word_param,
    context_text_param,
    match_position_param,
    COALESCE(word_severity, 1),
    action_taken_param,
    match_method_param
  )
  RETURNING id INTO match_id;
  
  -- Update word statistics
  UPDATE sensitive_words 
  SET 
    match_count = match_count + 1,
    last_matched_at = NOW()
  WHERE id = word_id_param;
  
  RETURN match_id;
END;
$$;

-- Function to get sensitive word statistics
CREATE OR REPLACE FUNCTION get_sensitive_word_stats(
  date_from TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  date_to TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  word TEXT,
  category TEXT,
  total_matches BIGINT,
  pending_matches BIGINT,
  rejected_matches BIGINT,
  approved_matches BIGINT,
  avg_severity NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sw.word,
    sw.category,
    COUNT(swm.id) as total_matches,
    COUNT(swm.id) FILTER (WHERE swm.action_taken = 'pending') as pending_matches,
    COUNT(swm.id) FILTER (WHERE swm.action_taken = 'rejected') as rejected_matches,
    COUNT(swm.id) FILTER (WHERE swm.action_taken = 'approved') as approved_matches,
    AVG(swm.severity) as avg_severity
  FROM sensitive_words sw
  LEFT JOIN sensitive_word_matches swm ON sw.id = swm.word_id
    AND swm.created_at BETWEEN date_from AND date_to
  WHERE sw.is_active = TRUE
  GROUP BY sw.id, sw.word, sw.category
  ORDER BY total_matches DESC, sw.severity DESC;
END;
$$;

-- Function to update word metadata (for cache invalidation)
CREATE OR REPLACE FUNCTION update_sensitive_word_cache_timestamp()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
DECLARE
  latest_update TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT MAX(updated_at) INTO latest_update 
  FROM sensitive_words 
  WHERE is_active = TRUE;
  
  RETURN COALESCE(latest_update, NOW());
END;
$$;

-- ========== Triggers ==========

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_sensitive_words_updated_at
  BEFORE UPDATE ON public.sensitive_words
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========== Row Level Security ==========

-- Enable RLS on sensitive words tables
ALTER TABLE public.sensitive_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitive_word_matches ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active sensitive words (for filtering)
CREATE POLICY "Anyone can read active sensitive words" ON public.sensitive_words
  FOR SELECT USING (is_active = TRUE);

-- Policy: Only authenticated users can see match logs (their own)
CREATE POLICY "Users can view their own match logs" ON public.sensitive_word_matches
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: System can insert match logs
CREATE POLICY "System can insert match logs" ON public.sensitive_word_matches
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ========== Comments and Documentation ==========

COMMENT ON TABLE public.sensitive_words IS 'Database-driven sensitive word management for content filtering';
COMMENT ON TABLE public.sensitive_word_matches IS 'Audit log of all sensitive word matches for analysis and compliance';

COMMENT ON COLUMN public.sensitive_words.severity IS '1=Low (pending), 2=Medium (pending), 3=High (rejected)';
COMMENT ON COLUMN public.sensitive_words.variations IS 'JSON array of word variations for comprehensive matching';
COMMENT ON COLUMN public.sensitive_words.context_exceptions IS 'JSON array of contexts where this word should not trigger';
COMMENT ON COLUMN public.sensitive_words.auto_action IS 'Automatic action to take when this word is matched';

-- ========== Initial Data Setup ==========

-- We'll populate this with the existing 50 Japanese sensitive words in the next migration step
-- This ensures the table structure is ready for data import