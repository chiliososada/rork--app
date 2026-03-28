import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const authRouter = createTRPCRouter({
  // ユーザー登録
  signUp: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      nickname: z.string().min(1).max(50),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.auth.signUp({
        email: input.email,
        password: input.password,
      });

      if (error) {
        throw new Error(`Sign up failed: ${error.message}`);
      }

      if (data.user) {
        // Create user profile
        const { error: profileError } = await ctx.supabase
          .from('users')
          .insert([{
            id: data.user.id,
            email: data.user.email,
            nickname: input.nickname,
            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(input.nickname)}&background=random`,
          }]);

        if (profileError) {
          throw new Error(`Failed to create user profile: ${profileError.message}`);
        }

        // Create default notification settings
        await ctx.supabase.rpc('create_default_notification_settings', {
          user_id_param: data.user.id,
        });
      }

      return data;
    }),

  // ログイン
  signIn: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        throw new Error(`Sign in failed: ${error.message}`);
      }

      // Get user profile
      if (data.user) {
        const { data: userProfile, error: profileError } = await ctx.supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          throw new Error(`Failed to fetch user profile: ${profileError.message}`);
        }

        return {
          user: data.user,
          profile: userProfile,
          session: data.session,
        };
      }

      return data;
    }),

  // ログアウト
  signOut: publicProcedure
    .mutation(async ({ ctx }) => {
      const { error } = await ctx.supabase.auth.signOut();

      if (error) {
        throw new Error(`Sign out failed: ${error.message}`);
      }

      return { success: true };
    }),

  // 現在のユーザー情報を取得
  getCurrentUser: publicProcedure
    .query(async ({ ctx }) => {
      const { data: { user }, error } = await ctx.supabase.auth.getUser();

      if (error) {
        throw new Error(`Failed to get current user: ${error.message}`);
      }

      if (!user) {
        return null;
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await ctx.supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new Error(`Failed to fetch user profile: ${profileError.message}`);
      }

      return {
        user,
        profile: userProfile,
      };
    }),

  // ユーザープロファイルを更新
  updateProfile: publicProcedure
    .input(z.object({
      userId: z.string(),
      nickname: z.string().min(1).max(50).optional(),
      avatarUrl: z.string().optional(),
      gender: z.string().optional(),
      isProfilePublic: z.boolean().optional(),
      isFollowersVisible: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const updateData: any = {};
      
      if (input.nickname !== undefined) updateData.nickname = input.nickname;
      if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl;
      if (input.gender !== undefined) updateData.gender = input.gender;
      if (input.isProfilePublic !== undefined) updateData.is_profile_public = input.isProfilePublic;
      if (input.isFollowersVisible !== undefined) updateData.is_followers_visible = input.isFollowersVisible;

      const { data, error } = await ctx.supabase
        .from('users')
        .update(updateData)
        .eq('id', input.userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update profile: ${error.message}`);
      }

      return data;
    }),

  // パスワードリセット
  resetPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase.auth.resetPasswordForEmail(input.email);

      if (error) {
        throw new Error(`Password reset failed: ${error.message}`);
      }

      return { success: true };
    }),
});