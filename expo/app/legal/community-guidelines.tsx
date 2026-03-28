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

export default function CommunityGuidelinesScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'コミュニティガイドライン',
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
            <Text style={styles.title}>コミュニティガイドライン</Text>
            <Text style={styles.lastUpdated}>最終更新日: 2025年1月30日</Text>
          </View>

          <View style={styles.intro}>
            <Text style={styles.introTitle}>TokyoParkで素敵な地域コミュニティを作ろう！</Text>
            <Text style={styles.paragraph}>
              TokyoParkは、地域の人々が位置情報を通じてつながり、情報を共有し、
              コミュニケーションを楽しむプラットフォームです。
              すべてのユーザーが安心して利用できるよう、以下のガイドラインをお守りください。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🤝 基本原則</Text>
            
            <View style={styles.principle}>
              <Text style={styles.principleTitle}>相手を尊重する</Text>
              <Text style={styles.principleText}>
                多様な背景を持つ人々が利用しています。異なる意見や価値観を尊重しましょう。
              </Text>
            </View>
            
            <View style={styles.principle}>
              <Text style={styles.principleTitle}>正確な情報を共有する</Text>
              <Text style={styles.principleText}>
                特に位置情報は正確に。誤った情報は他のユーザーに迷惑をかけます。
              </Text>
            </View>
            
            <View style={styles.principle}>
              <Text style={styles.principleTitle}>プライバシーを守る</Text>
              <Text style={styles.principleText}>
                自分と他人のプライバシーを大切に。個人情報の無断公開は禁止です。
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ 推奨される行動</Text>
            
            <Text style={styles.goodExample}>• 地域の役立つ情報を積極的に共有する</Text>
            <Text style={styles.goodExample}>• 困っている人を助ける投稿やコメント</Text>
            <Text style={styles.goodExample}>• お店や施設の良い点を紹介する</Text>
            <Text style={styles.goodExample}>• イベントや地域活動の情報共有</Text>
            <Text style={styles.goodExample}>• 建設的な議論や意見交換</Text>
            <Text style={styles.goodExample}>• 感謝の気持ちを表現する</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>❌ 禁止される行動</Text>
            
            <View style={styles.prohibition}>
              <Text style={styles.prohibitionTitle}>ハラスメント・いじめ</Text>
              <Text style={styles.prohibitionText}>
                誹謗中傷、脅迫、ストーキング、なりすまし等の行為
              </Text>
            </View>
            
            <View style={styles.prohibition}>
              <Text style={styles.prohibitionTitle}>不適切なコンテンツ</Text>
              <Text style={styles.prohibitionText}>
                暴力的、性的、差別的な内容。不適切な成人向けコンテンツ
              </Text>
            </View>
            
            <View style={styles.prohibition}>
              <Text style={styles.prohibitionTitle}>スパム・商業利用</Text>
              <Text style={styles.prohibitionText}>
                過度な宣伝、勧誘、同じ内容の繰り返し投稿
              </Text>
            </View>
            
            <View style={styles.prohibition}>
              <Text style={styles.prohibitionTitle}>虚偽の情報</Text>
              <Text style={styles.prohibitionText}>
                意図的な誤情報、フェイクニュース、詐欺的な内容
              </Text>
            </View>
            
            <View style={styles.prohibition}>
              <Text style={styles.prohibitionTitle}>違法行為</Text>
              <Text style={styles.prohibitionText}>
                法律違反、著作権侵害、プライバシー侵害等
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 位置情報の利用について</Text>
            
            <Text style={styles.locationTip}>• 自宅や職場など、プライベートな場所の詳細は共有しない</Text>
            <Text style={styles.locationTip}>• 他人の居場所を無断で公開しない</Text>
            <Text style={styles.locationTip}>• プライベートな場所の詳細な情報は慎重に扱う</Text>
            <Text style={styles.locationTip}>• ストーカー行為や待ち伏せに利用しない</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛡️ 安全な利用のために</Text>
            
            <View style={styles.safetyTip}>
              <Text style={styles.safetyTitle}>知らない人と会う時は</Text>
              <Text style={styles.safetyText}>
                公共の場所で、昼間に。信頼できる人に行き先を伝えておきましょう。
              </Text>
            </View>
            
            <View style={styles.safetyTip}>
              <Text style={styles.safetyTitle}>個人情報の管理</Text>
              <Text style={styles.safetyText}>
                電話番号、住所、銀行口座などの個人情報は共有しないでください。
              </Text>
            </View>
            
            <View style={styles.safetyTip}>
              <Text style={styles.safetyTitle}>成人向けサービスの利用</Text>
              <Text style={styles.safetyText}>
                本サービスは18歳以上の成人向けサービスです。成人としての責任ある行動と相互尊重をお願いします。
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚨 違反行為への対応</Text>
            
            <Text style={styles.violationStep}>1. 警告: 軽微な違反には警告を行います</Text>
            <Text style={styles.violationStep}>2. 一時停止: 繰り返しの違反や中程度の違反</Text>
            <Text style={styles.violationStep}>3. アカウント停止: 重大な違反や改善が見られない場合</Text>
            <Text style={styles.violationStep}>4. 法的措置: 違法行為については関係機関と連携</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📢 通報機能の使い方</Text>
            
            <Text style={styles.paragraph}>
              ガイドライン違反を見つけたら、各投稿やプロフィールにある通報ボタンから報告してください。
            </Text>
            
            <Text style={styles.reportTip}>• 具体的な違反内容を選択</Text>
            <Text style={styles.reportTip}>• 必要に応じて詳細を記入</Text>
            <Text style={styles.reportTip}>• 虚偽の通報は行わない</Text>
            <Text style={styles.reportTip}>• 24時間以内に確認し対応します</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🤔 判断に迷ったら</Text>
            
            <Text style={styles.paragraph}>
              「これを投稿して大丈夫かな？」と思ったら、以下を考えてみてください：
            </Text>
            
            <Text style={styles.checkItem}>□ 家族や友人に見られても恥ずかしくない内容か</Text>
            <Text style={styles.checkItem}>□ 相手の立場で読んでも不快にならないか</Text>
            <Text style={styles.checkItem}>□ 法律や社会のルールに反していないか</Text>
            <Text style={styles.checkItem}>□ 正確で役に立つ情報か</Text>
          </View>

          <View style={styles.closing}>
            <Text style={styles.closingTitle}>みんなで作る素敵なコミュニティ</Text>
            <Text style={styles.closingText}>
              TokyoParkは、ユーザーの皆様一人ひとりの協力によって成り立っています。
              お互いを思いやり、地域を愛する気持ちを大切に、
              楽しく有益な情報交換の場を作っていきましょう！
            </Text>
          </View>

          <View style={styles.contact}>
            <Text style={styles.contactTitle}>お問い合わせ</Text>
            <Text style={styles.contactText}>
              ガイドラインについてご不明な点がございましたら、
              support@tokyopark.jp までお気軽にお問い合わせください。
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
  intro: {
    padding: 20,
    backgroundColor: '#E3F2FD',
    margin: 20,
    borderRadius: 16,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 12,
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text.primary,
    marginBottom: 12,
  },
  principle: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 12,
  },
  principleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  principleText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text.secondary,
  },
  goodExample: {
    fontSize: 15,
    lineHeight: 26,
    color: '#4CAF50',
    marginBottom: 8,
  },
  prohibition: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  prohibitionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
    marginBottom: 6,
  },
  prohibitionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#B71C1C',
  },
  locationTip: {
    fontSize: 15,
    lineHeight: 26,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  safetyTip: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 6,
  },
  safetyText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text.primary,
  },
  violationStep: {
    fontSize: 15,
    lineHeight: 26,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  reportTip: {
    fontSize: 15,
    lineHeight: 26,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  checkItem: {
    fontSize: 15,
    lineHeight: 26,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  closing: {
    margin: 20,
    padding: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
  },
  closingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#388E3C',
    marginBottom: 12,
    textAlign: 'center',
  },
  closingText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#2E7D32',
    textAlign: 'center',
  },
  contact: {
    padding: 20,
    alignItems: 'center',
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