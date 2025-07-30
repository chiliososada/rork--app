-- Age Verification System  
-- 年齢確認システム

-- 1. Add age verification columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'self_declared' 
  CHECK (verification_method IN ('self_declared', 'document', 'parent_consent', 'credit_card')),
ADD COLUMN IF NOT EXISTS verification_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS minimum_age_met BOOLEAN DEFAULT FALSE;

-- 2. Create age verification audit table
CREATE TABLE public.age_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  verification_attempt_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  birth_date_provided DATE,
  calculated_age INTEGER,
  verification_method TEXT,
  verification_successful BOOLEAN,
  failure_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX age_verification_logs_user_id_idx ON public.age_verification_logs(user_id);
CREATE INDEX age_verification_logs_created_at_idx ON public.age_verification_logs(created_at DESC);
CREATE INDEX users_age_verified_idx ON public.users(age_verified);
CREATE INDEX users_birth_date_idx ON public.users(birth_date);

-- 4. Function to calculate age from birth date
CREATE OR REPLACE FUNCTION calculate_age(birth_date_param DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date_param));
END;
$$;

-- 5. Function to verify user age (minimum 13 years old for Japan compliance)
CREATE OR REPLACE FUNCTION verify_user_age(
  user_id_param UUID,
  birth_date_param DATE,
  verification_method_param TEXT DEFAULT 'self_declared',
  ip_address_param INET DEFAULT NULL,
  user_agent_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  age INTEGER,
  message TEXT,
  requires_parent_consent BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_age INTEGER;
  current_verification_status BOOLEAN;
  minimum_age_constant INTEGER := 18; -- Adult content age requirement
BEGIN
  -- Calculate age
  calculated_age := calculate_age(birth_date_param);
  
  -- Check current verification status
  SELECT age_verified INTO current_verification_status
  FROM users
  WHERE id = user_id_param;

  -- Log the verification attempt
  INSERT INTO age_verification_logs (
    user_id,
    birth_date_provided,
    calculated_age,
    verification_method,
    verification_successful,
    failure_reason,
    ip_address,
    user_agent
  ) VALUES (
    user_id_param,
    birth_date_param,
    calculated_age,
    verification_method_param,
    calculated_age >= minimum_age_constant,
    CASE 
      WHEN calculated_age < minimum_age_constant THEN '年齢制限に満たない（18歳未満）'
      WHEN calculated_age > 120 THEN '無効な生年月日'
      ELSE NULL
    END,
    ip_address_param,
    user_agent_param
  );

  -- Validate age
  IF calculated_age < minimum_age_constant THEN
    RETURN QUERY SELECT 
      FALSE, 
      calculated_age, 
      'このサービスは18歳以上の方のみご利用いただけます'::TEXT,
      FALSE;
    RETURN;
  END IF;

  IF calculated_age > 120 THEN
    RETURN QUERY SELECT 
      FALSE, 
      calculated_age, 
      '有効な生年月日を入力してください'::TEXT,
      FALSE;
    RETURN;
  END IF;

  -- Update user verification status
  UPDATE users
  SET 
    birth_date = birth_date_param,
    age_verified = TRUE,
    verification_method = verification_method_param,
    verification_date = NOW(),
    minimum_age_met = TRUE
  WHERE id = user_id_param;

  -- Return success
  RETURN QUERY SELECT 
    TRUE, 
    calculated_age,
    '年齢確認が完了しました'::TEXT,
    FALSE;
END;
$$;

-- 6. Function to check if user meets minimum age requirements
CREATE OR REPLACE FUNCTION check_minimum_age_compliance(user_id_param UUID)
RETURNS TABLE (
  is_compliant BOOLEAN,
  age INTEGER,
  verification_status BOOLEAN,
  verification_date TIMESTAMP WITH TIME ZONE,
  needs_reverification BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  user_birth_date DATE;
  user_age_verified BOOLEAN;
  user_verification_date TIMESTAMP WITH TIME ZONE;
  calculated_age INTEGER;
  reverification_needed BOOLEAN := FALSE;
BEGIN
  -- Get user data
  SELECT 
    birth_date, 
    age_verified, 
    verification_date
  INTO 
    user_birth_date, 
    user_age_verified, 
    user_verification_date
  FROM users
  WHERE id = user_id_param;

  -- If no birth date, user is not compliant
  IF user_birth_date IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, FALSE, NULL::TIMESTAMP WITH TIME ZONE, TRUE;
    RETURN;
  END IF;

  -- Calculate current age
  calculated_age := calculate_age(user_birth_date);

  -- Check if reverification is needed (verification older than 1 year for users under 18)
  IF user_verification_date IS NOT NULL AND calculated_age < 18 THEN
    reverification_needed := user_verification_date < NOW() - INTERVAL '1 year';
  END IF;

  RETURN QUERY SELECT 
    (calculated_age >= 13 AND user_age_verified),
    calculated_age,
    user_age_verified,
    user_verification_date,
    reverification_needed;
END;
$$;

-- 7. Function to get age verification statistics
CREATE OR REPLACE FUNCTION get_age_verification_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  total_attempts INTEGER,
  successful_verifications INTEGER,
  failed_verifications INTEGER,
  underage_attempts INTEGER,
  average_age NUMERIC,
  verification_methods JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_date TIMESTAMP WITH TIME ZONE;
BEGIN
  start_date := NOW() - (days_back || ' days')::INTERVAL;
  
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_attempts,
    COUNT(CASE WHEN verification_successful THEN 1 END)::INTEGER as successful_verifications,
    COUNT(CASE WHEN NOT verification_successful THEN 1 END)::INTEGER as failed_verifications,
    COUNT(CASE WHEN calculated_age < 18 THEN 1 END)::INTEGER as underage_attempts,
    ROUND(AVG(CASE WHEN verification_successful THEN calculated_age END), 1) as average_age,
    jsonb_object_agg(
      verification_method,
      method_counts.count
    ) as verification_methods
  FROM age_verification_logs avl
  JOIN (
    SELECT 
      verification_method,
      COUNT(*) as count
    FROM age_verification_logs
    WHERE created_at >= start_date
    GROUP BY verification_method
  ) method_counts ON method_counts.verification_method = avl.verification_method
  WHERE avl.created_at >= start_date;
END;
$$;

-- 8. Function to handle user account restriction for underage users
CREATE OR REPLACE FUNCTION restrict_underage_account(user_id_param UUID)
RETURNS TABLE (
  restricted BOOLEAN,
  restriction_reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  user_age INTEGER;
  user_verified BOOLEAN;
BEGIN
  -- Get user age and verification status
  SELECT 
    calculate_age(birth_date),
    age_verified
  INTO user_age, user_verified
  FROM users
  WHERE id = user_id_param;

  -- If user is under 18 or not verified, restrict account
  IF user_age < 18 OR NOT user_verified THEN
    -- Note: In a full implementation, you might want to add an account_status column
    -- For now, we'll just return the restriction info
    RETURN QUERY SELECT 
      TRUE,
      CASE 
        WHEN user_age < 18 THEN '18歳未満のため利用を制限しています'
        WHEN NOT user_verified THEN '年齢確認が完了していません'
        ELSE 'アカウントが制限されています'
      END::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::TEXT;
  END IF;
END;
$$;

-- 9. Trigger to automatically verify minimum age when birth_date is updated
CREATE OR REPLACE FUNCTION auto_verify_minimum_age()
RETURNS TRIGGER AS $$
DECLARE
  calculated_age INTEGER;
BEGIN
  IF NEW.birth_date IS NOT NULL AND NEW.birth_date != OLD.birth_date THEN
    calculated_age := calculate_age(NEW.birth_date);
    NEW.minimum_age_met := calculated_age >= 18;
    
    -- If age verification was not explicitly set, auto-verify if minimum age is met
    IF NEW.age_verified IS NULL OR NEW.age_verified = OLD.age_verified THEN
      NEW.age_verified := NEW.minimum_age_met;
      IF NEW.minimum_age_met THEN
        NEW.verification_date := NOW();
        NEW.verification_method := 'self_declared';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_verify_age_trigger ON public.users;
CREATE TRIGGER auto_verify_age_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_verify_minimum_age();

-- 10. Add RLS policies
ALTER TABLE public.age_verification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own age verification logs
CREATE POLICY "Users can view their own age verification logs" ON public.age_verification_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: System can insert age verification logs
CREATE POLICY "System can insert age verification logs" ON public.age_verification_logs
  FOR INSERT WITH CHECK (TRUE);

-- 11. Create a view for compliant users (18+ and verified)
CREATE OR REPLACE VIEW compliant_users AS
SELECT 
  u.*,
  calculate_age(u.birth_date) as current_age
FROM users u
WHERE 
  u.birth_date IS NOT NULL 
  AND u.age_verified = TRUE 
  AND calculate_age(u.birth_date) >= 18;

-- Grant access to the view
GRANT SELECT ON compliant_users TO authenticated;

-- 12. Function to cleanup old verification logs (GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_old_verification_logs(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM age_verification_logs
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;