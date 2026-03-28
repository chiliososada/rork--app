import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import * as Device from 'expo-device';
import * as Location from 'expo-location';

// 年龄验证相关类型
interface AgeVerificationStatus {
  isVerified: boolean;
  verificationMethod: string | null;
  verificationStatus: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  calculatedAge: number | null;
  needsReverification: boolean;
}

interface AgeVerificationConfig {
  minimumAge: number;
  allowedMethods: string[];
  requireVerification: boolean;
  gracePeriodHours: number;
}

interface AdultContentState {
  // 客户端确认状态（向后兼容）
  hasConfirmedAdultContent: boolean;
  confirmationDate: string | null;
  
  // 服务器端验证状态
  serverVerificationStatus: AgeVerificationStatus | null;
  verificationConfig: AgeVerificationConfig | null;
  
  // 首次启动检查
  isFirstTimeUser: boolean;
  needsConfirmation: boolean;
  
  // 确认详情
  confirmationMethod: 'modal' | 'full_screen' | null;
  ipAddress: string | null;
  userAgent: string | null;
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  
  // Actions
  confirmAdultContent: (method: 'modal' | 'full_screen') => void;
  resetConfirmation: () => void;
  setFirstTimeUser: (isFirstTime: boolean) => void;
  checkConfirmationNeeded: () => boolean;
  markConfirmationShown: () => void;
  validateState: () => boolean;
  
  // 服务器端验证操作
  initializeServerVerification: () => Promise<void>;
  submitAgeVerification: (birthDate: Date, method?: string) => Promise<{ success: boolean; message: string; requiresReview?: boolean }>;
  checkServerVerificationStatus: () => Promise<AgeVerificationStatus>;
  getVerificationConfig: () => Promise<AgeVerificationConfig>;
  canAccessAdultContent: () => boolean;
  collectDeviceInfo: () => Promise<any>;
}

