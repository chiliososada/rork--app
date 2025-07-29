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
import { MapPin, Eye, Settings, Navigation, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function LocationSettingsScreen() {
  // 位置情報設定の状態
  const [locationVisible, setLocationVisible] = useState(true);
  const [preciseLocation, setPreciseLocation] = useState(false);
  const [locationHistory, setLocationHistory] = useState(true);
  const [nearbyNotifications, setNearbyNotifications] = useState(true);

  const handleLocationPermission = () => {
    Alert.alert(
      '位置情報許可',
      'この設定を変更するには、端末の設定画面で位置情報の許可を変更してください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定を開く', onPress: () => {} }
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      '位置情報履歴の削除',
      '過去の位置情報履歴をすべて削除しますか？この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除する', 
          style: 'destructive',
          onPress: () => {
            // 位置情報履歴削除の処理
            Alert.alert('完了', '位置情報履歴を削除しました。');
          }
        }
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '位置情報設定',
          headerBackTitle: '戻る',
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* 基本設定セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>表示設定</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Eye size={20} color="#34C759" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>位置情報の表示</Text>
                  <Text style={styles.settingSubtitle}>他のユーザーに位置情報を表示する</Text>
                </View>
              </View>
              <Switch
                value={locationVisible}
                onValueChange={setLocationVisible}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <Navigation size={20} color="#007AFF" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>高精度位置情報</Text>
                  <Text style={styles.settingSubtitle}>より正確な位置情報を使用する</Text>
                </View>
              </View>
              <Switch
                value={preciseLocation}
                onValueChange={setPreciseLocation}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* 履歴・データ管理セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>データ管理</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <MapPin size={20} color="#5856D6" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>位置情報履歴の保存</Text>
                  <Text style={styles.settingSubtitle}>投稿履歴とともに位置情報を保存する</Text>
                </View>
              </View>
              <Switch
                value={locationHistory}
                onValueChange={setLocationHistory}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={handleClearHistory}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <MapPin size={20} color="#FF3B30" />
              </View>
              <Text style={[styles.menuTitle, { color: '#FF3B30' }]}>位置情報履歴を削除</Text>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* 通知設定セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>位置ベースの通知</Text>
            
            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.settingContent}>
                <View style={styles.settingIcon}>
                  <MapPin size={20} color="#FF9500" />
                </View>
                <View style={styles.settingTexts}>
                  <Text style={styles.settingTitle}>近くの話題通知</Text>
                  <Text style={styles.settingSubtitle}>近くで新しい話題が投稿されたときに通知</Text>
                </View>
              </View>
              <Switch
                value={nearbyNotifications}
                onValueChange={setNearbyNotifications}
                trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* システム設定セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>システム設定</Text>
            
            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={handleLocationPermission}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Settings size={20} color="#666666" />
              </View>
              <Text style={styles.menuTitle}>端末の位置情報設定</Text>
              <ChevronRight size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* 注意事項 */}
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>位置情報について</Text>
            <Text style={styles.noticeText}>
              TokyoParkは位置情報を基にした話題の発見と共有を提供しています。
              位置情報の表示をオフにしても、アプリの基本機能は利用できますが、
              一部の機能が制限される場合があります。
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
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#388E3C',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#2E7D32',
  },
});