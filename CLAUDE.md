# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TokyoPark is a location-based topic discussion app built with React Native, Expo, and tRPC. Users can discover and participate in local conversations based on their geographical location.

## Development Commands

### Core Development
- `npm start` - Start the development server (using custom Rork platform)
- `npx expo start --web --port 3000` - Start web development server
- `npx expo start --web --port 3000 --clear` - Start with cleared cache (use when fixing build issues)

### Platform-Specific Commands
- `npm run start-web` - Start web version with tunnel
- `npm run start-web-dev` - Start web with debug logging

### Build & Dependencies
- `npm install --legacy-peer-deps` - Install dependencies (required due to React 19 compatibility)
- `npm install -D <package> --legacy-peer-deps` - Install dev dependencies

## Architecture Overview

### Technology Stack
- **Frontend**: React Native 0.79.1 + Expo 53 + Expo Router (file-based routing)
- **Backend**: Hono + tRPC for type-safe APIs
- **State Management**: Zustand stores + React Query
- **Styling**: NativeWind (Tailwind for React Native)
- **Icons**: Lucide React Native

### Routing Structure (Expo Router)
```
app/
├── (auth)/          # Authentication flow with layout wrapper
├── (tabs)/          # Main app tabs with auth guard
├── chat/[id].tsx    # Dynamic chat routes
├── topic/[id].tsx   # Dynamic topic routes
└── _layout.tsx      # Root layout with providers
```

### State Management Pattern
Three main Zustand stores handle app state:
- **auth-store.ts**: User authentication, mock login (demo@example.com/password)
- **location-store.ts**: Location permissions and current position
- **topic-store.ts**: Topics, messages, search, distance calculations

### Cross-Platform Architecture
- **MapView components**: Platform-specific implementations (native/web)
- **Location handling**: Different approaches for web vs native platforms
- **Build configs**: Separate Metro (mobile) and Webpack (web) configurations

## Key Development Patterns

### Authentication Flow
- Route guards in `(tabs)/_layout.tsx` redirect unauthenticated users to `(auth)`
- Persistent auth state using AsyncStorage
- Mock authentication for development

### Type Safety
- End-to-end type safety with tRPC
- Shared types in `types/index.ts` (User, Topic, Comment, Message, Location)
- Zod schemas for validation

### Mock Data Development
- Comprehensive mock data in `mocks/data.ts` with Tokyo locations
- No real backend required for development
- Mock users, topics, and messages for testing

### Component Organization
- Reusable UI components in `components/`
- Platform-specific files use `.native.tsx` and `.web.tsx` extensions
- Cross-platform compatibility maintained throughout

## Configuration Files

### Build Configuration
- **metro.config.js**: Custom Metro config with import.meta support
- **webpack.config.js**: Web build config with import.meta compatibility
- **app.json**: Expo configuration with new architecture enabled

### Path Aliases
- `@/*` maps to project root (configured in tsconfig.json)
- Consistent import paths across the codebase

## Common Issues & Solutions

### Build Errors
- Use `--legacy-peer-deps` for npm installs due to React 19
- Clear cache with `--clear` flag when facing bundling issues
- import.meta errors resolved with custom webpack config
- require is not defined errors fixed with Node.js polyfills

### Development Warnings (Safe to Ignore)
The following warnings appear during development but don't affect functionality:
- **LogBox warnings**: `export 'LogData'/'ExtendedExceptionData'/'IgnorePattern' not found` - These are from Expo's development overlay
- **Superjson source map warnings**: Missing TypeScript source files for debugging - compiled JavaScript works fine
- **Webpack deprecation warnings**: DEP_WEBPACK_DEV_SERVER_* warnings are from build tools and won't affect the app

### Development Workflow
- Project uses custom Rork platform - prefer `npm start` over direct expo commands
- Web development typically runs on port 3000
- Mobile development uses Expo Go app with QR code scanning
- Successful compilation shows "web compiled with X warnings" - this means the app is working

## Testing & Authentication

