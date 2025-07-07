import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
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
              .select('*')
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
              email: userProfile.email || data.user.email
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
              .select('*')
              .eq('id', user.id)
              .single();

            if (!profileError && userProfile) {
              const userObj: User = {
                id: userProfile.id,
                name: userProfile.nickname,
                avatar: userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.nickname)}&background=random`,
                email: userProfile.email || user.email
              };

              set({ 
                user: userObj,
                isAuthenticated: true 
              });
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
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);