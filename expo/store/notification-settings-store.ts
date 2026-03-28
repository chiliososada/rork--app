import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface NotificationSettings {
  userId: string;
  pushNotifications: boolean;
  messageNotifications: boolean;
  followNotifications: boolean;
  likeNotifications: boolean;
  commentNotifications: boolean;
  deviceToken?: string;
  devicePlatform?: 'ios' | 'android' | 'web';
}

interface NotificationSettingsState {
  settings: NotificationSettings | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchSettings: (userId: string) => Promise<void>;
  updateSettings: (updates: Partial<Omit<NotificationSettings, 'userId'>>) => Promise<boolean>;
  updatePushNotifications: (enabled: boolean) => Promise<boolean>;
  updateMessageNotifications: (enabled: boolean) => Promise<boolean>;
  updateFollowNotifications: (enabled: boolean) => Promise<boolean>;
  updateLikeNotifications: (enabled: boolean) => Promise<boolean>;
  updateCommentNotifications: (enabled: boolean) => Promise<boolean>;
  updateDeviceToken: (token: string, platform: 'ios' | 'android' | 'web') => Promise<boolean>;
  resetError: () => void;
}

export const useNotificationSettingsStore = create<NotificationSettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async (userId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      console.log('📱 Fetching notification settings for user:', userId);
      
      // RPC関数を使用してデフォルト設定付きで取得
      const { data, error } = await supabase
        .rpc('get_user_notification_settings', { user_id_param: userId });

      if (error) {
        console.error('❌ Error fetching notification settings:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const settingsData = data[0];
        const settings: NotificationSettings = {
          userId: settingsData.user_id,
          pushNotifications: settingsData.push_notifications,
          messageNotifications: settingsData.message_notifications,
          followNotifications: settingsData.follow_notifications,
          likeNotifications: settingsData.like_notifications,
          commentNotifications: settingsData.comment_notifications,
          deviceToken: settingsData.device_token,
          devicePlatform: settingsData.device_platform,
        };

        console.log('✅ Notification settings loaded:', settings);
        set({ settings, isLoading: false });
      } else {
        console.log('⚠️ No notification settings found, using defaults');
        // デフォルト設定を作成
        const defaultSettings: NotificationSettings = {
          userId,
          pushNotifications: true,
          messageNotifications: true,
          followNotifications: true,
          likeNotifications: true,
          commentNotifications: true,
        };
        set({ settings: defaultSettings, isLoading: false });
      }
    } catch (error) {
      console.error('❌ Failed to fetch notification settings:', error);
      set({ 
        error: error instanceof Error ? error.message : '通知設定の取得に失敗しました',
        isLoading: false 
      });
    }
  },

  updateSettings: async (updates: Partial<Omit<NotificationSettings, 'userId'>>) => {
    const { settings } = get();
    if (!settings) {
      console.error('❌ No settings to update');
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      console.log('📱 Updating notification settings:', updates);

      const { data, error } = await supabase
        .rpc('update_notification_settings', {
          user_id_param: settings.userId,
          push_notifications_param: updates.pushNotifications,
          message_notifications_param: updates.messageNotifications,
          follow_notifications_param: updates.followNotifications,
          like_notifications_param: updates.likeNotifications,
          comment_notifications_param: updates.commentNotifications,
          device_token_param: updates.deviceToken,
          device_platform_param: updates.devicePlatform,
        });

      if (error) {
        console.error('❌ Error updating notification settings:', error);
        throw error;
      }

      // ローカル状態を更新
      const updatedSettings = { ...settings, ...updates };
      console.log('✅ Notification settings updated:', updatedSettings);
      
      set({ settings: updatedSettings, isLoading: false });
      return true;
    } catch (error) {
      console.error('❌ Failed to update notification settings:', error);
      set({ 
        error: error instanceof Error ? error.message : '通知設定の更新に失敗しました',
        isLoading: false 
      });
      return false;
    }
  },

  updatePushNotifications: async (enabled: boolean) => {
    return get().updateSettings({ pushNotifications: enabled });
  },

  updateMessageNotifications: async (enabled: boolean) => {
    return get().updateSettings({ messageNotifications: enabled });
  },

  updateFollowNotifications: async (enabled: boolean) => {
    return get().updateSettings({ followNotifications: enabled });
  },

  updateLikeNotifications: async (enabled: boolean) => {
    return get().updateSettings({ likeNotifications: enabled });
  },

  updateCommentNotifications: async (enabled: boolean) => {
    return get().updateSettings({ commentNotifications: enabled });
  },

  updateDeviceToken: async (token: string, platform: 'ios' | 'android' | 'web') => {
    return get().updateSettings({ deviceToken: token, devicePlatform: platform });
  },

  resetError: () => {
    set({ error: null });
  },
}));