### Test Credentials
- Email: `demo@example.com`
- Password: `password`

### Location Testing
- Mock data includes Tokyo locations (Shibuya, Roppongi, Skytree, etc.)
- Distance calculations use Haversine formula
- Web fallback for location permissions

## Backend Integration

### tRPC Setup
- Client configured in `lib/trpc.ts` with React Query integration
- Backend routes in `backend/trpc/` directory
- Environment-based API URL configuration
- Superjson transformer for enhanced serialization

页面中如果有文本的话 都用日语

我的supabase 表结构
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  nickname text not null,
  avatar_url text,
  gender text,
  created_at timestamp with time zone default now()
);
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  user_id uuid references public.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  location_name text,
  created_at timestamp with time zone default now()
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  content text not null,
  likes_count int default 0,
  created_at timestamp with time zone default now()
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  message text not null,
  created_at timestamp with time zone default now()
);
create table public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references public.comments(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(comment_id, user_id)
);
  create table public.topic_likes (
    id uuid primary key default gen_random_uuid(),
    topic_id uuid references public.topics(id) on delete cascade,
    user_id uuid references public.users(id) on delete cascade,
    created_at timestamp with time zone default now(),
    unique(topic_id, user_id)
  );
ALTER TABLE public.topics ADD COLUMN image_aspect_ratio TEXT CHECK (image_aspect_ratio IN ('1:1', '4:5', '1.91:1'));   
  -- 创建索引
  create index topic_likes_topic_id_idx on public.topic_likes(topic_id);
  create index topic_likes_user_id_idx on public.topic_likes(user_id);

    -- 创建话题收藏表
  create table public.topic_favorites (
    id uuid primary key default gen_random_uuid(),
    topic_id uuid references public.topics(id) on delete cascade,
    user_id uuid references public.users(id) on delete cascade,
    created_at timestamp with time zone default now(),
    unique(topic_id, user_id)
  );


  -- 创建索引以提高查询性能
  create index topic_favorites_topic_id_idx on public.topic_favorites(topic_id);
  create index topic_favorites_user_id_idx on public.topic_favorites(user_id);

