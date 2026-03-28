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
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { MapPin, Eye, ChevronRight, Shield, Navigation } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocationSettingsStore, LocationPrecision, getLocationPrecisionLabel } from '@/store/location-settings-store';
import { useAuthStore } from '@/store/auth-store';

export default function LocationSettingsScreen() {
  const { user } = useAuthStore();
  const { 
    isLocationVisible,
    saveLocationHistory,
    locationPrecision,
    isLoading,
    error,
    loadSettings,
    updateSettings,
    clearLocationHistory
  } = useLocationSettingsStore();
  
  const [localSettings, setLocalSettings] = useState({
    isLocationVisible,
    saveLocationHistory,
    locationPrecision,
  });

  // 設定を読み込む
  useEffect(() => {
    if (user?.id) {
      loadSettings(user.id);
    }
  }, [user?.id]);

  // ストアの値が更新されたらローカル状態も更新
  useEffect(() => {
    setLocalSettings({
      isLocationVisible,
      saveLocationHistory,
      locationPrecision,
    });
  }, [isLocationVisible, saveLocationHistory, locationPrecision]);


  const handleLocationVisibleToggle = async (value: boolean) => {
    if (!user?.id) return;
    
    // 位置情報を非表示にする場合は確認ダイアログを表示
    if (!value) {
      Alert.alert(
        '位置情報を非表示にしますか？',
        'オフにすると、あなたのトピックが「近くのトピック」検索に表示されなくなります。\n\n「探索」や「タグ検索」では引き続き表示されます。',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '非表示にする',
            onPress: async () => {
              await updateLocationVisibility(value);
            }
          }
        ]
      );
    } else {
      await updateLocationVisibility(value);
    }
  };

  const updateLocationVisibility = async (value: boolean) => {
    if (!user?.id) return;
    
    setLocalSettings(prev => ({ ...prev, isLocationVisible: value }));
    
    try {
      await updateSettings({ isLocationVisible: value }, user.id);
    } catch (error) {
      // エラー時は元に戻す
      setLocalSettings(prev => ({ ...prev, isLocationVisible: !value }));
      Alert.alert('エラー', '設定の更新に失敗しました');
    }
  };

  const handleLocationHistoryToggle = async (value: boolean) => {
    if (!user?.id) return;
    
    setLocalSettings(prev => ({ ...prev, saveLocationHistory: value }));
    
    try {
      await updateSettings({ saveLocationHistory: value }, user.id);
    } catch (error) {
      // エラー時は元に戻す
      setLocalSettings(prev => ({ ...prev, saveLocationHistory: !value }));
      Alert.alert('エラー', '設定の更新に失敗しました');
    }
  };

  const handlePrecisionChange = (precision: LocationPrecision) => {
    if (!user?.id) return;
    
    Alert.alert(
      '位置情報の精度変更',
      `位置情報の精度を「${getLocationPrecisionLabel(precision)}」に変更しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '変更する',
          onPress: async () => {
            try {
              await updateSettings({ locationPrecision: precision }, user.id);
            } catch (error) {
              Alert.alert('エラー', '設定の更新に失敗しました');
            }
          }
        }
      ]
    );
  };

  const handleClearHistory = () => {
    if (!user?.id) return;
    
    Alert.alert(
      '位置情報履歴の削除',
      '過去の位置情報履歴をすべて削除しますか？この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除する', 
          style: 'destructive',
          onPress: async () => {
            const result = await clearLocationHistory(user.id);
            if (result.success) {
              Alert.alert('完了', `${result.deletedCount}件の位置情報履歴を削除しました。`);
            } else {
              Alert.alert('エラー', '位置情報履歴の削除に失敗しました。');
            }
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
        {isLoading && !localSettings.isLocationVisible ? (
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
                    <Text style={styles.settingSubtitle}>オフにすると、あなたのトピックが「近くのトピック」検索に表示されません</Text>
                  </View>
                </View>
                <Switch
                  value={localSettings.isLocationVisible}
                  onValueChange={handleLocationVisibleToggle}
                  trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                  thumbColor="#FFFFFF"
                  disabled={isLoading}
                />
              </View>

              {/* 位置情報の精度設定 */}
              {localSettings.isLocationVisible && (
                <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
                  <View style={styles.settingContent}>
                    <View style={styles.settingIcon}>
                      <Navigation size={20} color="#007AFF" />
                    </View>
                    <View style={styles.settingTexts}>
                      <Text style={styles.settingTitle}>位置情報の精度</Text>
                      <Text style={styles.settingSubtitle}>
                        現在: {getLocationPrecisionLabel(localSettings.locationPrecision)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.precisionButton}
                    onPress={() => {
                      Alert.alert(
                        '位置情報の精度',
                        '表示する位置情報の精度を選択してください',
                        [
                          {
                            text: '正確な位置',
                            onPress: () => handlePrecisionChange('exact')
                          },
                          {
                            text: 'エリアレベル（約1km）',
                            onPress: () => handlePrecisionChange('area')
                          },
                          {
                            text: '市レベル（約10km）',
                            onPress: () => handlePrecisionChange('city')
                          },
                          {
                            text: 'キャンセル',
                            style: 'cancel'
                          }
                        ]
                      );
                    }}
                    activeOpacity={0.7}
                    disabled={isLoading}
                  >
                    <Text style={styles.precisionButtonText}>変更</Text>
                  </TouchableOpacity>
                </View>
              )}
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
                  value={localSettings.saveLocationHistory}
                  onValueChange={handleLocationHistoryToggle}
                  trackColor={{ false: '#E5E5E5', true: Colors.primary }}
                  thumbColor="#FFFFFF"
                  disabled={isLoading}
                />
              </View>

              <TouchableOpacity 
                style={[styles.menuItem, { borderBottomWidth: 0 }]}
                onPress={handleClearHistory}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <View style={styles.menuIcon}>
                  <MapPin size={20} color="#FF3B30" />
                </View>
                <Text style={[styles.menuTitle, { color: '#FF3B30' }]}>位置情報履歴を削除</Text>
                <ChevronRight size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>


            {/* 位置情報表示の詳細説明 */}
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>位置情報表示について</Text>
              <Text style={styles.noticeText}>
                <Text style={styles.boldText}>オン（表示）の場合：</Text>{'\n'}
                • あなたのトピックが「近くのトピック」に表示されます{'\n'}
                • 他のユーザーが位置検索であなたのトピックを発見できます{'\n'}
                • より多くの人との交流機会があります{'\n\n'}
                
                <Text style={styles.boldText}>オフ（非表示）の場合：</Text>{'\n'}
                • あなたのトピックは「近くのトピック」に表示されません{'\n'}
                • 「探索」や「タグ検索」では引き続き表示されます{'\n'}
                • プライバシーを重視したい方におすすめです
              </Text>
            </View>

            {/* 精度設定の説明 */}
            {localSettings.isLocationVisible && (
              <View style={[styles.notice, { backgroundColor: '#E3F2FD' }]}>
                <Text style={[styles.noticeTitle, { color: '#1565C0' }]}>位置情報の精度について</Text>
                <Text style={[styles.noticeText, { color: '#0D47A1' }]}>
                  • 正確な位置: 詳細な位置情報を表示{'\n'}
                  • エリアレベル: 約1km四方の精度で表示{'\n'}
                  • 市レベル: 約10km四方の精度で表示
                </Text>
              </View>
            )}
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
  boldText: {
    fontWeight: '600',
    color: '#1B5E20',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  precisionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  precisionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});