export const useAdultContentStore = create<AdultContentState>()(
  persist(
    (set, get) => ({
      // Initial state
      hasConfirmedAdultContent: false,
      confirmationDate: null,
      serverVerificationStatus: null,
      verificationConfig: null,
      isFirstTimeUser: true,
      needsConfirmation: true,
      confirmationMethod: null,
      ipAddress: null,
      userAgent: null,
      isLoading: false,
      error: null,

      // 确认成人内容（客户端，向后兼容）
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
          userAgent: null,
          serverVerificationStatus: null
        });
      },

      // 设置是否为首次用户
      setFirstTimeUser: (isFirstTime: boolean) => {
        set({ isFirstTimeUser: isFirstTime });
      },

      // 检查是否需要确认
      checkConfirmationNeeded: () => {
        const state = get();
        
        console.log('Checking confirmation needed:', {
          serverVerified: state.serverVerificationStatus?.isVerified,
          hasConfirmed: state.hasConfirmedAdultContent,
          isFirstTime: state.isFirstTimeUser,
          needsConfirmation: state.needsConfirmation
        });
        
        // 优先检查服务器端验证
        if (state.serverVerificationStatus?.isVerified) {
          console.log('Server verification passed, no confirmation needed');
          return false;
        }
        
        // 如果已经确认过，不需要再次确认
        if (state.hasConfirmedAdultContent && state.confirmationDate) {
          console.log('Already confirmed, no confirmation needed');
          return false;
        }
        
        // 如果已经标记为不需要确认，则不需要确认
        if (!state.needsConfirmation && !state.isFirstTimeUser) {
          console.log('Marked as no confirmation needed');
          return false;
        }
        
        // 检查宽限期（新用户）
        if (state.verificationConfig?.gracePeriodHours && state.isFirstTimeUser) {
          const graceEndTime = new Date();
          graceEndTime.setHours(graceEndTime.getHours() - state.verificationConfig.gracePeriodHours);
          
          if (state.confirmationDate && new Date(state.confirmationDate) > graceEndTime) {
            return !state.hasConfirmedAdultContent;
          }
        }
        
        // 首次用户或者明确需要确认的用户需要确认
        const needsConfirmation = state.isFirstTimeUser || state.needsConfirmation;
        console.log('Final confirmation needed result:', needsConfirmation);
        return needsConfirmation;
      },

      // 标记确认弹窗已显示（防止重复显示）
      markConfirmationShown: () => {
        console.log('Marking confirmation as shown');
        set({ 
          needsConfirmation: false,
          isFirstTimeUser: false
        });
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
      },

      // 初始化服务器端验证
      initializeServerVerification: async () => {
        try {
          set({ isLoading: true, error: null });
          
          // 获取验证配置
          const config = await get().getVerificationConfig();
          
          // 检查当前验证状态
          const status = await get().checkServerVerificationStatus();
          
          set({ 
            verificationConfig: config,
            serverVerificationStatus: status,
            isLoading: false 
          });
          
        } catch (error) {
          console.error('初始化服务器验证失败:', error);
          set({ 
            error: error instanceof Error ? error.message : '初始化失败',
            isLoading: false 
          });
        }
      },

      // 提交年龄验证
      submitAgeVerification: async (birthDate: Date, method: string = 'self_declared') => {
        try {
          set({ isLoading: true, error: null });
          
          // 获取当前用户ID
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('用户未登录');
          }
          
          // 收集设备和位置信息
          const deviceInfo = await get().collectDeviceInfo();
          
          // 调用服务器端验证函数
          const { data, error } = await supabase.rpc('submit_age_verification', {
            user_id_param: user.id,
            verification_method_param: method,
            declared_birth_date_param: birthDate.toISOString().split('T')[0],
            ip_address_param: deviceInfo.ipAddress,
            user_agent_param: deviceInfo.userAgent,
            device_fingerprint_param: deviceInfo.deviceFingerprint,
            geolocation_param: deviceInfo.geolocation
          });
          
          if (error) {
            throw error;
          }
          
          const result = data[0];
          
          // 更新本地状态
          if (result.status === 'approved') {
            const now = new Date().toISOString();
            set({
              hasConfirmedAdultContent: true,
              confirmationDate: now,
              needsConfirmation: false
            });
          }
          
          // 刷新服务器验证状态
          const updatedStatus = await get().checkServerVerificationStatus();
          set({ 
            serverVerificationStatus: updatedStatus,
            isLoading: false 
          });
          
          return {
            success: true,
            message: result.message,
            requiresReview: result.requires_manual_review
          };
          
        } catch (error) {
          console.error('提交年龄验证失败:', error);
          const errorMessage = error instanceof Error ? error.message : '验证提交失败';
          set({ error: errorMessage, isLoading: false });
          
          return {
            success: false,
            message: errorMessage
          };
        }
      },

      // 检查服务器验证状态
      checkServerVerificationStatus: async (): Promise<AgeVerificationStatus> => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            return {
              isVerified: false,
              verificationMethod: null,
              verificationStatus: 'not_verified',
              verifiedAt: null,
              expiresAt: null,
              calculatedAge: null,
              needsReverification: true
            };
          }
          
          const { data, error } = await supabase.rpc('check_age_verification_status', {
            user_id_param: user.id
          });
          
          if (error) {
            console.error('检查验证状态失败:', error);
            throw error;
          }
          
          const result = data[0];
          return {
            isVerified: result.is_verified,
            verificationMethod: result.verification_method,
            verificationStatus: result.verification_status,
            verifiedAt: result.verified_at,
            expiresAt: result.expires_at,
            calculatedAge: result.calculated_age,
            needsReverification: result.needs_reverification
          };
          
        } catch (error) {
          console.error('检查服务器验证状态失败:', error);
          return {
            isVerified: false,
            verificationMethod: null,
            verificationStatus: 'error',
            verifiedAt: null,
            expiresAt: null,
            calculatedAge: null,
            needsReverification: true
          };
        }
      },

      // 获取验证配置
      getVerificationConfig: async (): Promise<AgeVerificationConfig> => {
        try {
          const { data, error } = await supabase.rpc('get_age_verification_config');
          
          if (error) {
            console.error('获取验证配置失败:', error);
            throw error;
          }
          
          const result = data[0];
          return {
            minimumAge: result.minimum_age,
            allowedMethods: result.allowed_methods,
            requireVerification: result.require_verification,
            gracePeriodHours: result.grace_period_hours
          };
          
        } catch (error) {
          console.error('获取验证配置失败:', error);
          // 返回默认配置
          return {
            minimumAge: 18,
            allowedMethods: ['self_declared'],
            requireVerification: true,
            gracePeriodHours: 24
          };
        }
      },

      // 检查是否可以访问成人内容
      canAccessAdultContent: () => {
        const state = get();
        
        // 检查服务器端验证
        if (state.serverVerificationStatus?.isVerified) {
          return true;
        }
        
        // 检查宽限期（新用户）
        if (state.verificationConfig?.gracePeriodHours && state.isFirstTimeUser) {
          const graceEndTime = new Date();
          graceEndTime.setHours(graceEndTime.getHours() - state.verificationConfig.gracePeriodHours);
          
          if (state.confirmationDate && new Date(state.confirmationDate) > graceEndTime) {
            return state.hasConfirmedAdultContent;
          }
        }
        
        return false;
      },

      // 收集设备信息（辅助函数）
      collectDeviceInfo: async () => {
        try {
          let geolocation = null;
          
          // 获取位置信息（如果有权限）
          try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
              const location = await Location.getCurrentPositionAsync({});
              geolocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy
              };
            }
          } catch (error) {
            console.log('无法获取位置信息:', error);
          }
          
          // 生成设备指纹
          const deviceFingerprint = [
            Device.modelName || 'unknown',
            Device.osName || 'unknown',
            Device.osVersion || 'unknown',
            Device.brand || 'unknown'
          ].join('|');
          
          return {
            ipAddress: null, // IP地址由服务器端获取
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            deviceFingerprint,
            geolocation
          };
          
        } catch (error) {
          console.error('收集设备信息失败:', error);
          return {
            ipAddress: null,
            userAgent: null,
            deviceFingerprint: 'unknown',
            geolocation: null
          };
        }
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
        userAgent: state.userAgent,
        serverVerificationStatus: state.serverVerificationStatus,
        verificationConfig: state.verificationConfig
        // needsConfirmation, isLoading, error 不持久化
      }),
      
      // 从存储恢复时的处理
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 重置运行时状态
          state.isLoading = false;
          state.error = null;
          
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
          
          // 异步初始化服务器验证状态
          setTimeout(() => {
            state.initializeServerVerification().catch(error => {
              console.error('恢复时初始化服务器验证失败:', error);
            });
          }, 100);
        }
      }
    }
  )
);