REACT_APP_SUPABASE_URL=https://nkhomvyrlkxhuafikyuu.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5raG9tdnlybGt4aHVhZmlreXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NjYxOTIsImV4cCI6MjA2NzQ0MjE5Mn0.8mse6qzWK7Q0XfGXyNcP8jRjQPRmZTg_K9jymo2dydA
-- 创建获取话题交互数据的RPC函数
CREATE OR REPLACE FUNCTION get_topic_interaction_counts(topic_ids UUID[])
RETURNS TABLE (
  topic_id UUID,
  likes_count INTEGER,
  favorites_count INTEGER,
  comments_count INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as topic_id,
    COALESCE(likes.count, 0) as likes_count,
    COALESCE(favorites.count, 0) as favorites_count,
    COALESCE(comments.count, 0) as comments_count
  FROM 
    unnest(topic_ids) AS t(id)
  LEFT JOIN (
    SELECT topic_id, COUNT(*)::INTEGER as count
    FROM topic_likes 
    WHERE topic_id = ANY(topic_ids)
    GROUP BY topic_id
  ) likes ON t.id = likes.topic_id
  LEFT JOIN (
    SELECT topic_id, COUNT(*)::INTEGER as count
    FROM topic_favorites 
    WHERE topic_id = ANY(topic_ids)
    GROUP BY topic_id
  ) favorites ON t.id = favorites.topic_id
  LEFT JOIN (
    SELECT topic_id, COUNT(*)::INTEGER as count
    FROM comments 
    WHERE topic_id = ANY(topic_ids)
    GROUP BY topic_id
  ) comments ON t.id = comments.topic_id;
END;
$$;

-- 批量检查用户点赞状态
CREATE OR REPLACE FUNCTION check_user_likes(user_id_param UUID, topic_ids UUID[])
RETURNS TABLE (
  topic_id UUID,
  is_liked BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as topic_id,
    (tl.id IS NOT NULL) as is_liked
  FROM 
    unnest(topic_ids) AS t(id)
  LEFT JOIN topic_likes tl ON t.id = tl.topic_id AND tl.user_id = user_id_param;
END;
$$;

-- 批量检查用户收藏状态
CREATE OR REPLACE FUNCTION check_user_favorites(user_id_param UUID, topic_ids UUID[])
RETURNS TABLE (
  topic_id UUID,
  is_favorited BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as topic_id,
    (tf.id IS NOT NULL) as is_favorited
  FROM 
    unnest(topic_ids) AS t(id)
  LEFT JOIN topic_favorites tf ON t.id = tf.topic_id AND tf.user_id = user_id_param;
END;
$$;

-- 获取附近话题（优化版）
CREATE OR REPLACE FUNCTION get_nearby_topics(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
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
    -- 计算距离（单位：米）
    (6371000 * acos(
      cos(radians(user_lat)) * 
      cos(radians(t.latitude)) * 
      cos(radians(t.longitude) - radians(user_lng)) + 
      sin(radians(user_lat)) * 
      sin(radians(t.latitude))
    )) as distance_meters
  FROM topics t
  WHERE 
    -- 使用地理位置过滤（粗筛选提高性能）
    t.latitude BETWEEN user_lat - (radius_km / 111.0) AND user_lat + (radius_km / 111.0)
    AND t.longitude BETWEEN user_lng - (radius_km / (111.0 * cos(radians(user_lat)))) 
                          AND user_lng + (radius_km / (111.0 * cos(radians(user_lat))))
    -- 排除隐藏的内容
    AND (t.is_hidden IS NULL OR t.is_hidden = false)
  ORDER BY distance_meters ASC, t.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;


 ALTER TABLE public.topics
  ADD COLUMN original_width INTEGER,
  ADD COLUMN original_height INTEGER;
    -- 创建话题参与者表
  CREATE TABLE public.topic_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE, -- 支持"退出聊天"功能
    UNIQUE(topic_id, user_id)
  );

  -- 创建索引以提高查询性能
  CREATE INDEX topic_participants_topic_id_idx ON public.topic_participants(topic_id);
  CREATE INDEX topic_participants_user_id_idx ON public.topic_participants(user_id);
  CREATE INDEX topic_participants_active_idx ON public.topic_participants(topic_id, user_id) WHERE is_active = TRUE;

  -- 可选：创建RPC函数用于批量检查参与状态
  CREATE OR REPLACE FUNCTION check_user_participation(user_id_param UUID, topic_ids UUID[])
  RETURNS TABLE (
    topic_id UUID,
    is_participant BOOLEAN,
    joined_at TIMESTAMP WITH TIME ZONE
  )
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN QUERY
    SELECT
      t.id as topic_id,
      (tp.id IS NOT NULL AND tp.is_active = TRUE) as is_participant,
      tp.joined_at
    FROM
      unnest(topic_ids) AS t(id)
    LEFT JOIN topic_participants tp ON t.id = tp.topic_id AND tp.user_id = user_id_param;
  END;
  $$;


  1. 基本テーブルの作成

  -- フォロー関係テーブル
  CREATE TABLE public.user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
  );

  -- インデックスの作成
  CREATE INDEX user_follows_follower_id_idx ON public.user_follows(follower_id);
  CREATE INDEX user_follows_following_id_idx ON public.user_follows(following_id);
  CREATE INDEX user_follows_created_at_idx ON public.user_follows(created_at DESC);

  -- ユーザーブロックテーブル（オプション）
  CREATE TABLE public.user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
  );

  -- ブロックテーブルのインデックス
  CREATE INDEX user_blocks_blocker_id_idx ON public.user_blocks(blocker_id);
  CREATE INDEX user_blocks_blocked_id_idx ON public.user_blocks(blocked_id);

  2. RPC関数の作成

  -- ユーザーのフォロー統計情報を取得
  CREATE OR REPLACE FUNCTION get_user_follow_stats(user_ids UUID[])
  RETURNS TABLE (
    user_id UUID,
    followers_count INTEGER,
    following_count INTEGER
  )
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN QUERY
    SELECT
      u.id as user_id,
      COALESCE(followers.count, 0)::INTEGER as followers_count,
      COALESCE(following.count, 0)::INTEGER as following_count
    FROM
      unnest(user_ids) AS u(id)
    LEFT JOIN (
      SELECT following_id, COUNT(*)::INTEGER as count
      FROM user_follows
      WHERE following_id = ANY(user_ids)
      GROUP BY following_id
    ) followers ON u.id = followers.following_id
    LEFT JOIN (
      SELECT follower_id, COUNT(*)::INTEGER as count
      FROM user_follows
      WHERE follower_id = ANY(user_ids)
      GROUP BY follower_id
    ) following ON u.id = following.follower_id;
  END;
  $$;

  -- 複数ユーザーのフォロー状態を一括確認
  CREATE OR REPLACE FUNCTION check_follow_status(
    current_user_id UUID,
    target_user_ids UUID[]
  )
  RETURNS TABLE (
    user_id UUID,
    is_following BOOLEAN,
    is_followed_by BOOLEAN
  )
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN QUERY
    SELECT
      t.id as user_id,
      (uf1.id IS NOT NULL) as is_following,
      (uf2.id IS NOT NULL) as is_followed_by
    FROM
      unnest(target_user_ids) AS t(id)
    LEFT JOIN user_follows uf1
      ON uf1.follower_id = current_user_id AND uf1.following_id = t.id
    LEFT JOIN user_follows uf2
      ON uf2.follower_id = t.id AND uf2.following_id = current_user_id;
  END;
  $$;

  -- 最近のフォロワーを取得（通知画面用）
  CREATE OR REPLACE FUNCTION get_recent_followers(
    user_id_param UUID,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
  )
  RETURNS TABLE (
    follower_id UUID,
    follower_name TEXT,
    follower_avatar TEXT,
    followed_at TIMESTAMP WITH TIME ZONE,
    is_following_back BOOLEAN
  )
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN QUERY
    SELECT
      uf.follower_id,
      u.nickname as follower_name,
      u.avatar_url as follower_avatar,
      uf.created_at as followed_at,
      (uf_back.id IS NOT NULL) as is_following_back
    FROM user_follows uf
    JOIN users u ON u.id = uf.follower_id
    LEFT JOIN user_follows uf_back
      ON uf_back.follower_id = user_id_param AND uf_back.following_id = uf.follower_id
    WHERE uf.following_id = user_id_param
    ORDER BY uf.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
  END;
  $$;

  -- フォロー中のユーザーリストを取得
  CREATE OR REPLACE FUNCTION get_following_users(
    user_id_param UUID,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
  )
  RETURNS TABLE (
    following_id UUID,
    following_name TEXT,
    following_avatar TEXT,
    followed_at TIMESTAMP WITH TIME ZONE,
    is_followed_back BOOLEAN
  )
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN QUERY
    SELECT
      uf.following_id,
      u.nickname as following_name,
      u.avatar_url as following_avatar,
      uf.created_at as followed_at,
      (uf_back.id IS NOT NULL) as is_followed_back
    FROM user_follows uf
    JOIN users u ON u.id = uf.following_id
    LEFT JOIN user_follows uf_back
      ON uf_back.follower_id = uf.following_id AND uf_back.following_id = user_id_param
    WHERE uf.follower_id = user_id_param
    ORDER BY uf.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
  END;
  $$;

  -- フォロー/アンフォロー処理（トグル機能）
  CREATE OR REPLACE FUNCTION toggle_follow(
    follower_id_param UUID,
    following_id_param UUID
  )
  RETURNS TABLE (
    action TEXT,
    is_following BOOLEAN
  )
  LANGUAGE plpgsql
  AS $$
  DECLARE
    existing_follow UUID;
  BEGIN
    -- 既存のフォロー関係をチェック
    SELECT id INTO existing_follow
    FROM user_follows
    WHERE follower_id = follower_id_param
      AND following_id = following_id_param;

    IF existing_follow IS NOT NULL THEN
      -- アンフォロー
      DELETE FROM user_follows WHERE id = existing_follow;
      RETURN QUERY SELECT 'unfollowed'::TEXT, false;
    ELSE
      -- フォロー
      INSERT INTO user_follows (follower_id, following_id)
      VALUES (follower_id_param, following_id_param);
      RETURN QUERY SELECT 'followed'::TEXT, true;
    END IF;
  END;
  $$;

  -- フォロー中のユーザーの最新トピックを取得（フィード機能用）
  CREATE OR REPLACE FUNCTION get_following_users_topics(
    user_id_param UUID,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
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
    user_name TEXT,
    user_avatar TEXT
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
      u.nickname as user_name,
      u.avatar_url as user_avatar
    FROM topics t
    JOIN users u ON u.id = t.user_id
    WHERE t.user_id IN (
      SELECT following_id
      FROM user_follows
      WHERE follower_id = user_id_param
    )
    AND (t.is_hidden IS NULL OR t.is_hidden = false)
    ORDER BY t.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
  END;
  $$;

  3. ブロック機能のRPC関数（オプション）

  -- ブロック/アンブロック処理
  CREATE OR REPLACE FUNCTION toggle_block(
    blocker_id_param UUID,
    blocked_id_param UUID
  )
  RETURNS TABLE (
    action TEXT,
    is_blocked BOOLEAN
  )
  LANGUAGE plpgsql
  AS $$
  DECLARE
    existing_block UUID;
  BEGIN
    -- 既存のブロック関係をチェック
    SELECT id INTO existing_block
    FROM user_blocks
    WHERE blocker_id = blocker_id_param
      AND blocked_id = blocked_id_param;

    IF existing_block IS NOT NULL THEN
      -- アンブロック
      DELETE FROM user_blocks WHERE id = existing_block;
      RETURN QUERY SELECT 'unblocked'::TEXT, false;
    ELSE
      -- ブロック（同時にフォロー関係も削除）
      INSERT INTO user_blocks (blocker_id, blocked_id)
      VALUES (blocker_id_param, blocked_id_param);

      -- 双方向のフォロー関係を削除
      DELETE FROM user_follows
      WHERE (follower_id = blocker_id_param AND following_id = blocked_id_param)
         OR (follower_id = blocked_id_param AND following_id = blocker_id_param);

      RETURN QUERY SELECT 'blocked'::TEXT, true;
    END IF;
  END;
  $$;

  -- ブロックしているユーザーのIDリストを取得
  CREATE OR REPLACE FUNCTION get_blocked_user_ids(user_id_param UUID)
  RETURNS UUID[]
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN ARRAY(
      SELECT blocked_id
      FROM user_blocks
      WHERE blocker_id = user_id_param
    );
  END;
  $$;
  -- 1. 为topics表添加tags字段（JSON数组）
  ALTER TABLE public.topics ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;

  -- 2. 创建标签使用统计表（用于分析和推荐）
  CREATE TABLE public.tag_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'situation', 'mood', 'feature'
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tag_name, category)
  );

  -- 3. 创建索引以提高查询性能
  CREATE INDEX topic_tags_gin_idx ON public.topics USING GIN (tags);
  CREATE INDEX tag_usage_stats_category_idx ON public.tag_usage_stats(category);
  CREATE INDEX tag_usage_stats_usage_count_idx ON public.tag_usage_stats(usage_count DESC);

  -- 4. 创建RPC函数用于更新标签使用统计
  CREATE OR REPLACE FUNCTION update_tag_usage_stats(tag_names TEXT[], categories TEXT[])
  RETURNS VOID
  LANGUAGE plpgsql
  AS $$
  BEGIN
    FOR i IN 1..array_length(tag_names, 1) LOOP
      INSERT INTO tag_usage_stats (tag_name, category, usage_count, last_used_at)
      VALUES (tag_names[i], categories[i], 1, NOW())
      ON CONFLICT (tag_name, category)
      DO UPDATE SET
        usage_count = tag_usage_stats.usage_count + 1,
        last_used_at = NOW();
    END LOOP;
  END;
  $$;

  -- 5. 创建获取热门标签的RPC函数
  CREATE OR REPLACE FUNCTION get_popular_tags(tag_category TEXT, limit_count INTEGER DEFAULT 10)
  RETURNS TABLE (
    tag_name TEXT,
    usage_count INTEGER
  )
  LANGUAGE plpgsql
  AS $$
  BEGIN
    RETURN QUERY
    SELECT t.tag_name, t.usage_count
    FROM tag_usage_stats t
    WHERE t.category = tag_category
    ORDER BY t.usage_count DESC, t.last_used_at DESC
    LIMIT limit_count;
  END;
  $$;

  -- 6. 插入一些初始的标签数据（可选）
  INSERT INTO tag_usage_stats (tag_name, category, usage_count) VALUES
  -- 情境标签
  ('食事中', 'situation', 0),
  ('移動中', 'situation', 0),
  ('仕事中', 'situation', 0),
  ('休憩中', 'situation', 0),
  ('買い物', 'situation', 0),
  ('勉強中', 'situation', 0),
  ('運動中', 'situation', 0),
  ('イベント', 'situation', 0),

  -- 心情标签（食事中相关）
  ('美味しい', 'mood', 0),
  ('新発見', 'mood', 0),
  ('みんなで', 'mood', 0),
  ('コスパ良い', 'mood', 0),

  -- 心情标签（仕事中相关）
  ('頑張ってる', 'mood', 0),
  ('忙しい', 'mood', 0),
  ('一息', 'mood', 0),
  ('打ち合わせ', 'mood', 0),

  -- 特征标签
  ('駅近', 'feature', 0),
  ('静か', 'feature', 0),
  ('おしゃれ', 'feature', 0),
  ('穴場', 'feature', 0),
  ('にぎやか', 'feature', 0),
  ('新しい', 'feature', 0)
  ON CONFLICT (tag_name, category) DO NOTHING;                


   -- TokyoPark アプリケーション データベーススキーマ
