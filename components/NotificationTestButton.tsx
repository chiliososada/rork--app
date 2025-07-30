import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Bell } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePushNotificationStore } from '@/store/push-notification-store';

export default function NotificationTestButton() {
  const { sendNotification } = usePushNotificationStore();

  const sendTestNotification = () => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    Alert.alert(
      'テスト通知を送信',
      '通知の種類を選択してください',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: 'メッセージ通知',
          onPress: () => {
            sendNotification({
              title: '新しいメッセージ',
              body: 'テストユーザーからメッセージが届きました',
              type: 'message',
              topicId: 'test-topic-1',
              userId: 'test-user-1',
            });
          },
        },
        {
          text: 'いいね通知',
          onPress: () => {
            sendNotification({
              title: 'いいね！',
              body: 'あなたの投稿にいいねがつきました',
              type: 'like',
              topicId: 'test-topic-2',
              userId: 'test-user-2',
            });
          },
        },
        {
          text: 'フォロー通知',
          onPress: () => {
            sendNotification({
              title: '新しいフォロワー',
              body: 'テストユーザーがあなたをフォローしました',
              type: 'follow',
              userId: 'test-user-3',
            });
          },
        },
      ]
    );
  };

  // 開発環境でのみ表示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={sendTestNotification}
      activeOpacity={0.7}
    >
      <Bell size={16} color={Colors.primary} />
      <Text style={styles.buttonText}>テスト通知</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
    marginLeft: 4,
  },
});