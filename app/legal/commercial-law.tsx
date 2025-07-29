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

export default function CommercialLawScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: '特定商取引法に基づく表記',
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
            <Text style={styles.title}>特定商取引法に基づく表記</Text>
            <Text style={styles.lastUpdated}>最終更新日: 2025年1月29日</Text>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              現在、TokyoParkは無料でご利用いただけるサービスです。
              将来的に有料機能を導入する際には、本ページの内容を更新いたします。
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>事業者名</Text>
              <Text style={styles.value}>TokyoPark運営事務局</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>運営統括責任者</Text>
              <Text style={styles.value}>（サービス開始時に記載）</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>所在地</Text>
              <Text style={styles.value}>（サービス開始時に記載）</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>お問い合わせ</Text>
              <Text style={styles.value}>support@tokyopark.jp</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>有料サービス提供時の表記（現在は該当なし）</Text>
            
            <View style={styles.row}>
              <Text style={styles.label}>販売価格</Text>
              <Text style={styles.value}>各サービスの購入画面に表示</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>商品以外の必要料金</Text>
              <Text style={styles.value}>なし（アプリ内課金の場合）</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>支払方法</Text>
              <Text style={styles.value}>
                App Store / Google Play の{'\n'}
                決済システムに準拠
              </Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>支払時期</Text>
              <Text style={styles.value}>購入手続き完了時</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>サービス提供時期</Text>
              <Text style={styles.value}>購入手続き完了後、即時</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>返品・交換</Text>
              <Text style={styles.value}>
                デジタルコンテンツの性質上、{'\n'}
                返品・交換は原則不可{'\n'}
                （各プラットフォームの{'\n'}
                返金ポリシーに準拠）
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>プラットフォーム別の返金について</Text>
            <Text style={styles.paragraph}>
              アプリ内課金の返金については、以下の各プラットフォームのポリシーに従います：
            </Text>
            
            <Text style={styles.subsectionTitle}>App Store（iOS）</Text>
            <Text style={styles.paragraph}>
              Appleの返金ポリシーに従い、App Storeのサポートから返金申請が可能です。
            </Text>
            
            <Text style={styles.subsectionTitle}>Google Play（Android）</Text>
            <Text style={styles.paragraph}>
              Googleの返金ポリシーに従い、Google Playのサポートから返金申請が可能です。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>動作環境</Text>
            <Text style={styles.paragraph}>
              本サービスの動作環境については、各アプリストアの掲載情報をご確認ください。
              推奨環境以外でのご利用は、サポート対象外となる場合があります。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>その他</Text>
            <Text style={styles.paragraph}>
              本表記は日本国の特定商取引に関する法律に基づいて記載しております。
              サービス内容の詳細については、利用規約をご確認ください。
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
  notice: {
    margin: 20,
    padding: 16,
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#856404',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  value: {
    flex: 2,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text.primary,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text.primary,
    marginBottom: 12,
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