-- 位置ベースの話題ディスカッションアプリ

-- 1. ユーザーテーブル
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  gender TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 話題テーブル（メインコンテンツ）
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  image_url TEXT,
  image_aspect_ratio TEXT CHECK (image_aspect_ratio IN ('1:1', '4:5', '1.91:1')),
  original_width INTEGER,
  original_height INTEGER,
  tags JSONB DEFAULT '[]'::jsonb,
  category TEXT,
  engagement_score DECIMAL DEFAULT 0,
  is_promoted BOOLEAN DEFAULT FALSE,
  promotion_end_date TIMESTAMP WITH TIME ZONE,
  is_hidden BOOLEAN DEFAULT FALSE
);

-- 3. コメントテーブル
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. チャットメッセージテーブル
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 話題いいねテーブル
CREATE TABLE public.topic_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(topic_id, user_id)
);

-- 6. 話題お気に入りテーブル
CREATE TABLE public.topic_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(topic_id, user_id)
);

-- 7. コメントいいねテーブル
CREATE TABLE public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- 8. ユーザーフォロー関係テーブル
CREATE TABLE public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- 9. ユーザーブロックテーブル
CREATE TABLE public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

-- 10. 話題参加者テーブル
CREATE TABLE public.topic_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(topic_id, user_id)
);

