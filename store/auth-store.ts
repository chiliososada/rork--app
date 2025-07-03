import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import { mockUsers } from '@/mocks/data';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
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
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Mock login - in a real app, this would be an API call
          if (email === "demo@example.com" && password === "password") {
            set({ 
              user: mockUsers[0],
              isAuthenticated: true,
              isLoading: false 
            });
          } else {
            set({ 
              error: "Invalid email or password", 
              isLoading: false 
            });
          }
        } catch (error) {
          set({ 
            error: "Login failed. Please try again.", 
            isLoading: false 
          });
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        
        try {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Mock registration - in a real app, this would be an API call
          const newUser: User = {
            id: `user-${Date.now()}`,
            name,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
            email
          };
          
          set({ 
            user: newUser,
            isAuthenticated: true,
            isLoading: false 
          });
        } catch (error) {
          set({ 
            error: "Registration failed. Please try again.", 
            isLoading: false 
          });
        }
      },

      logout: () => {
        set({ 
          user: null, 
          isAuthenticated: false 
        });
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);