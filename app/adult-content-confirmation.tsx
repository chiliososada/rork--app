import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Shield, AlertTriangle, FileText, CheckSquare, Square, ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAdultContentStore } from '@/store/adult-content-store';
import Button from '@/components/Button';

export default function AdultContentConfirmationScreen() {
  const router = useRouter();
  const { confirmAdultContent } = useAdultContentStore();
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [acceptsRisks, setAcceptsRisks] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!hasReadTerms || !acceptsRisks) {
      Alert.alert(
        'エラー',
        'すべての項目を確認し、同意にチェックを入れてください。',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    
    try {
      // 記録確認状態
      confirmAdultContent('full_screen');
      
      // 延遲一下以顯示加載狀態
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 返回到主應用
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Confirmation error:', error);
      Alert.alert(
        'エラー',
        '確認処理中にエラーが発生しました。もう一度お試しください。',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      '確認',
      '本当にこのサービスを退出しますか？',
      [
        {
          text: 'キャンセル',
          style: 'cancel'
        },
        {
          text: '退出する',
          style: 'destructive',
          onPress: () => {
            // 在实际应用中，这里可能需要退出应用或返回到登录页面
            router.replace('/(auth)');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#1976D2" />
      
      <Stack.Screen
        options={{
          title: '成人向けコンテンツ確認',
          headerStyle: {
            backgroundColor: '#1976D2',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 警告ヘッダー */}
        <View style={styles.warningHeader}>
          <Shield size={48} color="#FFFFFF" />
          <Text style={styles.warningTitle}>成人向けコンテンツの確認</Text>
          <Text style={styles.warningSubtitle}>
            このサービスをご利用いただく前に、重要な確認事項があります
          </Text>
        </View>

        {/* メインコンテンツ */}
        <View style={styles.content}>
          {/* 年齢確認セクション */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AlertTriangle size={24} color="#FF6B35" />
              <Text style={styles.sectionTitle}>年齢制限について</Text>
            </View>
            <Text style={styles.sectionText}>
              このサービスは18歳以上の成人の方のみご利用いただけます。未成年者の利用は固く禁じられています。
            </Text>
            <View style={styles.warningBox}>
              <Text style={styles.warningBoxText}>
                虚偽の年齢申告は利用規約違反となり、アカウントの永久停止の対象となります。
              </Text>
            </View>
          </View>

          {/* コンテンツ警告セクション */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FileText size={24} color="#7B1FA2" />
              <Text style={styles.sectionTitle}>コンテンツに関する警告</Text>
            </View>
            <Text style={styles.sectionText}>
              このサービスには以下のような成人向けコンテンツが含まれる可能性があります：
            </Text>
            <View style={styles.contentWarningList}>
              <Text style={styles.listItem}>• 性的な表現や議論</Text>
              <Text style={styles.listItem}>• 成人向けの話題や画像</Text>
              <Text style={styles.listItem}>• その他18歳未満には不適切な内容</Text>
            </View>
          </View>

          {/* 法的責任セクション */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Shield size={24} color="#2E7D32" />
              <Text style={styles.sectionTitle}>法的責任と免責事項</Text>
            </View>
            <Text style={styles.sectionText}>
              このサービスを利用することで、あなたは以下に同意したものとみなされます：
            </Text>
            <View style={styles.legalList}>
              <Text style={styles.listItem}>• 18歳以上であることの確認</Text>
              <Text style={styles.listItem}>• 成人向けコンテンツの閲覧への同意</Text>
              <Text style={styles.listItem}>• サービス利用による責任の受諾</Text>
              <Text style={styles.listItem}>• 地域の法律・規制の遵守</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.legalLink}
              onPress={() => router.push('/legal/adult-content-disclaimer')}
              activeOpacity={0.7}
            >
              <ExternalLink size={16} color="#1976D2" />
              <Text style={styles.legalLinkText}>詳細な免責事項を確認する</Text>
            </TouchableOpacity>
          </View>

          {/* 確認チェックボックス */}
          <View style={styles.checkboxSection}>
            <TouchableOpacity 
              style={styles.checkboxItem}
              onPress={() => setHasReadTerms(!hasReadTerms)}
              activeOpacity={0.7}
            >
              {hasReadTerms ? (
                <CheckSquare size={24} color="#1976D2" />
              ) : (
                <Square size={24} color={Colors.text.secondary} />
              )}
              <Text style={styles.checkboxText}>
                私は上記の内容を読み、理解しました
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.checkboxItem}
              onPress={() => setAcceptsRisks(!acceptsRisks)}
              activeOpacity={0.7}
            >
              {acceptsRisks ? (
                <CheckSquare size={24} color="#1976D2" />
              ) : (
                <Square size={24} color={Colors.text.secondary} />
              )}
              <Text style={styles.checkboxText}>
                私は18歳以上であり、成人向けコンテンツの閲覧に同意します
              </Text>
            </TouchableOpacity>
          </View>

          {/* ボタンセクション */}
          <View style={styles.buttonSection}>
            <Button
              title="同意してサービスを利用する"
              onPress={handleConfirm}
              isLoading={isLoading}
              style={(!hasReadTerms || !acceptsRisks) 
                ? {...styles.confirmButton, ...styles.confirmButtonDisabled}
                : styles.confirmButton
              }
              disabled={!hasReadTerms || !acceptsRisks}
            />
            
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              activeOpacity={0.7}
            >
              <Text style={styles.declineButtonText}>サービスを退出する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  scrollContent: {
    paddingBottom: 32,
  },
  warningHeader: {
    backgroundColor: '#1976D2',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  warningSubtitle: {
    fontSize: 16,
    color: '#E3F2FD',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  sectionText: {
    fontSize: 16,
    color: Colors.text.secondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  warningBoxText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
    lineHeight: 20,
  },
  contentWarningList: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  legalList: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  listItem: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 24,
    marginBottom: 4,
  },
  legalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  legalLinkText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600',
    marginLeft: 8,
  },
  checkboxSection: {
    marginBottom: 32,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  checkboxText: {
    fontSize: 16,
    color: Colors.text.primary,
    lineHeight: 24,
    marginLeft: 12,
    flex: 1,
  },
  buttonSection: {
    marginTop: 16,
  },
  confirmButton: {
    backgroundColor: '#1976D2',
    marginBottom: 16,
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.text.secondary,
    opacity: 0.6,
  },
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
});