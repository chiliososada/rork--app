import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import { isDevice } from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useNotificationSettingsStore } from './notification-settings-store';

// 通知の表示設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  type: 'message' | 'like' | 'comment' | 'follow' | 'system';
  userId?: string;
  topicId?: string;
  isRead: boolean;
  createdAt: Date;
}

interface PushNotificationState {
  expoPushToken: string | null;
  notifications: AppNotification[];
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  
  // Actions
  registerForPushNotifications: () => Promise<boolean>;
  sendNotification: (notification: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>) => Promise<void>;
  addNotification: (notification: AppNotification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  getUnreadCount: () => number;
  resetError: () => void;
}

export const usePushNotificationStore = create<PushNotificationState>((set, get) => ({
  expoPushToken: null,
  notifications: [],
  isLoading: false,
  error: null,
  unreadCount: 0,

  registerForPushNotifications: async () => {
    set({ isLoading: true, error: null });

    try {
      console.log('📱 Registering for push notifications...');

      if (!isDevice) {
        console.warn('⚠️ Push notifications only work on physical devices');
        console.log('ℹ️ Continuing with app-only notifications...');
        set({ 
          isLoading: false 
        });
        return true; // アプリ内通知は使用可能
      }

      // 通知権限を要求
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Push notification permission denied, using app-only notifications');
        set({ 
          isLoading: false 
        });
        return true; // アプリ内通知は使用可能
      }

      // 開発環境またはExpo Goではプッシュトークンの取得をスキップ
      const isExpoGo = process.env.EXPO_PUBLIC_APP_VARIANT === 'development' || 
                      typeof navigator !== 'undefined' && navigator.userAgent?.includes('Expo');
      
      if (isExpoGo || process.env.NODE_ENV === 'development') {
        console.log('ℹ️ Development mode: Skipping push token registration');
        console.log('ℹ️ App-only notifications are available');
        set({ 
          isLoading: false 
        });
        return true;
      }

      try {
        // Expo Push Token を取得（本番環境のみ）
        const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
        if (!projectId) {
          console.warn('⚠️ No EXPO_PUBLIC_PROJECT_ID found, using app-only notifications');
          set({ isLoading: false });
          return true;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        console.log('✅ Expo Push Token obtained:', tokenData.data);

        // デバイス情報とトークンをデータベースに保存
        const platform = Platform.OS as 'ios' | 'android' | 'web';
        const { updateDeviceToken } = useNotificationSettingsStore.getState();
        await updateDeviceToken(tokenData.data, platform);

        set({ 
          expoPushToken: tokenData.data,
          isLoading: false 
        });

        return true;
      } catch (tokenError) {
        console.warn('⚠️ Failed to get push token, using app-only notifications:', tokenError);
        set({ 
          isLoading: false 
        });
        return true; // アプリ内通知は使用可能
      }
    } catch (error) {
      console.warn('⚠️ Push notification setup failed, using app-only notifications:', error);
      set({ 
        isLoading: false 
      });
      return true; // アプリ内通知は使用可能
    }
  },

  sendNotification: async (notification: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>) => {
    // アプリ内通知は常に追加
    const appNotification: AppNotification = {
      id: Date.now().toString(),
      ...notification,
      isRead: false,
      createdAt: new Date(),
    };

    get().addNotification(appNotification);
    console.log('📱 App notification added:', notification.title);

    // プッシュ通知の送信を試行（利用可能な場合のみ）
    const { expoPushToken } = get();
    
    if (!expoPushToken) {
      console.log('ℹ️ No push token available, using app-only notification');
      return;
    }

    try {
      console.log('📤 Sending push notification:', notification);

      const message = {
        to: expoPushToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: {
          type: notification.type,
          userId: notification.userId,
          topicId: notification.topicId,
          ...notification.data,
        },
        badge: get().unreadCount + 1,
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('✅ Push notification sent:', result);
    } catch (error) {
      console.warn('⚠️ Failed to send push notification, app notification still available:', error);
    }
  },

  addNotification: (notification: AppNotification) => {
    set((state) => {
      const newNotifications = [notification, ...state.notifications];
      const unreadCount = newNotifications.filter(n => !n.isRead).length;
      
      return {
        notifications: newNotifications,
        unreadCount,
      };
    });
  },

  markAsRead: (notificationId: string) => {
    set((state) => {
      const updatedNotifications = state.notifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      );
      
      const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
      
      return {
        notifications: updatedNotifications,
        unreadCount,
      };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(notification => ({
        ...notification,
        isRead: true,
      })),
      unreadCount: 0,
    }));
  },

  removeNotification: (notificationId: string) => {
    set((state) => {
      const updatedNotifications = state.notifications.filter(
        notification => notification.id !== notificationId
      );
      const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
      
      return {
        notifications: updatedNotifications,
        unreadCount,
      };
    });
  },

  clearAllNotifications: () => {
    set({
      notifications: [],
      unreadCount: 0,
    });
  },

  getUnreadCount: () => {
    return get().unreadCount;
  },

  resetError: () => {
    set({ error: null });
  },
}));