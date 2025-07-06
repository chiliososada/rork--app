import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

<<<<<<< HEAD
  // Fallback for development
  if (__DEV__) {
    return "http://localhost:3000";
  }

  throw new Error(
    "No base url found, please set EXPO_PUBLIC_RORK_API_BASE_URL"
  );
=======
  // Development fallback - use localhost
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3000`;
  }
  
  // Default for development
  return "http://localhost:3000";
>>>>>>> 715cca6 (初始化项目结构)
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});