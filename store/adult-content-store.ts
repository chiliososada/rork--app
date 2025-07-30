import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AdultContentState {
  // 确认状态
  hasConfirmedAdultContent: boolean;
  confirmationDate: string | null;
  
  // 首次启动检查
  isFirstTimeUser: boolean;
  needsConfirmation: boolean;
  
  // 确认详情
  confirmationMethod: 'modal' | 'full_screen' | null;
  ipAddress: string | null;
  userAgent: string | null;
  
  // Actions
  confirmAdultContent: (method: 'modal' | 'full_screen') => void;
  resetConfirmation: () => void;
  setFirstTimeUser: (isFirstTime: boolean) => void;
  checkConfirmationNeeded: () => boolean;
  markConfirmationShown: () => void;
  validateState: () => boolean; // 状态验证方法
}

export const useAdultContentStore = create<AdultContentState>()(
  persist(
    (set, get) => ({
      // Initial state
      hasConfirmedAdultContent: false,
      confirmationDate: null,
      isFirstTimeUser: true,
      needsConfirmation: true,
      confirmationMethod: null,
      ipAddress: null,
      userAgent: null,

      // 确认成人内容
      confirmAdultContent: (method: 'modal' | 'full_screen') => {
        const now = new Date().toISOString();
        
        set({
          hasConfirmedAdultContent: true,
          confirmationDate: now,
          isFirstTimeUser: false,
          needsConfirmation: false,
          confirmationMethod: method,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
        });
      },

      // 重置确认状态（用于设置页面的重置功能）
      resetConfirmation: () => {
        set({
          hasConfirmedAdultContent: false,
          confirmationDate: null,
          isFirstTimeUser: true,
          needsConfirmation: true,
          confirmationMethod: null,
          ipAddress: null,
          userAgent: null
        });
      },

      // 设置是否为首次用户
      setFirstTimeUser: (isFirstTime: boolean) => {
        set({ isFirstTimeUser: isFirstTime });
      },

      // 检查是否需要确认
      checkConfirmationNeeded: () => {
        const state = get();
        
        // 如果已经确认过，不需要再次确认
        if (state.hasConfirmedAdultContent && state.confirmationDate) {
          return false;
        }
        
        // 首次用户或者未确认的用户需要确认
        return state.isFirstTimeUser || state.needsConfirmation;
      },

      // 标记确认弹窗已显示（防止重复显示）
      markConfirmationShown: () => {
        set({ needsConfirmation: false });
      },

      // 状态验证方法
      validateState: () => {
        const state = get();
        
        // 检查状态一致性
        if (state.hasConfirmedAdultContent && !state.confirmationDate) {
          console.warn('Adult content: invalid state - confirmed but no date');
          return false;
        }
        
        if (!state.hasConfirmedAdultContent && state.confirmationDate) {
          console.warn('Adult content: invalid state - not confirmed but has date');
          return false;
        }
        
        return true;
      }
    }),
    {
      name: 'adult-content-storage',
      storage: createJSONStorage(() => AsyncStorage),
      
      // 部分状态持久化配置
      partialize: (state) => ({
        hasConfirmedAdultContent: state.hasConfirmedAdultContent,
        confirmationDate: state.confirmationDate,
        isFirstTimeUser: state.isFirstTimeUser,
        confirmationMethod: state.confirmationMethod,
        ipAddress: state.ipAddress,
        userAgent: state.userAgent
        // needsConfirmation 不持久化，每次启动时根据其他状态计算
      }),
      
      // 从存储恢复时的处理
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 根据已有状态计算是否需要确认
          const needsConfirmation = !state.hasConfirmedAdultContent || !state.confirmationDate;
          state.needsConfirmation = needsConfirmation;
          
          // 确保状态一致性：如果已确认但没有日期，重置确认状态
          if (state.hasConfirmedAdultContent && !state.confirmationDate) {
            console.warn('Adult content: inconsistent state detected, resetting confirmation');
            state.hasConfirmedAdultContent = false;
            state.needsConfirmation = true;
            state.isFirstTimeUser = true;
          }
        }
      }
    }
  )
);