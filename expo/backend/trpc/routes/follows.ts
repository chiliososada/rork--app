import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const followsRouter = createTRPCRouter({
  // フォロー/アンフォロー
  toggleFollow: publicProcedure
    .input(z.object({
      followerId: z.string(),
      followingId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.followerId === input.followingId) {
        throw new Error('Cannot follow yourself');
      }

      const { data, error } = await ctx.supabase.rpc('toggle_follow', {
        follower_id_param: input.followerId,
        following_id_param: input.followingId,
      });

      if (error) {
        throw new Error(`Failed to toggle follow: ${error.message}`);
      }

      return data;
    }),

  // フォロー統計を取得
  getFollowStats: publicProcedure
    .input(z.object({
      userIds: z.array(z.string()),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('get_user_follow_stats', {
        user_ids: input.userIds,
      });

      if (error) {
        throw new Error(`Failed to fetch follow stats: ${error.message}`);
      }

      return data || [];
    }),

  // フォロー状態を確認
  getFollowStatus: publicProcedure
    .input(z.object({
      currentUserId: z.string(),
      targetUserIds: z.array(z.string()),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('check_follow_status', {
        current_user_id: input.currentUserId,
        target_user_ids: input.targetUserIds,
      });

      if (error) {
        throw new Error(`Failed to check follow status: ${error.message}`);
      }

      return data || [];
    }),

  // フォロワー一覧を取得
  getFollowers: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('get_recent_followers', {
        user_id_param: input.userId,
        limit_count: input.limit,
        offset_count: input.offset,
      });

      if (error) {
        throw new Error(`Failed to fetch followers: ${error.message}`);
      }

      return data || [];
    }),

  // フォロー中ユーザー一覧を取得
  getFollowing: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('get_following_users', {
        user_id_param: input.userId,
        limit_count: input.limit,
        offset_count: input.offset,
      });

      if (error) {
        throw new Error(`Failed to fetch following users: ${error.message}`);
      }

      return data || [];
    }),

  // フォロー中ユーザーのトピックを取得（フィード）
  getFollowingFeed: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('get_following_users_topics', {
        user_id_param: input.userId,
        limit_count: input.limit,
        offset_count: input.offset,
      });

      if (error) {
        throw new Error(`Failed to fetch following feed: ${error.message}`);
      }

      return data || [];
    }),

  // 相互フォロー関係を確認
  getMutualFollows: publicProcedure
    .input(z.object({
      userId1: z.string(),
      userId2: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('user_follows')
        .select('id, follower_id, following_id')
        .or(`and(follower_id.eq.${input.userId1},following_id.eq.${input.userId2}),and(follower_id.eq.${input.userId2},following_id.eq.${input.userId1})`);

      if (error) {
        throw new Error(`Failed to check mutual follows: ${error.message}`);
      }

      const user1FollowsUser2 = data?.some(follow => 
        follow.follower_id === input.userId1 && follow.following_id === input.userId2
      ) || false;
      
      const user2FollowsUser1 = data?.some(follow => 
        follow.follower_id === input.userId2 && follow.following_id === input.userId1
      ) || false;

      return {
        isMutual: user1FollowsUser2 && user2FollowsUser1,
        user1FollowsUser2,
        user2FollowsUser1,
      };
    }),

  // おすすめユーザーを取得
  getSuggestedUsers: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().default(10),
    }))
    .query(async ({ input, ctx }) => {
      // Get users who are followed by people the current user follows
      // but not followed by the current user
      const { data, error } = await ctx.supabase
        .from('users')
        .select(`
          id,
          nickname,
          avatar_url,
          created_at
        `)
        .neq('id', input.userId)
        .limit(input.limit);

      if (error) {
        throw new Error(`Failed to fetch suggested users: ${error.message}`);
      }

      // Filter out users already followed
      const { data: followingData } = await ctx.supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', input.userId);

      const followingIds = followingData?.map(f => f.following_id) || [];
      const suggested = data?.filter(user => !followingIds.includes(user.id)) || [];

      return suggested.slice(0, input.limit);
    }),
});