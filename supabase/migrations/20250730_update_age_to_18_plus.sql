-- Update age verification system to 18+ requirement
-- 18歳以上向けに年齢確認システムを更新

-- Update the verify_user_age function to use 18 as minimum age
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
  minimum_age_constant INTEGER := 18; -- Updated from 13 to 18
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

  -- Return success (removed parent consent logic)
  RETURN QUERY SELECT 
    TRUE, 
    calculated_age,
    '年齢確認が完了しました'::TEXT,
    FALSE;
END;
$$;

-- Update the restrict_underage_account function
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

-- Update the auto_verify_minimum_age trigger function
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

-- Drop existing view first to avoid column mismatch error
DROP VIEW IF EXISTS compliant_users CASCADE;

-- Create the compliant_users view
CREATE VIEW compliant_users AS
SELECT 
  u.*,
  calculate_age(u.birth_date) as current_age
FROM users u
WHERE 
  u.birth_date IS NOT NULL 
  AND u.age_verified = TRUE 
  AND calculate_age(u.birth_date) >= 18;

-- Re-grant access to the view
GRANT SELECT ON compliant_users TO authenticated;

-- Update age verification statistics function
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

-- Update check_minimum_age_compliance function
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

  -- No reverification needed for adults
  -- Removed logic for reverification of users under 18

  RETURN QUERY SELECT 
    (calculated_age >= 18 AND user_age_verified),
    calculated_age,
    user_age_verified,
    user_verification_date,
    FALSE; -- No reverification needed for 18+ service
END;
$$;