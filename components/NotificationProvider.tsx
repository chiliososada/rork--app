import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import ToastNotification from './ToastNotification';
import { usePushNotificationStore, AppNotification } from '@/store/push-notification-store';
import { useAuthStore } from '@/store/auth-store';

interface NotificationProviderProps {
  children: React.ReactNode;
}

export default function NotificationProvider({ children }: NotificationProviderProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    registerForPushNotifications,
    addNotification,
    sendNotification,
  } = usePushNotificationStore();
  const [currentToast, setCurrentToast] = useState<AppNotification | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (user?.id) {
      initializeNotifications(user.id);
    }

    // クリーンアップ
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.id]);

  const initializeNotifications = async (userId: string) => {
    console.log('🔔 Initializing notifications...');
    
    // プッシュ通知の権限を取得
    await registerForPushNotifications();

    // フォアグラウンド通知リスナー
    notificationListener.current = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );

    // 通知タップ時のリスナー
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    // アプリ状態変更リスナー
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  };

  const handleNotificationReceived = (notification: Notifications.Notification) => {
    console.log('📱 Notification received:', notification);
    
    const { title, body, data } = notification.request.content;
    
    // アプリ内通知オブジェクトを作成
    const appNotification: AppNotification = {
      id: notification.request.identifier,
      title: title || '新しい通知',
      body: body || '',
      data: data,
      type: (data?.type as "message" | "comment" | "follow" | "like" | "system") || 'system',
      userId: data?.userId as string | undefined,
      topicId: data?.topicId as string | undefined,
      isRead: false,
      createdAt: new Date(),
    };

    // ストアに通知を追加
    addNotification(appNotification);

    // アプリがフォアグラウンドの場合、トースト通知を表示
    if (appState.current === 'active') {
      showToastNotification(appNotification);
    }
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    console.log('🎯 Notification tapped:', response);
    
    const { data } = response.notification.request.content;
    
    // 通知タイプに応じて適切な画面に遷移
    navigateFromNotification(data);
  };

  const showToastNotification = (notification: AppNotification) => {
    // 現在のトーストを一旦クリア
    if (currentToast) {
      setCurrentToast(null);
      // 少し待ってから新しいトーストを表示
      setTimeout(() => {
        setCurrentToast(notification);
      }, 100);
    } else {
      setCurrentToast(notification);
    }
  };

  const navigateFromNotification = (data: any) => {
    try {
      if (data?.topicId) {
        if (data.type === 'message') {
          router.push(`/chat/${data.topicId}`);
        } else {
          router.push(`/topic/${data.topicId}`);
        }
      } else if (data?.type === 'follow' && data?.userId) {
        router.push(`/user/${data.userId}`);
      } else {
        // デフォルトで通知センターを開く
        router.push('/notifications');
      }
    } catch (error) {
      console.error('❌ Failed to navigate from notification:', error);
      // フォールバック：通知センターを開く
      router.push('/notifications');
    }
  };

  const handleToastPress = () => {
    if (currentToast) {
      // トーストをタップした時の処理
      navigateFromNotification(currentToast.data);
      setCurrentToast(null);
    }
  };

  const handleToastDismiss = () => {
    setCurrentToast(null);
  };

  // テスト用の通知送信関数（開発時のみ使用）
  const sendTestNotification = () => {
    if (process.env.NODE_ENV === 'development') {
      const testNotification: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'> = {
        title: 'テスト通知',
        body: 'これはテスト用の通知です',
        type: 'system',
        data: { test: true },
      };
      
      sendNotification(testNotification);
    }
  };

  return (
    <>
      {children}
      <ToastNotification
        notification={currentToast}
        onPress={handleToastPress}
        onDismiss={handleToastDismiss}
      />
    </>
  );
}