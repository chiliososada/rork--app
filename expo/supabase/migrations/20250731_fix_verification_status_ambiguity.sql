-- Fix ambiguous verification_status column references
-- 解决verification_status列引用的歧义性问题

-- Drop existing function first to allow changing return type
DROP FUNCTION IF EXISTS check_minimum_age_compliance(uuid);

-- Update check_minimum_age_compliance function to use a different column name
-- to avoid conflicts with check_age_verification_status function
CREATE OR REPLACE FUNCTION check_minimum_age_compliance(user_id_param UUID)
RETURNS TABLE (
  is_compliant BOOLEAN,
  age INTEGER,
  age_verified_status BOOLEAN,  -- Renamed from verification_status to age_verified_status
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
    u.birth_date, 
    u.age_verified, 
    u.verification_date
  INTO 
    user_birth_date, 
    user_age_verified, 
    user_verification_date
  FROM users u
  WHERE u.id = user_id_param;

  -- If no birth date, user is not compliant
  IF user_birth_date IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, FALSE, NULL::TIMESTAMP WITH TIME ZONE, TRUE;
    RETURN;
  END IF;

  -- Calculate current age
  calculated_age := calculate_age(user_birth_date);

  -- No reverification needed for adults in 18+ service

  RETURN QUERY SELECT 
    (calculated_age >= 18 AND user_age_verified),
    calculated_age,
    user_age_verified,
    user_verification_date,
    FALSE; -- No reverification needed for 18+ service
END;
$$;

-- Update check_age_verification_status function to use fully qualified column names
-- to avoid any remaining ambiguity issues
CREATE OR REPLACE FUNCTION check_age_verification_status(user_id_param UUID)
RETURNS TABLE (
  is_verified BOOLEAN,
  verification_method TEXT,
  verification_status TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  calculated_age INTEGER,
  needs_reverification BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  verification_record RECORD;
BEGIN
  -- 获取最新的已通过验证记录 (使用完全限定的列名)
  SELECT 
    avr.verification_method,
    avr.verification_status,
    avr.verified_at,
    avr.expires_at,
    avr.calculated_age
  INTO verification_record
  FROM age_verification_records avr
  WHERE avr.user_id = user_id_param 
    AND avr.verification_status = 'approved'
    AND (avr.expires_at IS NULL OR avr.expires_at > NOW())
  ORDER BY avr.verified_at DESC
  LIMIT 1;
  
  IF verification_record IS NOT NULL THEN
    -- 检查是否需要重新验证
    RETURN QUERY SELECT 
      TRUE as is_verified,
      verification_record.verification_method,
      verification_record.verification_status,
      verification_record.verified_at,
      verification_record.expires_at,
      verification_record.calculated_age,
      (verification_record.expires_at IS NOT NULL AND 
       verification_record.expires_at - NOW() < INTERVAL '30 days') as needs_reverification;
  ELSE
    -- 未验证或验证已过期
    RETURN QUERY SELECT 
      FALSE as is_verified,
      NULL::TEXT as verification_method,
      'not_verified'::TEXT as verification_status,
      NULL::TIMESTAMP WITH TIME ZONE as verified_at,
      NULL::TIMESTAMP WITH TIME ZONE as expires_at,
      NULL::INTEGER as calculated_age,
      TRUE as needs_reverification;
  END IF;
END;
$$;