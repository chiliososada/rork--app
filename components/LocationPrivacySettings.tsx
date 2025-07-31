import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocationStore } from '@/store/location-store';
import { LocationPrivacySettings } from '@/lib/secure-location';

interface LocationPrivacySettingsProps {
  onClose?: () => void;
}

export const LocationPrivacySettingsComponent: React.FC<LocationPrivacySettingsProps> = ({
  onClose
}) => {
  const { privacySettings, updatePrivacySettings, clearLocationCache } = useLocationStore();
  const [settings, setSettings] = useState<LocationPrivacySettings>(privacySettings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setSettings(privacySettings);
  }, [privacySettings]);

  const handleSettingChange = (key: keyof LocationPrivacySettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updatePrivacySettings(settings);
      setHasChanges(false);
      Alert.alert('保存完了', 'プライバシー設定が保存されました。');
    } catch (error) {
      Alert.alert('エラー', '設定の保存に失敗しました。');
    }
  };

  const handleReset = () => {
    Alert.alert(
      '設定をリセット',
      'プライバシー設定をデフォルトに戻しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセット',
          style: 'destructive',
          onPress: () => {
            const defaultSettings: LocationPrivacySettings = {
              enableFuzzing: true,
              fuzzingRadius: 200,
              shareExactLocation: false,
              allowLocationSharing: true
            };
            setSettings(defaultSettings);
            setHasChanges(true);
          }
        }
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'キャッシュをクリア',
      '位置情報のキャッシュをクリアしますか？次回位置取得時に新しい位置が取得されます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'クリア',
          onPress: () => {
            clearLocationCache();
            Alert.alert('完了', 'キャッシュがクリアされました。');
          }
        }
      ]
    );
  };

  const getFuzzingRadiusDescription = (radius: number) => {
    if (radius <= 50) return '非常に正確（50m以内）';
    if (radius <= 100) return '正確（100m以内）';
    if (radius <= 200) return '標準（200m以内）';
    if (radius <= 300) return 'やや曖昧（300m以内）';
    if (radius <= 500) return '曖昧（500m以内）';
    return '非常に曖昧（500m超）';
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-800">
            位置情報プライバシー設定
          </Text>
          {onClose && (
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* 位置情報共有の有効/無効 */}
        <View className="bg-gray-50 p-4 rounded-lg mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-800">
                位置情報の共有
              </Text>
              <Text className="text-sm text-gray-600 mt-1">
                アプリでの位置情報機能を有効にします
              </Text>
            </View>
            <Switch
              value={settings.allowLocationSharing}
              onValueChange={(value) => handleSettingChange('allowLocationSharing', value)}
              trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
              thumbColor={settings.allowLocationSharing ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
        </View>

        {settings.allowLocationSharing && (
          <>
            {/* 位置情報ファジング */}
            <View className="bg-gray-50 p-4 rounded-lg mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-gray-800">
                    位置情報のプライバシー保護
                  </Text>
                  <Text className="text-sm text-gray-600 mt-1">
                    正確な位置を隠してプライバシーを保護します
                  </Text>
                </View>
                <Switch
                  value={settings.enableFuzzing}
                  onValueChange={(value) => handleSettingChange('enableFuzzing', value)}
                  trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
                  thumbColor={settings.enableFuzzing ? '#FFFFFF' : '#9CA3AF'}
                />
              </View>
            </View>

            {/* ファジング範囲設定 */}
            {settings.enableFuzzing && (
              <View className="bg-gray-50 p-4 rounded-lg mb-4">
                <Text className="text-lg font-semibold text-gray-800 mb-2">
                  プライバシー保護レベル
                </Text>
                <Text className="text-sm text-gray-600 mb-4">
                  {getFuzzingRadiusDescription(settings.fuzzingRadius)}
                </Text>
                
                <View className="flex-row justify-between mt-2">
                  {[50, 100, 200, 300, 500].map((radius) => (
                    <TouchableOpacity
                      key={radius}
                      onPress={() => handleSettingChange('fuzzingRadius', radius)}
                      className={`px-3 py-2 rounded-lg ${
                        settings.fuzzingRadius === radius 
                          ? 'bg-blue-500' 
                          : 'bg-gray-200'
                      }`}
                    >
                      <Text className={`text-xs ${
                        settings.fuzzingRadius === radius 
                          ? 'text-white font-semibold' 
                          : 'text-gray-700'
                      }`}>
                        {radius}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 正確な位置情報の共有 */}
            <View className="bg-yellow-50 p-4 rounded-lg mb-4 border border-yellow-200">
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-yellow-800">
                    正確な位置情報の共有
                  </Text>
                  <Text className="text-sm text-yellow-700 mt-1">
                    ⚠️ 特定の機能で正確な位置が必要な場合のみ有効にしてください
                  </Text>
                </View>
                <Switch
                  value={settings.shareExactLocation}
                  onValueChange={(value) => handleSettingChange('shareExactLocation', value)}
                  trackColor={{ false: '#FDE68A', true: '#F59E0B' }}
                  thumbColor={settings.shareExactLocation ? '#FFFFFF' : '#FCD34D'}
                />
              </View>
            </View>
          </>
        )}

        {/* プライバシー情報 */}
        <View className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
          <View className="flex-row items-start mb-2">
            <Ionicons name="information-circle" size={20} color="#3B82F6" className="mr-2" />
            <Text className="text-sm font-semibold text-blue-800 flex-1">
              プライバシーについて
            </Text>
          </View>
          <Text className="text-sm text-blue-700 leading-5">
            • 位置情報は暗号化されて安全に保管されます{'\n'}
            • プライバシー保護により、他のユーザーに正確な位置は表示されません{'\n'}
            • いつでも設定を変更できます{'\n'}
            • 位置情報の共有を無効にすると、近くの話題を見つけることができなくなります
          </Text>
        </View>

        {/* アクションボタン */}
        <View className="space-y-3">
          {hasChanges && (
            <TouchableOpacity
              className="bg-blue-600 py-4 px-6 rounded-lg"
              onPress={handleSave}
            >
              <Text className="text-white text-center font-semibold text-lg">
                設定を保存
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="bg-gray-200 py-3 px-6 rounded-lg"
            onPress={handleClearCache}
          >
            <Text className="text-gray-700 text-center font-medium">
              位置キャッシュをクリア
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-red-100 py-3 px-6 rounded-lg"
            onPress={handleReset}
          >
            <Text className="text-red-700 text-center font-medium">
              設定をリセット
            </Text>
          </TouchableOpacity>
        </View>

        {/* デバッグ情報（開発環境のみ） */}
        {__DEV__ && (
          <View className="mt-8 p-4 bg-gray-100 rounded-lg">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              デバッグ情報
            </Text>
            <Text className="text-xs text-gray-600 font-mono">
              ファジング: {settings.enableFuzzing ? 'ON' : 'OFF'}{'\n'}
              範囲: {settings.fuzzingRadius}m{'\n'}
              正確な位置: {settings.shareExactLocation ? 'ON' : 'OFF'}{'\n'}
              位置共有: {settings.allowLocationSharing ? 'ON' : 'OFF'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};