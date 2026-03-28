import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const commentsRouter = createTRPCRouter({
  // トピックのコメントを取得
  getByTopicId: publicProcedure
    .input(z.object({
      topicId: z.string(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('comments')
        .select(`
          *,
          users:user_id (
            id,
            nickname,
            avatar_url
          )
        `)
        .eq('topic_id', input.topicId)
        .order('created_at', { ascending: true })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        throw new Error(`Failed to fetch comments: ${error.message}`);
      }

      return data;
    }),

  // コメントを作成
  create: publicProcedure
    .input(z.object({
      topicId: z.string(),
      userId: z.string(),
      content: z.string().min(1).max(1000),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('comments')
        .insert([{
          topic_id: input.topicId,
          user_id: input.userId,
          content: input.content,
        }])
        .select(`
          *,
          users:user_id (
            id,
            nickname,
            avatar_url
          )
        `)
        .single();

      if (error) {
        throw new Error(`Failed to create comment: ${error.message}`);
      }

      return data;
    }),

  // コメントをいいね/いいね解除
  toggleLike: publicProcedure
    .input(z.object({
      commentId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if like exists
      const { data: existingLike } = await ctx.supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', input.commentId)
        .eq('user_id', input.userId)
        .single();

      if (existingLike) {
        // Remove like
        const { error: deleteError } = await ctx.supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', input.commentId)
          .eq('user_id', input.userId);

        if (deleteError) {
          throw new Error(`Failed to remove comment like: ${deleteError.message}`);
        }

        // Update likes count
        const { error: updateError } = await ctx.supabase.rpc('decrement_comment_likes', {
          comment_id_param: input.commentId,
        });

        if (updateError) {
          console.error('Failed to decrement likes count:', updateError);
        }

        return { action: 'unliked', isLiked: false };
      } else {
        // Add like
        const { error: insertError } = await ctx.supabase
          .from('comment_likes')
          .insert([{
            comment_id: input.commentId,
            user_id: input.userId,
          }]);

        if (insertError) {
          throw new Error(`Failed to add comment like: ${insertError.message}`);
        }

        // Update likes count
        const { error: updateError } = await ctx.supabase.rpc('increment_comment_likes', {
          comment_id_param: input.commentId,
        });

        if (updateError) {
          console.error('Failed to increment likes count:', updateError);
        }

        return { action: 'liked', isLiked: true };
      }
    }),

  // ユーザーのコメントいいね状態を確認
  getUserLikeStatus: publicProcedure
    .input(z.object({
      userId: z.string(),
      commentIds: z.array(z.string()),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', input.userId)
        .in('comment_id', input.commentIds);

      if (error) {
        throw new Error(`Failed to fetch comment like status: ${error.message}`);
      }

      return data?.map(like => like.comment_id) || [];
    }),

  // コメントを削除
  delete: publicProcedure
    .input(z.object({
      commentId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if user owns the comment
      const { data: comment, error: fetchError } = await ctx.supabase
        .from('comments')
        .select('user_id')
        .eq('id', input.commentId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch comment: ${fetchError.message}`);
      }

      if (comment.user_id !== input.userId) {
        throw new Error('You can only delete your own comments');
      }

      const { error: deleteError } = await ctx.supabase
        .from('comments')
        .delete()
        .eq('id', input.commentId);

      if (deleteError) {
        throw new Error(`Failed to delete comment: ${deleteError.message}`);
      }

      return { success: true };
    }),
});