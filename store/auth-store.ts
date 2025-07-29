import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { useBlockingStore } from '@/store/blocking-store';
import { useReportingStore } from '@/store/reporting-store';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isUpdatingAvatar: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isUpdatingAvatar: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            set({ 
              error: error.message, 
              isLoading: false 
            });
            return;
          }

          if (data.user) {
            // Get user profile from users table
            const { data: userProfile, error: profileError } = await supabase
              .from('users')
              .select('id, nickname, avatar_url, email, gender, created_at, is_profile_public, is_followers_visible')
              .eq('id', data.user.id)
              .single();

            if (profileError) {
              set({ 
                error: "ユーザープロファイルの取得に失敗しました", 
                isLoading: false 
              });
              return;
            }

            const user: User = {
              id: userProfile.id,
              name: userProfile.nickname,
              avatar: userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.nickname)}&background=random`,
              email: userProfile.email || data.user.email,
              isProfilePublic: userProfile.is_profile_public ?? true,
              isFollowersVisible: userProfile.is_followers_visible ?? true
            };

            set({ 
              user,
              isAuthenticated: true,
              isLoading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: "ログインに失敗しました。もう一度お試しください。", 
            isLoading: false 
          });
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });

          if (error) {
            set({ 
              error: error.message, 
              isLoading: false 
            });
            return;
          }

          if (data.user) {
            // Create user profile in users table
            const { error: profileError } = await supabase
              .from('users')
              .insert([
                {
                  id: data.user.id,
                  email: data.user.email,
                  nickname: name,
                  avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                }
              ]);

            if (profileError) {
              set({ 
                error: "ユーザープロファイルの作成に失敗しました", 
                isLoading: false 
              });
              return;
            }

            const user: User = {
              id: data.user.id,
              name: name,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
              email: data.user.email || email
            };

            set({ 
              user,
              isAuthenticated: true,
              isLoading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: "登録に失敗しました。もう一度お試しください。", 
            isLoading: false 
          });
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        
        // Clear related stores when logging out
        const blockingStore = useBlockingStore.getState();
        const reportingStore = useReportingStore.getState();
        
        blockingStore.clearBlockStatusCache();
        reportingStore.clearReportCache();
        
        set({ 
          user: null, 
          isAuthenticated: false 
        });
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            const { data: userProfile, error: profileError } = await supabase
              .from('users')
              .select('id, nickname, avatar_url, email, gender, created_at, is_profile_public, is_followers_visible')
              .eq('id', user.id)
              .single();

            if (!profileError && userProfile) {
              const userObj: User = {
                id: userProfile.id,
                name: userProfile.nickname,
                avatar: userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.nickname)}&background=random`,
                email: userProfile.email || user.email,
                isProfilePublic: userProfile.is_profile_public ?? true,
                isFollowersVisible: userProfile.is_followers_visible ?? true
              };

              set({ 
                user: userObj,
                isAuthenticated: true 
              });

              // Load user-specific data when authenticated (only if not already loaded recently)
              const blockingStore = useBlockingStore.getState();
              const reportingStore = useReportingStore.getState();
              
              // Only load blocked users if we don't have recent data or if user changed
              const now = Date.now();
              const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
              const shouldLoadBlocked = !blockingStore.lastUpdated || 
                                      (now - blockingStore.lastUpdated > fiveMinutes) ||
                                      blockingStore.currentLoadingUserId !== userObj.id;
              
              if (shouldLoadBlocked && !blockingStore.loadingPromise) {
                blockingStore.loadBlockedUsers(userObj.id).catch(() => {
                  // Silently handle error - component will handle retry if needed
                });
              }
              
              // Load report data only if needed
              if (!reportingStore.categories.length) {
                reportingStore.loadReportCategories();
              }
              
              if (!reportingStore.userReports.length) {
                reportingStore.loadUserReports(userObj.id);
              }
            }
          } else {
            set({ 
              user: null,
              isAuthenticated: false 
            });
          }
        } catch (error) {
          set({ 
            user: null,
            isAuthenticated: false 
          });
        }
      },

      updateAvatar: async (avatarUrl: string) => {
        const { user } = get();
        if (!user) {
          throw new Error('ユーザーがログインしていません');
        }

        set({ isUpdatingAvatar: true, error: null });
        
        try {
          // 数据库中更新头像URL
          const { error } = await supabase
            .from('users')
            .update({ avatar_url: avatarUrl })
            .eq('id', user.id);

          if (error) {
            throw error;
          }

          // 本地状态更新
          set({ 
            user: {
              ...user,
              avatar: avatarUrl
            },
            isUpdatingAvatar: false 
          });

          } catch (error: any) {
          set({ 
            error: "アバターの更新に失敗しました。もう一度お試しください。", 
            isUpdatingAvatar: false 
          });
          console.error('Avatar update error:', error);
          throw error;
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);