import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { topicsRouter } from "./routes/topics";
import { commentsRouter } from "./routes/comments";
import { authRouter } from "./routes/auth";
import { chatRouter } from "./routes/chat";
import { followsRouter } from "./routes/follows";

export const appRouter = createTRPCRouter({
  // Legacy example route
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  
  // Main API routes
  auth: authRouter,
  topics: topicsRouter,
  comments: commentsRouter,
  chat: chatRouter,
  follows: followsRouter,
});

export type AppRouter = typeof appRouter;