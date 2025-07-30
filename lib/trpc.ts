import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // Production URL from environment
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  
  // Rork platform URL from environment
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  // Development fallback
  if (typeof window !== 'undefined') {
    // Web development
    const hostname = window.location.hostname;
    const port = process.env.NODE_ENV === 'development' ? '3000' : window.location.port;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  }
  
  // Native development fallback
  if (__DEV__) {
    return "http://localhost:3000";
  }
  
  // Production fallback - this should not happen in production
  throw new Error("API base URL not configured. Please set EXPO_PUBLIC_API_BASE_URL environment variable.");
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      // Add request headers for authentication if needed
      headers() {
        return {
          'Content-Type': 'application/json',
        };
      },
      // Add error handling
      fetch(url, options) {
        return fetch(url, {
          ...options,
          // Add timeout for requests
          signal: AbortSignal.timeout(30000), // 30 second timeout
        }).catch((error) => {
          console.error('tRPC fetch error:', error);
          throw error;
        });
      },
    }),
  ],
});