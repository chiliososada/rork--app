import React, { useState, useEffect } from 'react';
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
import { Stack, useRouter } from 'expo-router';
import { User, Eye, Users, Download, Trash2, Lock, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  // アカウント設定の状態
  const [profileVisible, setProfileVisible] = useState(user?.isProfilePublic ?? true);
  const [followersVisible, setFollowersVisible] = useState(user?.isFollowersVisible ?? true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // ユーザー情報が更新されたら設定を同期
  useEffect(() => {
    if (user) {
      setProfileVisible(user.isProfilePublic ?? true);
      setFollowersVisible(user.isFollowersVisible ?? true);
    }
  }, [user]);
  
  // プライバシー設定を更新する関数
  const updatePrivacySettings = async (isProfilePublic: boolean, isFollowersVisible: boolean) => {
    if (!user) {
      return;
    }
    
    setIsUpdating(true);
    try {
      const { data, error } = await supabase
        .rpc('update_user_privacy_settings', {
          user_id_param: user.id,
          is_profile_public_param: isProfilePublic,
          is_followers_visible_param: isFollowersVisible
        });
      
      if (error) throw error;
      
      if (data && data.length > 0 && data[0].success) {
        Alert.alert('成功', 'プライバシー設定を更新しました');
      } else {
        const message = data?.[0]?.message || 'プライバシー設定の更新に失敗しました';
        Alert.alert('エラー', message);
      }
    } catch (error) {
      Alert.alert('エラー', 'プライバシー設定の更新に失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleProfileVisibilityChange = (value: boolean) => {
    setProfileVisible(value);
    if (user) {
      updatePrivacySettings(value, followersVisible);
    }
  };
  
  const handleFollowersVisibilityChange = (value: boolean) => {
    setFollowersVisible(value);
    if (user) {
      updatePrivacySettings(profileVisible, value);
    }
  };

  const handleEditProfile = () => {
    // プロフィール編集画面への遷移
    router.push('/settings/profile-edit');
  };

  const handleChangePassword = () => {
    // パスワード変更画面への遷移
    router.push('/settings/password-change');
  };


  const handleDownloadData = () => {
    Alert.alert(
      '個人データのダウンロード',
      'あなたのアカウントに関連するデータをダウンロードします。準備ができ次第、メールでお知らせします。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: 'ダウンロード開始',
          onPress: () => {
            Alert.alert('受付完了', 'データの準備が完了次第、メールでお知らせします。');
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'アカウント削除',
      'この操作は取り消せません。アカウントを削除すると、すべての投稿、メッセージ、フォロー情報が完全に削除されます。本当に削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '最終確認',
              'アカウント削除を実行するには、パスワードの入力が必要です。',
              [
                { text: 'キャンセル', style: 'cancel' },
                { text: '続行', onPress: () => {
                  // パスワード入力画面への遷移
                  Alert.alert('開発中', 'アカウント削除機能は開発中です。');
                }}
              ]
            );
          }
        }
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'アカウント設定',
          headerBackTitle: '戻る',
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* アカウント情報セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>アカウント情報</Text>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleEditProfile}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <User size={20} color="#007AFF" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>プロフィール編集</Text>
                <Text style={styles.menuSubtitle}>{user?.name || 'ユーザー名'}</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={handleChangePassword}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Lock size={20} color="#FF9500" />
              </View>
              <Text style={styles.menuTitle}>パスワード変更</Text>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* プライバシー設定セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>公開設定 {(!user || !user.id) && '(読み込み中...)'}</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Eye size={20} color="#007AFF" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>プロフィールの公開</Text>
                  <Text style={styles.settingSubtitle}>プロフィール情報を他のユーザーに表示する</Text>
                </View>
              </View>
              <Switch
                value={profileVisible}
                onValueChange={handleProfileVisibilityChange}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
                disabled={isUpdating || !user || !user.id}
              />
            </View>

            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Users size={20} color="#5856D6" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>フォロワーリストの表示</Text>
                  <Text style={styles.settingSubtitle}>フォロワー・フォロー中リストを公開する</Text>
                </View>
              </View>
              <Switch
                value={followersVisible}
                onValueChange={handleFollowersVisibilityChange}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
                disabled={isUpdating || !user || !user.id}
              />
            </View>
          </View>

          {/* データ管理セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>データ管理</Text>
            
            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={handleDownloadData}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Download size={20} color="#34C759" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>個人データのダウンロード</Text>
                <Text style={styles.menuSubtitle}>投稿、メッセージ、アカウント情報をダウンロード</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* 危険な操作セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>危険な操作</Text>
            
            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#FFEBEE' }]}>
                <Trash2 size={20} color="#F44336" />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, { color: '#F44336' }]}>アカウント削除</Text>
                <Text style={styles.menuSubtitle}>すべてのデータが完全に削除されます</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* 注意事項 */}
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>アカウント管理について</Text>
            <Text style={styles.noticeText}>
              アカウント情報の変更は慎重に行ってください。
              特にメールアドレスの変更は、パスワードリセットなどの重要な機能に影響します。
              アカウント削除は完全に取り消せない操作です。
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
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  notice: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 16,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#B71C1C',
  },
});