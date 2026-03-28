import React, { useMemo } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { 
  Bell, 
  MessageSquare, 
  Heart, 
  MessageCircle, 
  Users, 
  Settings,
  Trash2,
  CheckCircle2,
  Check
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePushNotificationStore, AppNotification } from '@/store/push-notification-store';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

const getNotificationIcon = (type: AppNotification['type']) => {
  switch (type) {
    case 'message':
      return <MessageSquare size={20} color="#007AFF" />;
    case 'like':
      return <Heart size={20} color="#FF3B30" />;
    case 'comment':
      return <MessageCircle size={20} color="#34C759" />;
    case 'follow':
      return <Users size={20} color="#5856D6" />;
    case 'system':
      return <Bell size={20} color="#FF9500" />;
    default:
      return <Bell size={20} color="#8E8E93" />;
  }
};

const getNotificationTypeText = (type: AppNotification['type']) => {
  switch (type) {
    case 'message':
      return 'メッセージ';
    case 'like':
      return 'いいね';
    case 'comment':
      return 'コメント';
    case 'follow':
      return 'フォロー';
    case 'system':
      return 'システム';
    default:
      return '通知';
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
  } = usePushNotificationStore();

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications]);

  const handleNotificationPress = (notification: AppNotification) => {
    // 未読の場合は既読にする
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // 通知タイプに応じて適切な画面に遷移
    if (notification.topicId) {
      if (notification.type === 'message') {
        router.push(`/chat/${notification.topicId}`);
      } else {
        router.push(`/topic/${notification.topicId}`);
      }
    } else if (notification.type === 'follow' && notification.userId) {
      router.push(`/user/${notification.userId}`);
    }
  };

  const handleDeleteNotification = (notificationId: string, event: any) => {
    event.stopPropagation();
    Alert.alert(
      '通知を削除',
      'この通知を削除しますか？',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => removeNotification(notificationId),
        },
      ]
    );
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      markAllAsRead();
    }
  };

  const handleClearAll = () => {
    if (notifications.length > 0) {
      Alert.alert(
        'すべての通知を削除',
        'すべての通知を削除しますか？この操作は取り消せません。',
        [
          {
            text: 'キャンセル',
            style: 'cancel',
          },
          {
            text: '削除',
            style: 'destructive',
            onPress: clearAllNotifications,
          },
        ]
      );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '通知',
          headerBackTitle: '戻る',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/settings/notifications')}
              style={styles.headerButton}
            >
              <Settings size={20} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        {/* アクションバー */}
        {notifications.length > 0 && (
          <View style={styles.actionBar}>
            <TouchableOpacity
              onPress={handleMarkAllAsRead}
              style={[styles.actionButton, { opacity: unreadCount > 0 ? 1 : 0.5 }]}
              disabled={unreadCount === 0}
            >
              <CheckCircle2 size={16} color={Colors.primary} />
              <Text style={styles.actionButtonText}>すべて既読</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleClearAll}
              style={styles.actionButton}
            >
              <Trash2 size={16} color={Colors.error} />
              <Text style={[styles.actionButtonText, { color: Colors.error }]}>すべて削除</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Bell size={64} color={Colors.text.secondary} />
              <Text style={styles.emptyTitle}>通知はありません</Text>
              <Text style={styles.emptySubtitle}>
                新しい通知が届くとここに表示されます
              </Text>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {sortedNotifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationItem,
                    !notification.isRead && styles.unreadNotification,
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationIcon}>
                      {getNotificationIcon(notification.type)}
                    </View>
                    
                    <View style={styles.notificationTexts}>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle}>
                          {notification.title}
                        </Text>
                        {!notification.isRead && (
                          <View style={styles.unreadDot} />
                        )}
                      </View>
                      
                      <Text style={styles.notificationBody}>
                        {notification.body}
                      </Text>
                      
                      <View style={styles.notificationMeta}>
                        <Text style={styles.notificationType}>
                          {getNotificationTypeText(notification.type)}
                        </Text>
                        <Text style={styles.notificationTime}>
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: ja,
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={(event) => handleDeleteNotification(notification.id, event)}
                  >
                    <Trash2 size={16} color={Colors.text.secondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  notificationsList: {
    paddingTop: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationTexts: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationType: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});