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

export default function AdultContentDisclaimerScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: '成人向けコンテンツに関する免責事項',
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
            <Text style={styles.title}>成人向けコンテンツに関する免責事項</Text>
            <Text style={styles.lastUpdated}>最終更新日: 2025年1月30日</Text>
          </View>

          <View style={styles.warning}>
            <Text style={styles.warningTitle}>⚠️ 重要な免責事項</Text>
            <Text style={styles.warningText}>
              本サービスは18歳以上の成人向けサービスです。
              成人向けコンテンツが含まれる可能性があることを十分にご理解いただいた上でご利用ください。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. 成人向けコンテンツの定義</Text>
            <Text style={styles.paragraph}>
              本サービスにおける「成人向けコンテンツ」とは、以下のような内容を含むものを指します：
            </Text>
            <Text style={styles.listItem}>• 性的な内容を含む画像、動画、テキスト</Text>
            <Text style={styles.listItem}>• 成人の恋愛関係や出会いに関する情報</Text>
            <Text style={styles.listItem}>• アルコールに関する投稿やディスカッション</Text>
            <Text style={styles.listItem}>• その他、18歳未満の利用に適さないと判断される内容</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. ユーザーの責任と同意</Text>
            <Text style={styles.paragraph}>
              本サービスをご利用いただくことにより、ユーザーは以下について同意したものとみなされます：
            </Text>
            <Text style={styles.responsibility}>• 18歳以上であることの表明と保証</Text>
            <Text style={styles.responsibility}>• 成人向けコンテンツの閲覧に対する法的責任の自己負担</Text>
            <Text style={styles.responsibility}>• 地域の法律および規制の遵守</Text>
            <Text style={styles.responsibility}>• 不適切と感じるコンテンツに対する適切な対応</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. コンテンツモデレーション</Text>
            <Text style={styles.paragraph}>
              当社は適切なコンテンツ環境の維持に努めていますが、以下の点にご注意ください：
            </Text>
            <Text style={styles.listItem}>• 全てのコンテンツの事前審査は技術的に困難です</Text>
            <Text style={styles.listItem}>• ユーザー投稿コンテンツについては投稿者が責任を負います</Text>
            <Text style={styles.listItem}>• 不適切なコンテンツを発見した場合は報告機能をご利用ください</Text>
            <Text style={styles.listItem}>• 24時間以内に報告内容を確認し、適切な措置を講じます</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. 免責事項</Text>
            <Text style={styles.disclaimer}>
              当社は、本サービス内の成人向けコンテンツに関して、以下について一切の責任を負いません：
            </Text>
            <Text style={styles.disclaimerItem}>• コンテンツの正確性、適法性、道徳性</Text>
            <Text style={styles.disclaimerItem}>• ユーザーが受ける精神的、感情的な影響</Text>
            <Text style={styles.disclaimerItem}>• 第三者との間で生じるトラブルや紛争</Text>
            <Text style={styles.disclaimerItem}>• 地域の法令違反による法的責任</Text>
            <Text style={styles.disclaimerItem}>• コンテンツ閲覧による一切の損害</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. 不適切なコンテンツの報告</Text>
            <Text style={styles.paragraph}>
              以下のようなコンテンツを発見した場合は、速やかに報告してください：
            </Text>
            <Text style={styles.reportItem}>🚫 違法な内容（児童ポルノ、違法薬物等）</Text>
            <Text style={styles.reportItem}>🚫 過度に暴力的または差別的な内容</Text>
            <Text style={styles.reportItem}>🚫 非同意で撮影・公開された画像や動画</Text>
            <Text style={styles.reportItem}>🚫 著作権を侵害する内容</Text>
            <Text style={styles.reportItem}>🚫 その他、コミュニティガイドラインに違反する内容</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. 年齢確認システム</Text>
            <Text style={styles.paragraph}>
              当社は以下の方法で年齢確認を実施しています：
            </Text>
            <Text style={styles.listItem}>• 登録時の生年月日による年齢計算</Text>
            <Text style={styles.listItem}>• 継続的な監視による年齢詐称の検知</Text>
            <Text style={styles.listItem}>• 18歳未満と判明した場合の即座のアカウント停止</Text>
            <Text style={styles.paragraph}>
              年齢を偽って登録した場合、アカウント停止および法的措置の対象となる可能性があります。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. 地域による制限</Text>
            <Text style={styles.paragraph}>
              成人向けコンテンツに関する法律は地域により異なります：
            </Text>
            <Text style={styles.listItem}>• ご利用地域の法律を遵守してください</Text>
            <Text style={styles.listItem}>• 法的に制限がある地域からのアクセスは推奨しません</Text>
            <Text style={styles.listItem}>• 国際的な移動時は現地の法律にご注意ください</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. 保護者の方へ</Text>
            <Text style={styles.parentalNotice}>
              本サービスは18歳以上専用です。お子様のデバイスからアクセスできないよう、
              適切なペアレンタルコントロールの設定をお願いいたします。
            </Text>
          </View>

          <View style={styles.contact}>
            <Text style={styles.contactTitle}>お問い合わせ・報告</Text>
            <Text style={styles.contactText}>
              不適切なコンテンツの報告や本免責事項に関するご質問は、
              以下までお気軽にお問い合わせください：
            </Text>
            <Text style={styles.contactInfo}>
              TokyoParkサポートチーム{'\n'}
              メール: support@tokyopark.jp{'\n'}
              緊急時: urgent@tokyopark.jp
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2025 TokyoPark. All rights reserved.
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    lineHeight: 30,
  },
  lastUpdated: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  warning: {
    margin: 20,
    padding: 20,
    backgroundColor: '#FFF3CD',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D2691E',
    marginBottom: 12,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#8B4513',
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text.primary,
    marginBottom: 12,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text.primary,
    marginLeft: 16,
    marginBottom: 8,
  },
  responsibility: {
    fontSize: 15,
    lineHeight: 24,
    color: '#2E8B57',
    marginLeft: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 15,
    lineHeight: 24,
    color: '#DC143C',
    marginBottom: 12,
    fontWeight: '500',
  },
  disclaimerItem: {
    fontSize: 15,
    lineHeight: 24,
    color: '#B22222',
    marginLeft: 16,
    marginBottom: 8,
  },
  reportItem: {
    fontSize: 15,
    lineHeight: 26,
    color: '#FF4500',
    marginBottom: 8,
    fontWeight: '500',
  },
  parentalNotice: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text.primary,
    backgroundColor: '#E6F3FF',
    padding: 16,
    borderRadius: 12,
    fontWeight: '500',
  },
  contact: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    margin: 20,
    borderRadius: 16,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  contactInfo: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
});