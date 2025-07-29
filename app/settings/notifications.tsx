import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Bell, MessageSquare, Heart, Users, Shield, Settings, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function NotificationsSettingsScreen() {
  // 通知設定の状態
  const [pushNotifications, setPushNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [likeNotifications, setLikeNotifications] = useState(true);
  const [followNotifications, setFollowNotifications] = useState(true);
  const [topicNotifications, setTopicNotifications] = useState(true);
  const [privacyNotifications, setPrivacyNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [quietHours, setQuietHours] = useState(false);

  const handleSystemSettings = () => {
    Alert.alert(
      'システム通知設定',
      'この設定を変更するには、端末の設定画面で通知の許可を変更してください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定を開く', onPress: () => {} }
      ]
    );
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* 基本通知設定セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>基本設定</Text>
            
            <View style={styles.settingItem}>
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
                value={pushNotifications}
                onValueChange={setPushNotifications}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={handleSystemSettings}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Settings size={20} color="#666666" />
              </View>
              <Text style={styles.menuTitle}>端末の通知設定</Text>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
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
                value={messageNotifications}
                onValueChange={setMessageNotifications}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Heart size={20} color="#FF3B30" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>いいね通知</Text>
                  <Text style={styles.settingSubtitle}>投稿にいいねされたとき</Text>
                </View>
              </View>
              <Switch
                value={likeNotifications}
                onValueChange={setLikeNotifications}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
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
                value={followNotifications}
                onValueChange={setFollowNotifications}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <MessageSquare size={20} color="#34C759" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>話題通知</Text>
                  <Text style={styles.settingSubtitle}>参加中の話題に新しいコメントがついたとき</Text>
                </View>
              </View>
              <Switch
                value={topicNotifications}
                onValueChange={setTopicNotifications}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* プライバシー・システム通知セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>システム通知</Text>
            
            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Shield size={20} color="#5856D6" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>プライバシー通知</Text>
                  <Text style={styles.settingSubtitle}>プライバシーポリシーの更新や重要なお知らせ</Text>
                </View>
              </View>
              <Switch
                value={privacyNotifications}
                onValueChange={setPrivacyNotifications}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* 通知スタイル設定セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>通知スタイル</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Bell size={20} color="#FF9500" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>通知音</Text>
                  <Text style={styles.settingSubtitle}>通知時に音を鳴らす</Text>
                </View>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Bell size={20} color="#FF9500" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>バイブレーション</Text>
                  <Text style={styles.settingSubtitle}>通知時に振動させる</Text>
                </View>
              </View>
              <Switch
                value={vibrationEnabled}
                onValueChange={setVibrationEnabled}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Bell size={20} color="#666666" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>おやすみモード</Text>
                  <Text style={styles.settingSubtitle}>22:00〜8:00の間は通知を無効にする</Text>
                </View>
              </View>
              <Switch
                value={quietHours}
                onValueChange={setQuietHours}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* 注意事項 */}
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>通知について</Text>
            <Text style={styles.noticeText}>
              重要な情報を見逃さないよう、適切な通知設定を行ってください。
              プライバシー通知は、アカウントのセキュリティに関わる重要な情報のため、
              オフにすることはお勧めしません。
            </Text>
          </View>
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
});