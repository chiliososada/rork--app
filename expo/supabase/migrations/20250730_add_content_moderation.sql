-- Content Moderation System Migration
-- Adds moderation fields to topics and comments tables

-- ========== Topics table moderation fields ==========

-- Add moderation_status column to topics table
ALTER TABLE public.topics 
ADD COLUMN moderation_status TEXT DEFAULT 'approved' 
CHECK (moderation_status IN ('pending', 'approved', 'rejected'));

-- Add moderation_reason column to topics table
ALTER TABLE public.topics 
ADD COLUMN moderation_reason TEXT;

-- Add moderation_date for tracking when moderation was applied
ALTER TABLE public.topics 
ADD COLUMN moderation_date TIMESTAMP WITH TIME ZONE;

-- ========== Comments table moderation fields ==========

-- Add moderation_status column to comments table
ALTER TABLE public.comments 
ADD COLUMN moderation_status TEXT DEFAULT 'approved' 
CHECK (moderation_status IN ('pending', 'approved', 'rejected'));

-- Add moderation_reason column to comments table
ALTER TABLE public.comments 
ADD COLUMN moderation_reason TEXT;

-- Add moderation_date for tracking when moderation was applied
ALTER TABLE public.comments 
ADD COLUMN moderation_date TIMESTAMP WITH TIME ZONE;

-- ========== Create indexes for performance ==========

-- Index on topics moderation status for efficient filtering
CREATE INDEX topics_moderation_status_idx ON public.topics(moderation_status);

-- Index on comments moderation status for efficient filtering
CREATE INDEX comments_moderation_status_idx ON public.comments(moderation_status);

-- Composite index for filtering topics by status and creation time
CREATE INDEX topics_status_created_idx ON public.topics(moderation_status, created_at DESC);

-- Composite index for filtering comments by status and creation time
CREATE INDEX comments_status_created_idx ON public.comments(moderation_status, created_at DESC);

-- ========== Content moderation log table ==========

-- Create a table to log all moderation actions for audit purposes
CREATE TABLE public.content_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('topic', 'comment')),
  content_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  moderation_status TEXT NOT NULL CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT,
  automated BOOLEAN DEFAULT TRUE, -- true for automated filtering, false for manual review
  moderator_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- for manual moderation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional context for moderation decisions
  filter_details JSONB, -- stores details like matched keywords, URL count, etc.
  original_content TEXT, -- backup of original content
  
  -- Add indexes
  CONSTRAINT content_moderation_log_content_type_id UNIQUE (content_type, content_id, created_at)
);

-- Index on content_moderation_log for efficient queries
CREATE INDEX content_moderation_log_content_idx ON public.content_moderation_log(content_type, content_id);
CREATE INDEX content_moderation_log_status_idx ON public.content_moderation_log(moderation_status);
CREATE INDEX content_moderation_log_created_idx ON public.content_moderation_log(created_at DESC);
CREATE INDEX content_moderation_log_user_idx ON public.content_moderation_log(user_id);

-- ========== RPC functions for content filtering ==========

-- Function to get topics with moderation filtering
-- Only shows approved content to regular users, but shows all content to moderators
CREATE OR REPLACE FUNCTION get_filtered_topics(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0,
  include_pending BOOLEAN DEFAULT FALSE -- set to true for moderators
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  user_id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  image_url TEXT,
  image_aspect_ratio TEXT,
  original_width INTEGER,
  original_height INTEGER,
  moderation_status TEXT,
  moderation_reason TEXT,
  distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.description,
    t.user_id,
    t.latitude,
    t.longitude,
    t.location_name,
    t.created_at,
    t.image_url,
    t.image_aspect_ratio,
    t.original_width,
    t.original_height,
    t.moderation_status,
    t.moderation_reason,
    -- Calculate distance in meters
    (6371000 * acos(
      cos(radians(user_lat)) * 
      cos(radians(t.latitude)) * 
      cos(radians(t.longitude) - radians(user_lng)) + 
      sin(radians(user_lat)) * 
      sin(radians(t.latitude))
    )) as distance_meters
  FROM topics t
  WHERE 
    -- Geographic filtering
    t.latitude BETWEEN user_lat - (radius_km / 111.0) AND user_lat + (radius_km / 111.0)
    AND t.longitude BETWEEN user_lng - (radius_km / (111.0 * cos(radians(user_lat)))) 
                          AND user_lng + (radius_km / (111.0 * cos(radians(user_lat))))
    -- Moderation filtering
    AND (
      include_pending = TRUE 
      OR t.moderation_status = 'approved'
    )
    -- Hide rejected content from everyone except moderators
    AND (include_pending = TRUE OR t.moderation_status != 'rejected')
  ORDER BY distance_meters ASC, t.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Function to get comments with moderation filtering
CREATE OR REPLACE FUNCTION get_filtered_comments(
  topic_id_param UUID,
  include_pending BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  topic_id UUID,
  user_id UUID,
  content TEXT,
  likes_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  moderation_status TEXT,
  moderation_reason TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.topic_id,
    c.user_id,
    c.content,
    c.likes_count,
    c.created_at,
    c.moderation_status,
    c.moderation_reason
  FROM comments c
  WHERE 
    c.topic_id = topic_id_param
    AND (
      include_pending = TRUE 
      OR c.moderation_status = 'approved'
    )
    -- Hide rejected content from everyone except moderators
    AND (include_pending = TRUE OR c.moderation_status != 'rejected')
  ORDER BY c.created_at ASC;
END;
$$;

-- Function to log moderation actions
CREATE OR REPLACE FUNCTION log_moderation_action(
  content_type_param TEXT,
  content_id_param UUID,
  user_id_param UUID,
  moderation_status_param TEXT,
  moderation_reason_param TEXT DEFAULT NULL,
  automated_param BOOLEAN DEFAULT TRUE,
  moderator_id_param UUID DEFAULT NULL,
  filter_details_param JSONB DEFAULT NULL,
  original_content_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO content_moderation_log (
    content_type,
    content_id,
    user_id,
    moderation_status,
    moderation_reason,
    automated,
    moderator_id,
    filter_details,
    original_content
  ) VALUES (
    content_type_param,
    content_id_param,
    user_id_param,
    moderation_status_param,
    moderation_reason_param,
    automated_param,
    moderator_id_param,
    filter_details_param,
    original_content_param
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- ========== Update existing data ==========

-- Set all existing topics and comments to 'approved' status
-- This ensures backward compatibility
UPDATE public.topics 
SET moderation_status = 'approved', moderation_date = NOW()
WHERE moderation_status IS NULL;

UPDATE public.comments 
SET moderation_status = 'approved', moderation_date = NOW()
WHERE moderation_status IS NULL;

-- ========== Row Level Security (RLS) policies ==========

-- Enable RLS on content_moderation_log table
ALTER TABLE public.content_moderation_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own moderation logs
CREATE POLICY "Users can view their own moderation logs" ON public.content_moderation_log
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Only authenticated users can insert moderation logs (for system use)
CREATE POLICY "System can insert moderation logs" ON public.content_moderation_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add comment to explain the migration
COMMENT ON TABLE public.content_moderation_log IS 'Logs all content moderation actions for audit and analysis purposes';
COMMENT ON COLUMN public.topics.moderation_status IS 'Content moderation status: pending, approved, or rejected';
COMMENT ON COLUMN public.comments.moderation_status IS 'Content moderation status: pending, approved, or rejected';