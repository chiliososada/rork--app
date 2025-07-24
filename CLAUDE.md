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
  
如果设计到文本都使用日语

我偏向于ios和安卓 web端可以降低比重

需要上线appstore 和 Google store


