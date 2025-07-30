import React from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function ParentalControlsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: '保護者向けガイド',
          headerBackTitle: '戻る',
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>保護者向けガイド</Text>
            <Text style={styles.subtitle}>
              未成年者の保護について
            </Text>
            <Text style={styles.lastUpdated}>最終更新日: 2025年1月30日</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>重要なお知らせ</Text>
            <Text style={styles.warningText}>
              本アプリは18歳以上の成人のみを対象としたサービスです。
              18歳未満の方はご利用いただけません。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. 年齢制限について</Text>
            <Text style={styles.paragraph}>
              TokyoParkは日本の法律に基づき、18歳以上の成人のみがご利用いただけるサービスです。
              アプリの利用登録時に年齢確認を行い、18歳未満の方の利用を防止しています。
            </Text>
            
            <Text style={styles.listTitle}>年齢確認の仕組み：</Text>
            <Text style={styles.listItem}>• 利用登録時の生年月日入力による年齢確認</Text>
            <Text style={styles.listItem}>• 18歳未満の場合、自動的に利用を制限</Text>
            <Text style={styles.listItem}>• 成人向けコンテンツであることの事前確認</Text>
            <Text style={styles.listItem}>• 利用規約への同意確認</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. 技術的制限措置</Text>
            <Text style={styles.paragraph}>
              本アプリでは以下の技術的措置により、未成年者の利用を防止しています：
            </Text>
            
            <Text style={styles.listItem}>• App Store/Google Playでの17+年齢制限設定</Text>
            <Text style={styles.listItem}>• アプリ内での年齢確認システム</Text>
            <Text style={styles.listItem}>• 不適切なコンテンツの自動フィルタリング</Text>
            <Text style={styles.listItem}>• ユーザー通報システムによる監視</Text>
            <Text style={styles.listItem}>• 利用規約違反者の利用停止措置</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. 保護者の皆様へのお願い</Text>
            <Text style={styles.paragraph}>
              お子様のデバイス利用について、以下の点にご注意ください:
            </Text>
            
            <Text style={styles.listItem}>• デバイスの年齢制限設定を適切に行ってください</Text>
            <Text style={styles.listItem}>• App Storeの機能制限を活用してください</Text>
            <Text style={styles.listItem}>• お子様のアプリ利用状況を定期的に確認してください</Text>
            <Text style={styles.listItem}>• 不適切なアプリの利用を発見した場合は、直ちに利用を停止してください</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. デバイス設定による制限方法</Text>
            
            <Text style={styles.subSectionTitle}>iOS（iPhone/iPad）の場合：</Text>
            <Text style={styles.listItem}>1. 設定 > スクリーンタイム > コンテンツとプライバシーの制限</Text>
            <Text style={styles.listItem}>2. iTunesおよびApp Storeでの購入 > アプリ > 17+ を許可しない</Text>
            <Text style={styles.listItem}>3. Webコンテンツ > 成人向けWebサイトを制限</Text>
            
            <Text style={styles.subSectionTitle}>Android端末の場合：</Text>
            <Text style={styles.listItem}>1. Google Play ストア > 設定 > 保護者による使用制限</Text>
            <Text style={styles.listItem}>2. アプリとゲーム > 成人向けを許可しない</Text>
            <Text style={styles.listItem}>3. ファミリーリンクアプリを利用した制限設定</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. 問題を発見した場合の対処法</Text>
            <Text style={styles.paragraph}>
              万が一、お子様が本アプリを利用していることを発見した場合：
            </Text>
            
            <Text style={styles.listItem}>• 直ちにアプリの利用を停止してください</Text>
            <Text style={styles.listItem}>• アプリをデバイスから削除してください</Text>
            <Text style={styles.listItem}>• デバイスの年齢制限設定を見直してください</Text>
            <Text style={styles.listItem}>• 必要に応じて当社までご連絡ください</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. お問い合わせ</Text>
            <Text style={styles.paragraph}>
              本アプリの年齢制限や未成年者保護に関するご質問・ご相談は、
              以下の連絡先までお気軽にお問い合わせください。
            </Text>
            
            <View style={styles.contactBox}>
              <Text style={styles.contactText}>
                メールアドレス: support@rork.com{'\n'}
                件名: 「保護者からのお問い合わせ」{'\n'}
                受付時間: 平日 9:00-18:00（土日祝日を除く）
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. 関連法令・ガイドライン</Text>
            <Text style={styles.paragraph}>
              本アプリは以下の法令・ガイドラインに準拠して運営されています：
            </Text>
            
            <Text style={styles.listItem}>• 青少年が安全に安心してインターネットを利用できる環境の整備等に関する法律</Text>
            <Text style={styles.listItem}>• 個人情報の保護に関する法律</Text>
            <Text style={styles.listItem}>• 電気通信事業法</Text>
            <Text style={styles.listItem}>• Apple App Store Review Guidelines</Text>
            <Text style={styles.listItem}>• Google Play Developer Policy</Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              本ガイドラインは、未成年者の健全な成長を守るため、
              保護者の皆様と協力して適切なインターネット利用環境を
              整備することを目的としています。
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
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 12,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFB74D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#E65100',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    marginTop: 12,
  },
  paragraph: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 22,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    marginTop: 8,
  },
  listItem: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 6,
    paddingLeft: 8,
  },
  contactBox: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  contactText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  footer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});