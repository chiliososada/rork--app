import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Shield, AlertTriangle, FileText, Scale, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface LegalDisclaimerComponentProps {
  compact?: boolean; // 是否使用简化版本
}

export default function LegalDisclaimerComponent({ compact = false }: LegalDisclaimerComponentProps) {
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Shield size={20} color="#FF6B35" />
          <Text style={styles.compactTitle}>成人向けコンテンツ免責事項</Text>
        </View>
        <Text style={styles.compactText}>
          このサービスは18歳以上の成人の方のみご利用いただけます。成人向けコンテンツが含まれる可能性があります。
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ヘッダーセクション */}
      <View style={styles.header}>
        <Shield size={32} color="#FFFFFF" />
        <Text style={styles.headerTitle}>成人向けコンテンツ免責事項</Text>
        <Text style={styles.headerSubtitle}>Adult Content Disclaimer</Text>
      </View>

      <View style={styles.content}>
        {/* 概要セクション */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={24} color="#FF6B35" />
            <Text style={styles.sectionTitle}>重要な注意事項</Text>
          </View>
          <Text style={styles.paragraph}>
            このサービス（以下「本サービス」）は、18歳以上の成人ユーザーを対象としており、成人向けコンテンツが含まれる可能性があります。本免責事項は、ユーザーが本サービスを利用する際の重要な法的条件を定めています。
          </Text>
        </View>

        {/* 年齢制限セクション */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={24} color="#2E7D32" />
            <Text style={styles.sectionTitle}>年齢制限と確認</Text>
          </View>
          <View style={styles.bulletPoints}>
            <Text style={styles.bulletPoint}>• 本サービスは18歳以上の方のみご利用いただけます</Text>
            <Text style={styles.bulletPoint}>• 未成年者による利用は法的に禁止されています</Text>
            <Text style={styles.bulletPoint}>• 年齢の虚偽申告は利用規約違反となります</Text>
            <Text style={styles.bulletPoint}>• 保護者による適切な監督が必要です</Text>
          </View>
        </View>

        {/* コンテンツ警告セクション */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={24} color="#7B1FA2" />
            <Text style={styles.sectionTitle}>コンテンツに関する警告</Text>
          </View>
          <Text style={styles.paragraph}>
            本サービスで提供されるコンテンツには、以下のような成人向けの内容が含まれる可能性があります：
          </Text>
          <View style={styles.warningBox}>
            <Text style={styles.warningItem}>• 性的な表現、議論、画像</Text>
            <Text style={styles.warningItem}>• 成人向けの話題やテーマ</Text>
            <Text style={styles.warningItem}>• その他18歳未満には不適切とされる内容</Text>
            <Text style={styles.warningItem}>• 地域によっては違法とされる可能性のある内容</Text>
          </View>
        </View>

        {/* 法的責任セクション */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Scale size={24} color="#1976D2" />
            <Text style={styles.sectionTitle}>法的責任と免責</Text>
          </View>
          <Text style={styles.paragraph}>
            本サービスの利用により、ユーザーは以下の事項に同意し、責任を負うものとします：
          </Text>
          <View style={styles.legalList}>
            <Text style={styles.legalItem}>1. 地域の法律・規制の遵守</Text>
            <Text style={styles.legalItem}>2. コンテンツ閲覧による精神的影響への自己責任</Text>
            <Text style={styles.legalItem}>3. 第三者への適切な配慮と責任</Text>
            <Text style={styles.legalItem}>4. サービス利用による一切の結果への責任</Text>
          </View>
        </View>

        {/* 免責事項セクション */}
        <View style={styles.section}>
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerTitle}>重要な免責事項</Text>
            <Text style={styles.disclaimerText}>
              運営者は、本サービスで提供されるコンテンツの正確性、適切性、合法性について一切の保証を行わず、ユーザーの利用により生じた直接的・間接的損害について責任を負いません。ユーザーは自己の責任において本サービスを利用するものとします。
            </Text>
          </View>
        </View>

        {/* 地域法令セクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>地域法令の遵守</Text>
          <Text style={styles.paragraph}>
            ユーザーは、所在地の法律・規制に従って本サービスを利用する責任があります。特定の地域では成人向けコンテンツの閲覧や配信が制限される場合があります。
          </Text>
        </View>

        {/* 更新情報 */}
        <View style={styles.updateInfo}>
          <Text style={styles.updateText}>
            最終更新：2024年1月
          </Text>
          <Text style={styles.updateText}>
            本免責事項は予告なく変更される場合があります
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: '#FF6B35',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFE0D6',
    textAlign: 'center',
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
  paragraph: {
    fontSize: 16,
    color: Colors.text.secondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  bulletPoints: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  bulletPoint: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 24,
    marginBottom: 8,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  warningItem: {
    fontSize: 15,
    color: '#856404',
    lineHeight: 24,
    marginBottom: 6,
  },
  legalList: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
  },
  legalItem: {
    fontSize: 15,
    color: '#1976D2',
    lineHeight: 24,
    marginBottom: 8,
    fontWeight: '500',
  },
  disclaimerBox: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFCDD2',
  },
  disclaimerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 12,
    textAlign: 'center',
  },
  disclaimerText: {
    fontSize: 14,
    color: '#D32F2F',
    lineHeight: 22,
    textAlign: 'center',
  },
  updateInfo: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    alignItems: 'center',
  },
  updateText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  // Compact version styles
  compactContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginLeft: 8,
  },
  compactText: {
    fontSize: 14,
    color: '#BF360C',
    lineHeight: 20,
  },
});