-- 11. 標籤使用統計テーブル
CREATE TABLE public.tag_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'situation', 'mood', 'feature'
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tag_name, category)
);

-- 12. カテゴリ設定テーブル
CREATE TABLE public.category_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  icon_emoji TEXT,
  color_code TEXT,
  commercial_priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. プライベートチャットテーブル
CREATE TABLE public.private_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  participant2_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant1_id, participant2_id),
  CHECK (participant1_id != participant2_id)
);

-- 14. プライベートメッセージテーブル
CREATE TABLE public.private_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.private_chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========== インデックス作成 ==========

-- 話題テーブルのインデックス
CREATE INDEX topics_location_idx ON public.topics(latitude, longitude);
CREATE INDEX topics_user_id_idx ON public.topics(user_id);
CREATE INDEX topics_created_at_idx ON public.topics(created_at DESC);
CREATE INDEX topics_category_idx ON public.topics(category);
CREATE INDEX topic_tags_gin_idx ON public.topics USING GIN (tags);
CREATE INDEX topics_engagement_score_idx ON public.topics(engagement_score DESC);

-- いいね・お気に入りのインデックス
CREATE INDEX topic_likes_topic_id_idx ON public.topic_likes(topic_id);
CREATE INDEX topic_likes_user_id_idx ON public.topic_likes(user_id);
CREATE INDEX topic_favorites_topic_id_idx ON public.topic_favorites(topic_id);
CREATE INDEX topic_favorites_user_id_idx ON public.topic_favorites(user_id);

