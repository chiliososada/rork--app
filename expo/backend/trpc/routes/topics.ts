import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const topicsRouter = createTRPCRouter({
  // 近くのトピックを取得
  getNearby: publicProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      radius: z.number().default(10),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('get_nearby_topics', {
        user_lat: input.latitude,
        user_lng: input.longitude,
        radius_km: input.radius,
        limit_count: input.limit,
        offset_count: input.offset,
      });

      if (error) {
        throw new Error(`Failed to fetch nearby topics: ${error.message}`);
      }

      return data;
    }),

  // IDでトピックを取得
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('topics')
        .select(`
          *,
          users:user_id (
            id,
            nickname,
            avatar_url,
            email
          )
        `)
        .eq('id', input.id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch topic: ${error.message}`);
      }

      return data;
    }),

  // トピックを作成
  create: publicProcedure
    .input(z.object({
      title: z.string().min(1).max(100),
      description: z.string().optional(),
      userId: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      locationName: z.string().optional(),
      imageUrl: z.string().optional(),
      imageAspectRatio: z.enum(['1:1', '4:5', '1.91:1']).optional(),
      originalWidth: z.number().optional(),
      originalHeight: z.number().optional(),
      tags: z.array(z.string()).default([]),
      category: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('topics')
        .insert([{
          title: input.title,
          description: input.description,
          user_id: input.userId,
          latitude: input.latitude,
          longitude: input.longitude,
          location_name: input.locationName,
          image_url: input.imageUrl,
          image_aspect_ratio: input.imageAspectRatio,
          original_width: input.originalWidth,
          original_height: input.originalHeight,
          tags: input.tags,
          category: input.category,
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create topic: ${error.message}`);
      }

      return data;
    }),

  // トピックをいいね/いいね解除
  toggleLike: publicProcedure
    .input(z.object({
      topicId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('toggle_topic_like', {
        topic_id_param: input.topicId,
        user_id_param: input.userId,
      });

      if (error) {
        throw new Error(`Failed to toggle like: ${error.message}`);
      }

      return data;
    }),

  // トピックをお気に入り/お気に入り解除
  toggleFavorite: publicProcedure
    .input(z.object({
      topicId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('toggle_topic_favorite', {
        topic_id_param: input.topicId,
        user_id_param: input.userId,
      });

      if (error) {
        throw new Error(`Failed to toggle favorite: ${error.message}`);
      }

      return data;
    }),

  // トピックの統計情報を取得
  getInteractionCounts: publicProcedure
    .input(z.object({
      topicIds: z.array(z.string()),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('get_topic_interaction_counts', {
        topic_ids: input.topicIds,
      });

      if (error) {
        throw new Error(`Failed to fetch interaction counts: ${error.message}`);
      }

      return data;
    }),

  // ユーザーのいいね・お気に入り状態を確認
  getUserInteractionStatus: publicProcedure
    .input(z.object({
      userId: z.string(),
      topicIds: z.array(z.string()),
    }))
    .query(async ({ input, ctx }) => {
      const [likesData, favoritesData] = await Promise.allSettled([
        ctx.supabase.rpc('check_user_likes', {
          user_id_param: input.userId,
          topic_ids: input.topicIds,
        }),
        ctx.supabase.rpc('check_user_favorites', {
          user_id_param: input.userId,
          topic_ids: input.topicIds,
        }),
      ]);

      const likes = likesData.status === 'fulfilled' ? likesData.value.data : [];
      const favorites = favoritesData.status === 'fulfilled' ? favoritesData.value.data : [];

      return {
        likes: likes || [],
        favorites: favorites || [],
      };
    }),
});