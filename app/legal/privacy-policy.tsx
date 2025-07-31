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

export default function PrivacyPolicyScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'プライバシーポリシー',
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
            <Text style={styles.title}>プライバシーポリシー</Text>
            <Text style={styles.lastUpdated}>最終更新日: 2025年1月30日</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.paragraph}>
              TokyoPark（以下「本サービス」といいます）は、ユーザーの皆様のプライバシーを尊重し、個人情報の保護に努めています。本プライバシーポリシーは、本サービスがどのような個人情報を収集し、どのように利用・管理するかについて説明するものです。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. 収集する情報</Text>
            
            <Text style={styles.subsectionTitle}>1.1 ユーザーが提供する情報</Text>
            <Text style={styles.listItem}>• メールアドレス</Text>
            <Text style={styles.listItem}>• ニックネーム</Text>
            <Text style={styles.listItem}>• プロフィール画像</Text>
            <Text style={styles.listItem}>• 性別（任意）</Text>
            
            <Text style={styles.subsectionTitle}>1.2 自動的に収集される情報</Text>
            <Text style={styles.listItem}>• 位置情報（GPS）※詳細は「3. 位置情報の取り扱い」をご参照ください</Text>
            <Text style={styles.listItem}>• デバイス情報（OS、アプリバージョン等）</Text>
            <Text style={styles.listItem}>• 利用ログ（アクセス日時、利用機能等）</Text>
            
            <Text style={styles.subsectionTitle}>1.3 ユーザーの活動に関する情報</Text>
            <Text style={styles.listItem}>• 投稿した話題、コメント、チャットメッセージ</Text>
            <Text style={styles.listItem}>• いいね、お気に入り、フォロー情報</Text>
            <Text style={styles.listItem}>• 参加した話題、タグ使用履歴</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. 情報の利用目的</Text>
            <Text style={styles.paragraph}>収集した情報は以下の目的で利用します：</Text>
            <Text style={styles.listItem}>• 本サービスの提供、維持、改善</Text>
            <Text style={styles.listItem}>• 位置情報に基づく話題の表示</Text>
            <Text style={styles.listItem}>• ユーザー間のコミュニケーション機能の提供</Text>
            <Text style={styles.listItem}>• カスタマーサポートの提供</Text>
            <Text style={styles.listItem}>• 利用規約違反の防止、不正利用の検知</Text>
            <Text style={styles.listItem}>• 統計データの作成（個人を特定しない形で）</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. 位置情報の取り扱い</Text>
            <Text style={styles.paragraph}>
              本サービスは位置情報を基にした機能を提供しています。位置情報は以下のように取り扱います：
            </Text>
            <Text style={styles.subsectionTitle}>位置情報の利用目的</Text>
            <Text style={styles.listItem}>• 話題投稿時の位置情報は他のユーザーに表示されます</Text>
            <Text style={styles.listItem}>• 現在地から近い話題を表示するために使用します</Text>
            <Text style={styles.listItem}>• 位置情報の精度は設定で調整可能です</Text>
            <Text style={styles.listItem}>• 位置情報の使用は端末の設定でいつでも無効にできます</Text>
            
            <Text style={styles.subsectionTitle}>位置情報の保存と削除</Text>
            <Text style={styles.listItem}>• 投稿時の位置情報は投稿と紐付けて保存されます</Text>
            <Text style={styles.listItem}>• 投稿を削除すると関連する位置情報も削除されます</Text>
            <Text style={styles.listItem}>• 現在地の位置情報は一時的に使用され、保存されません</Text>
            
            <Text style={styles.subsectionTitle}>位置情報のプライバシー保護</Text>
            <Text style={styles.listItem}>• 他のユーザーのリアルタイム位置は追跡しません</Text>
            <Text style={styles.listItem}>• 位置情報は暗号化された通信で送信されます</Text>
            <Text style={styles.listItem}>• 第三者に位置情報を販売または提供することはありません</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. 情報の第三者提供</Text>
            <Text style={styles.paragraph}>
              以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません：
            </Text>
            <Text style={styles.listItem}>• ユーザーの同意がある場合</Text>
            <Text style={styles.listItem}>• 法令に基づく開示要請がある場合</Text>
            <Text style={styles.listItem}>• 人の生命、身体または財産の保護のために必要な場合</Text>
            <Text style={styles.listItem}>• サービス提供に必要な範囲で業務委託先に提供する場合</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. 外部サービスの利用</Text>
            <Text style={styles.paragraph}>
              本サービスは以下の外部サービスを利用しています：
            </Text>
            <Text style={styles.listItem}>• Supabase（データベース、認証サービス）</Text>
            <Text style={styles.listItem}>• Expo（アプリ開発プラットフォーム）</Text>
            <Text style={styles.paragraph}>
              これらのサービスのプライバシーポリシーについては、各サービスのウェブサイトをご確認ください。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. データの保存期間</Text>
            <Text style={styles.paragraph}>
              ユーザーの個人情報は、アカウントが有効である限り保存されます。アカウント削除後は、法令で定められた期間または不正利用防止のために必要な期間保存した後、安全に削除します。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. セキュリティ</Text>
            <Text style={styles.paragraph}>
              ユーザーの個人情報を保護するため、適切な技術的・組織的セキュリティ対策を実施しています。ただし、インターネット上での完全なセキュリティを保証することはできません。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. ユーザーの権利</Text>
            <Text style={styles.paragraph}>ユーザーは以下の権利を有します：</Text>
            <Text style={styles.listItem}>• 個人情報の開示請求</Text>
            <Text style={styles.listItem}>• 個人情報の訂正・追加・削除請求</Text>
            <Text style={styles.listItem}>• 個人情報の利用停止請求</Text>
            <Text style={styles.listItem}>• 個人情報の第三者提供停止請求</Text>
            <Text style={styles.paragraph}>
              これらの請求については、本サービス内の設定画面またはお問い合わせフォームからご連絡ください。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. 年齢制限および年齢確認</Text>
            <Text style={styles.paragraph}>
              本サービスは18歳以上の成人向けサービスです。18歳未満の方の利用を禁止しており、登録時に年齢確認を実施しています。
            </Text>
            <Text style={styles.listItem}>• 生年月日による年齢確認システムを導入</Text>
            <Text style={styles.listItem}>• 年齢確認ログの記録と管理</Text>
            <Text style={styles.listItem}>• 年齢詐称が発覚した場合のアカウント停止措置</Text>
            <Text style={styles.listItem}>• 18歳未満の個人情報は意図的に収集しません</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. プライバシーポリシーの変更</Text>
            <Text style={styles.paragraph}>
              本プライバシーポリシーは、法令の改正やサービスの変更に応じて更新されることがあります。重要な変更がある場合は、アプリ内でお知らせします。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. お問い合わせ</Text>
            <Text style={styles.paragraph}>
              本プライバシーポリシーに関するご質問やご意見は、以下までお問い合わせください：
            </Text>
            <Text style={styles.contactInfo}>
              TokyoParkサポートチーム{'\n'}
              メール: support@tokyopark.jp
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
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    color: Colors.text.secondary,
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
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 12,
    marginBottom: 8,
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
    marginBottom: 6,
  },
  contactInfo: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text.primary,
    marginTop: 8,
    backgroundColor: Colors.backgroundSoft,
    padding: 16,
    borderRadius: 12,
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