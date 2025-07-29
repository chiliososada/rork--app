import React from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Shield, FileText, ScrollText, Eye, MapPin, Bell, Flag, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function PrivacySettingsScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'プライバシー設定',
          headerBackTitle: '戻る',
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* クイックアクセスセクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>プライバシー関連設定</Text>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/settings/account')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Eye size={20} color="#007AFF" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>公開設定</Text>
                <Text style={styles.menuDescription}>プロフィール・フォロワーリストの表示設定</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/settings/location')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <MapPin size={20} color="#34C759" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>位置情報設定</Text>
                <Text style={styles.menuDescription}>位置情報の表示・履歴管理</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/settings/notifications')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Bell size={20} color="#FF9500" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>プライバシー通知</Text>
                <Text style={styles.menuDescription}>プライバシー関連の通知設定</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/settings/blocked-users')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Shield size={20} color="#FF3B30" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>ブロック中のユーザー</Text>
                <Text style={styles.menuDescription}>ブロックしたユーザーの管理</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/settings/reports')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Flag size={20} color="#5856D6" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>通報履歴</Text>
                <Text style={styles.menuDescription}>送信した通報の確認</Text>
              </View>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* 法的情報セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>法的情報</Text>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/legal/privacy-policy')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Shield size={20} color="#666666" />
              </View>
              <Text style={styles.menuTitle}>プライバシーポリシー</Text>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/legal/terms-of-service')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <FileText size={20} color="#666666" />
              </View>
              <Text style={styles.menuTitle}>利用規約</Text>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/legal/community-guidelines')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <ScrollText size={20} color="#666666" />
              </View>
              <Text style={styles.menuTitle}>コミュニティガイドライン</Text>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* 注意事項 */}
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>プライバシーについて</Text>
            <Text style={styles.noticeText}>
              TokyoParkは、ユーザーのプライバシーを重視しています。
              設定を変更することで、どの情報を他のユーザーと共有するかを管理できます。
              詳細については、プライバシーポリシーをご確認ください。
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
  menuDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  notice: {
    margin: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1565C0',
  },
});