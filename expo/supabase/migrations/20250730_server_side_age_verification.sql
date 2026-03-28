-- 服务器端年龄验证系统
-- 确保18+应用的合规性和安全性

-- 1. 年龄验证记录表
CREATE TABLE public.age_verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 验证方法和状态
  verification_method TEXT NOT NULL CHECK (verification_method IN (
    'self_declared',      -- 自我声明（最基本）
    'document_upload',    -- 文档上传验证
    'credit_card',        -- 信用卡验证
    'phone_verification', -- 手机号验证
    'parent_consent'      -- 家长同意（如适用）
  )),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN (
    'pending',      -- 待审核
    'approved',     -- 已通过
    'rejected',     -- 已拒绝
    'expired',      -- 已过期
    'revoked'       -- 已撤销
  )),
  
  -- 验证数据
  declared_birth_date DATE,              -- 声明的出生日期
  calculated_age INTEGER,                -- 计算的年龄
  document_type TEXT,                    -- 文档类型（驾照、护照等）
  document_verification_hash TEXT,       -- 文档验证哈希（不存储实际文档）
  verification_token TEXT UNIQUE,       -- 验证令牌
  
  -- 审核信息
  verified_by UUID REFERENCES public.users(id), -- 审核者（如果人工审核）
  verification_notes TEXT,               -- 审核备注
  verification_evidence JSONB,          -- 验证证据（加密存储）
  
  -- 安全和合规信息
  ip_address INET,                       -- 验证时的IP地址
  user_agent TEXT,                       -- 用户代理字符串
  geolocation JSONB,                     -- 地理位置信息
  device_fingerprint TEXT,               -- 设备指纹
  session_id TEXT,                       -- 会话ID
  
  -- 时间戳
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 约束
  UNIQUE(user_id, verification_method), -- 每个用户每种方法只能有一条记录
  CHECK (calculated_age IS NULL OR calculated_age >= 0),
  CHECK (declared_birth_date IS NULL OR declared_birth_date <= CURRENT_DATE)
);

