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