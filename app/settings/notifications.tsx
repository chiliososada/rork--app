import React, { useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Bell, MessageSquare, Users, Heart, MessageCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useNotificationSettingsStore } from '@/store/notification-settings-store';
import { useAuthStore } from '@/store/auth-store';
import { useCallback } from 'react';

export default function NotificationsSettingsScreen() {
  const { user } = useAuthStore();
  const {
    settings,
    isLoading,
    error,
    fetchSettings,
    updatePushNotifications,
    updateMessageNotifications,
    updateFollowNotifications,
    updateLikeNotifications,
    updateCommentNotifications,
    resetError,
  } = useNotificationSettingsStore();

  // 初期データの読み込み
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchSettings(user.id);
      }
    }, [user?.id, fetchSettings])
  );

  // エラーが発生した場合のアラート表示
  useEffect(() => {
    if (error) {
      Alert.alert(
        'エラー',
        error,
        [
          {
            text: 'OK',
            onPress: () => resetError(),
          },
        ]
      );
    }
  }, [error, resetError]);

  const handlePushNotificationsChange = async (value: boolean) => {
    await updatePushNotifications(value);
  };

  const handleMessageNotificationsChange = async (value: boolean) => {
    await updateMessageNotifications(value);
  };

  const handleFollowNotificationsChange = async (value: boolean) => {
    await updateFollowNotifications(value);
  };

  const handleLikeNotificationsChange = async (value: boolean) => {
    await updateLikeNotifications(value);
  };

  const handleCommentNotificationsChange = async (value: boolean) => {
    await updateCommentNotifications(value);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '通知設定',
          headerBackTitle: '戻る',
        }}
      />
      <SafeAreaView style={styles.container}>
        {isLoading && !settings ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>設定を読み込み中...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
          {/* 基本通知設定セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>基本設定</Text>
            
            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Bell size={20} color="#FF9500" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>プッシュ通知</Text>
                  <Text style={styles.settingSubtitle}>アプリからの通知を受け取る</Text>
                </View>
              </View>
              <Switch
                value={settings?.pushNotifications ?? true}
                onValueChange={handlePushNotificationsChange}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
                disabled={isLoading}
              />
            </View>
          </View>

          {/* アクティビティ通知セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>アクティビティ通知</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <MessageSquare size={20} color="#007AFF" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>メッセージ通知</Text>
                  <Text style={styles.settingSubtitle}>新しいメッセージやコメントを受け取ったとき</Text>
                </View>
              </View>
              <Switch
                value={settings?.messageNotifications ?? true}
                onValueChange={handleMessageNotificationsChange}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
                disabled={isLoading || !settings?.pushNotifications}
              />
            </View>


            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Heart size={20} color="#FF3B30" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>いいね通知</Text>
                  <Text style={styles.settingSubtitle}>あなたの投稿にいいねがついたとき</Text>
                </View>
              </View>
              <Switch
                value={settings?.likeNotifications ?? true}
                onValueChange={handleLikeNotificationsChange}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
                disabled={isLoading || !settings?.pushNotifications}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <MessageCircle size={20} color="#34C759" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>コメント通知</Text>
                  <Text style={styles.settingSubtitle}>あなたの投稿にコメントがついたとき</Text>
                </View>
              </View>
              <Switch
                value={settings?.commentNotifications ?? true}
                onValueChange={handleCommentNotificationsChange}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
                disabled={isLoading || !settings?.pushNotifications}
              />
            </View>

            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Users size={20} color="#5856D6" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>フォロー通知</Text>
                  <Text style={styles.settingSubtitle}>新しいフォロワーが増えたとき</Text>
                </View>
              </View>
              <Switch
                value={settings?.followNotifications ?? true}
                onValueChange={handleFollowNotificationsChange}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
                disabled={isLoading || !settings?.pushNotifications}
              />
            </View>
          </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingTexts: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTitle: {
    fontSize: 16,
    color: Colors.text.primary,
    flex: 1,
  },
  notice: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF3CD',
    borderRadius: 16,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6C5300',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
});