-- 2. 年龄验证审核日志表
CREATE TABLE public.age_verification_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID REFERENCES public.age_verification_records(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 审核操作信息
  action TEXT NOT NULL CHECK (action IN (
    'submitted',          -- 提交验证
    'auto_approved',      -- 自动通过
    'auto_rejected',      -- 自动拒绝
    'manual_review',      -- 人工审核
    'approved',           -- 人工通过
    'rejected',           -- 人工拒绝
    'expired',            -- 过期
    'revoked',            -- 撤销
    'appealed',           -- 申诉
    'updated'             -- 更新
  )),
  
  previous_status TEXT,  -- 之前的状态
  new_status TEXT,       -- 新状态
  
  -- 审核者信息
  reviewer_id UUID REFERENCES public.users(id),
  reviewer_notes TEXT,
  
  -- 系统信息
  ip_address INET,
  user_agent TEXT,
  automated BOOLEAN DEFAULT FALSE, -- 是否为自动操作
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 年龄验证配置表
CREATE TABLE public.age_verification_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 配置项
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  
  -- 版本和启用状态
  is_active BOOLEAN DEFAULT TRUE,
  version INTEGER DEFAULT 1,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建索引
CREATE INDEX age_verification_records_user_id_idx ON public.age_verification_records(user_id);
CREATE INDEX age_verification_records_status_idx ON public.age_verification_records(verification_status);
CREATE INDEX age_verification_records_method_idx ON public.age_verification_records(verification_method);
CREATE INDEX age_verification_records_submitted_at_idx ON public.age_verification_records(submitted_at DESC);
CREATE INDEX age_verification_records_expires_at_idx ON public.age_verification_records(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX age_verification_audit_log_verification_id_idx ON public.age_verification_audit_log(verification_id);
CREATE INDEX age_verification_audit_log_user_id_idx ON public.age_verification_audit_log(user_id);
CREATE INDEX age_verification_audit_log_action_idx ON public.age_verification_audit_log(action);
CREATE INDEX age_verification_audit_log_created_at_idx ON public.age_verification_audit_log(created_at DESC);

-- 5. RLS (Row Level Security) 策略
ALTER TABLE public.age_verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_verification_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_verification_config ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的验证记录
CREATE POLICY "Users can view their own age verification records" ON public.age_verification_records
  FOR SELECT USING (auth.uid() = user_id);

-- 用户只能创建自己的验证记录
CREATE POLICY "Users can create their own age verification records" ON public.age_verification_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户可以查看自己的审核日志
CREATE POLICY "Users can view their own audit log" ON public.age_verification_audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- 管理员可以查看所有记录（需要管理员角色）
-- CREATE POLICY "Admins can view all records" ON public.age_verification_records
--   FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- 6. 插入默认配置
INSERT INTO public.age_verification_config (config_key, config_value, description) VALUES
('minimum_age', '18', '最低年龄要求'),
('verification_expiry_days', '365', '验证有效期（天）'),
('require_verification', 'true', '是否强制要求年龄验证'),
('allowed_methods', '["self_declared", "document_upload", "credit_card"]', '允许的验证方法'),
('auto_approve_threshold', '25', '自动通过的年龄阈值'),
('require_revalidation_days', '730', '需要重新验证的天数'),
('blocked_countries', '[]', '禁止访问的国家代码列表'),
('grace_period_hours', '24', '新用户宽限期（小时）');

-- 7. 创建RPC函数

-- 提交年龄验证
CREATE OR REPLACE FUNCTION submit_age_verification(
  user_id_param UUID,
  verification_method_param TEXT,
  declared_birth_date_param DATE,
  ip_address_param INET DEFAULT NULL,
  user_agent_param TEXT DEFAULT NULL,
  device_fingerprint_param TEXT DEFAULT NULL,
  geolocation_param JSONB DEFAULT NULL
)
RETURNS TABLE (
  verification_id UUID,
  status TEXT,
  message TEXT,
  requires_manual_review BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calculated_age_val INTEGER;
  min_age INTEGER;
  auto_approve_threshold INTEGER;
  expiry_days INTEGER;
  verification_record_id UUID;
  verification_status_val TEXT;
  requires_review BOOLEAN DEFAULT FALSE;
  verification_token_val TEXT;
BEGIN
  -- 获取配置
  SELECT (config_value::TEXT)::INTEGER INTO min_age 
  FROM age_verification_config WHERE config_key = 'minimum_age' AND is_active = TRUE;
  
  SELECT (config_value::TEXT)::INTEGER INTO auto_approve_threshold 
  FROM age_verification_config WHERE config_key = 'auto_approve_threshold' AND is_active = TRUE;
  
  SELECT (config_value::TEXT)::INTEGER INTO expiry_days 
  FROM age_verification_config WHERE config_key = 'verification_expiry_days' AND is_active = TRUE;
  
  -- 默认值
  min_age := COALESCE(min_age, 18);
  auto_approve_threshold := COALESCE(auto_approve_threshold, 25);
  expiry_days := COALESCE(expiry_days, 365);
  
  -- 计算年龄
  calculated_age_val := EXTRACT(YEAR FROM AGE(declared_birth_date_param));
  
  -- 检查年龄是否符合要求
  IF calculated_age_val < min_age THEN
    RETURN QUERY SELECT 
      NULL::UUID as verification_id,
      'rejected'::TEXT as status,
      '年龄不符合要求'::TEXT as message,
      FALSE as requires_manual_review;
    RETURN;
  END IF;
  
  -- 生成验证令牌
  verification_token_val := encode(gen_random_bytes(32), 'hex');
  
  -- 确定验证状态
  IF calculated_age_val >= auto_approve_threshold AND verification_method_param = 'self_declared' THEN
    verification_status_val := 'approved';
    requires_review := FALSE;
  ELSE
    verification_status_val := 'pending';
    requires_review := TRUE;
  END IF;
  
  -- 插入或更新验证记录
  INSERT INTO age_verification_records (
    user_id, verification_method, verification_status,
    declared_birth_date, calculated_age, verification_token,
    ip_address, user_agent, device_fingerprint, geolocation,
    submitted_at, verified_at, expires_at
  ) VALUES (
    user_id_param, verification_method_param, verification_status_val,
    declared_birth_date_param, calculated_age_val, verification_token_val,
    ip_address_param, user_agent_param, device_fingerprint_param, geolocation_param,
    NOW(), 
    CASE WHEN verification_status_val = 'approved' THEN NOW() ELSE NULL END,
    CASE WHEN verification_status_val = 'approved' THEN NOW() + INTERVAL '1 day' * expiry_days ELSE NULL END
  )
  ON CONFLICT (user_id, verification_method) 
  DO UPDATE SET
    verification_status = verification_status_val,
    declared_birth_date = declared_birth_date_param,
    calculated_age = calculated_age_val,
    verification_token = verification_token_val,
    ip_address = ip_address_param,
    user_agent = user_agent_param,
    device_fingerprint = device_fingerprint_param,
    geolocation = geolocation_param,
    submitted_at = NOW(),
    verified_at = CASE WHEN verification_status_val = 'approved' THEN NOW() ELSE NULL END,
    expires_at = CASE WHEN verification_status_val = 'approved' THEN NOW() + INTERVAL '1 day' * expiry_days ELSE NULL END,
    updated_at = NOW()
  RETURNING id INTO verification_record_id;
  
  -- 记录审核日志
  INSERT INTO age_verification_audit_log (
    verification_id, user_id, action, new_status, 
    ip_address, user_agent, automated
  ) VALUES (
    verification_record_id, user_id_param, 'submitted', verification_status_val,
    ip_address_param, user_agent_param, verification_status_val = 'approved'
  );
  
  -- 返回结果
  RETURN QUERY SELECT 
    verification_record_id as verification_id,
    verification_status_val as status,
    CASE 
      WHEN verification_status_val = 'approved' THEN '验证已通过'
      WHEN verification_status_val = 'pending' THEN '提交成功，等待审核'
      ELSE '验证失败'
    END as message,
    requires_review as requires_manual_review;
END;
$$;

-- 检查用户年龄验证状态
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
  -- 获取最新的已通过验证记录
  SELECT * INTO verification_record
  FROM age_verification_records
  WHERE user_id = user_id_param 
    AND verification_status = 'approved'
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY verified_at DESC
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

-- 获取年龄验证配置
CREATE OR REPLACE FUNCTION get_age_verification_config()
RETURNS TABLE (
  minimum_age INTEGER,
  allowed_methods TEXT[],
  require_verification BOOLEAN,
  grace_period_hours INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT (config_value::TEXT)::INTEGER FROM age_verification_config WHERE config_key = 'minimum_age' AND is_active = TRUE), 18) as minimum_age,
    COALESCE((SELECT ARRAY(SELECT jsonb_array_elements_text(config_value)) FROM age_verification_config WHERE config_key = 'allowed_methods' AND is_active = TRUE), ARRAY['self_declared']) as allowed_methods,
    COALESCE((SELECT (config_value::TEXT)::BOOLEAN FROM age_verification_config WHERE config_key = 'require_verification' AND is_active = TRUE), TRUE) as require_verification,
    COALESCE((SELECT (config_value::TEXT)::INTEGER FROM age_verification_config WHERE config_key = 'grace_period_hours' AND is_active = TRUE), 24) as grace_period_hours;
END;
$$;