-- コメント関連のインデックス
CREATE INDEX comments_topic_id_idx ON public.comments(topic_id);
CREATE INDEX comments_user_id_idx ON public.comments(user_id);
CREATE INDEX comments_created_at_idx ON public.comments(created_at DESC);
CREATE INDEX comment_likes_comment_id_idx ON public.comment_likes(comment_id);
CREATE INDEX comment_likes_user_id_idx ON public.comment_likes(user_id);

-- チャット関連のインデックス
CREATE INDEX chat_messages_topic_id_idx ON public.chat_messages(topic_id);
CREATE INDEX chat_messages_user_id_idx ON public.chat_messages(user_id);
CREATE INDEX chat_messages_created_at_idx ON public.chat_messages(created_at DESC);

-- フォロー・ブロック関連のインデックス
CREATE INDEX user_follows_follower_id_idx ON public.user_follows(follower_id);
CREATE INDEX user_follows_following_id_idx ON public.user_follows(following_id);
CREATE INDEX user_follows_created_at_idx ON public.user_follows(created_at DESC);
CREATE INDEX user_blocks_blocker_id_idx ON public.user_blocks(blocker_id);
CREATE INDEX user_blocks_blocked_id_idx ON public.user_blocks(blocked_id);

-- 参加者関連のインデックス
CREATE INDEX topic_participants_topic_id_idx ON public.topic_participants(topic_id);
CREATE INDEX topic_participants_user_id_idx ON public.topic_participants(user_id);
CREATE INDEX topic_participants_active_idx ON public.topic_participants(topic_id, user_id) WHERE is_active = TRUE;

-- 標籤統計のインデックス
CREATE INDEX tag_usage_stats_category_idx ON public.tag_usage_stats(category);
CREATE INDEX tag_usage_stats_usage_count_idx ON public.tag_usage_stats(usage_count DESC);

-- プライベートチャット関連のインデックス
CREATE INDEX private_chats_participant1_idx ON public.private_chats(participant1_id);
CREATE INDEX private_chats_participant2_idx ON public.private_chats(participant2_id);
CREATE INDEX private_messages_chat_id_idx ON public.private_messages(chat_id);
CREATE INDEX private_messages_sender_id_idx ON public.private_messages(sender_id);
CREATE INDEX private_messages_created_at_idx ON public.private_messages(created_at DESC);                                
如果设计到文本都使用日语

我偏向于ios和安卓 web端可以降低比重

所有新页面的导航都适用router 中框架的 导航尤其是后退按钮要统一 不要存在双重后退 Stack.Screenのナビゲーションのみを使用する       
符合日本人的用户习惯的ui设计
我现在的项目是制作阶段 还没有上线
需要上线appstore 和 Google store


