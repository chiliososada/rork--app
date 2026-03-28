import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const chatRouter = createTRPCRouter({
  // トピックチャットのメッセージを取得
  getTopicMessages: publicProcedure
    .input(z.object({
      topicId: z.string(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('chat_messages')
        .select(`
          *,
          users:user_id (
            id,
            nickname,
            avatar_url
          )
        `)
        .eq('topic_id', input.topicId)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        throw new Error(`Failed to fetch chat messages: ${error.message}`);
      }

      return data?.reverse() || [];
    }),

  // トピックチャットにメッセージを送信
  sendTopicMessage: publicProcedure
    .input(z.object({
      topicId: z.string(),
      userId: z.string(),
      message: z.string().min(1).max(1000),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('chat_messages')
        .insert([{
          topic_id: input.topicId,
          user_id: input.userId,
          message: input.message,
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
        throw new Error(`Failed to send message: ${error.message}`);
      }

      // Update topic participation
      await ctx.supabase
        .from('topic_participants')
        .upsert([{
          topic_id: input.topicId,
          user_id: input.userId,
          is_active: true,
        }], {
          onConflict: 'topic_id,user_id',
        });

      return data;
    }),

  // プライベートチャット一覧を取得
  getPrivateChats: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('get_user_private_chats', {
        user_id_param: input.userId,
      });

      if (error) {
        throw new Error(`Failed to fetch private chats: ${error.message}`);
      }

      return data || [];
    }),

  // プライベートチャットを作成または取得
  createOrGetPrivateChat: publicProcedure
    .input(z.object({
      userId1: z.string(),
      userId2: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('create_or_get_private_chat', {
        user1_id: input.userId1,
        user2_id: input.userId2,
      });

      if (error) {
        throw new Error(`Failed to create or get private chat: ${error.message}`);
      }

      return data;
    }),

  // プライベートメッセージを取得
  getPrivateMessages: publicProcedure
    .input(z.object({
      chatId: z.string(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('private_messages')
        .select(`
          *,
          users:sender_id (
            id,
            nickname,
            avatar_url
          )
        `)
        .eq('chat_id', input.chatId)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        throw new Error(`Failed to fetch private messages: ${error.message}`);
      }

      return data?.reverse() || [];
    }),

  // プライベートメッセージを送信
  sendPrivateMessage: publicProcedure
    .input(z.object({
      chatId: z.string(),
      senderId: z.string(),
      message: z.string().min(1).max(1000),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('private_messages')
        .insert([{
          chat_id: input.chatId,
          sender_id: input.senderId,
          message: input.message,
        }])
        .select(`
          *,
          users:sender_id (
            id,
            nickname,
            avatar_url
          )
        `)
        .single();

      if (error) {
        throw new Error(`Failed to send private message: ${error.message}`);
      }

      // Update chat's last message time
      await ctx.supabase
        .from('private_chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', input.chatId);

      return data;
    }),

  // メッセージを既読にする
  markAsRead: publicProcedure
    .input(z.object({
      chatId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('chat_id', input.chatId)
        .neq('sender_id', input.userId)
        .eq('is_read', false);

      if (error) {
        throw new Error(`Failed to mark messages as read: ${error.message}`);
      }

      return { success: true };
    }),

  // ユーザーの参加中チャット一覧を取得
  getUserChatTopics: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.rpc('get_user_chat_topics', {
        user_id_param: input.userId,
      });

      if (error) {
        throw new Error(`Failed to fetch user chat topics: ${error.message}`);
      }

      return data || [];
    }),
});