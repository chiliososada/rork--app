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

export default function TermsOfServiceScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: '利用規約',
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
            <Text style={styles.title}>利用規約</Text>
            <Text style={styles.lastUpdated}>最終更新日: 2025年1月30日</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.paragraph}>
              この利用規約（以下「本規約」といいます）は、TokyoPark（以下「本サービス」といいます）の利用条件を定めるものです。ユーザーの皆様（以下「ユーザー」といいます）は、本規約に同意した上で、本サービスをご利用ください。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第1条（適用）</Text>
            <Text style={styles.paragraph}>
              本規約は、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第2条（利用登録）</Text>
            <Text style={styles.listItem}>1. 利用登録の申請は、本規約に同意の上、当社の定める方法によって行うものとします。</Text>
            <Text style={styles.listItem}>2. 本サービスは18歳以上の方のみご利用いただけます。18歳未満の方は利用登録を行うことができません。</Text>
            <Text style={styles.listItem}>3. 当社は、以下の場合には、利用登録の申請を承認しないことがあります。</Text>
            <Text style={styles.subListItem}>• 18歳未満である場合</Text>
            <Text style={styles.subListItem}>• 虚偽の事項を届け出た場合</Text>
            <Text style={styles.subListItem}>• 本規約に違反したことがある者からの申請である場合</Text>
            <Text style={styles.subListItem}>• その他、当社が利用登録を相当でないと判断した場合</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第3条（成人向けコンテンツについて）</Text>
            <Text style={styles.listItem}>1. 本サービスは18歳以上の成人向けサービスであり、一部のコンテンツには成人向けの内容が含まれる可能性があります。</Text>
            <Text style={styles.listItem}>2. ユーザーは、本サービスを利用することにより、18歳以上であることを表明し、保証するものとします。</Text>
            <Text style={styles.listItem}>3. 年齢を偽って本サービスを利用した場合、直ちにアカウントを停止し、法的措置を取る場合があります。</Text>
            <Text style={styles.listItem}>4. ユーザーは、本サービス内で遭遇する可能性のある成人向けコンテンツについて、自己の責任で閲覧・利用するものとします。</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第4条（アカウント管理）</Text>
            <Text style={styles.listItem}>1. ユーザーは、自己の責任において、本サービスのアカウントを適切に管理するものとします。</Text>
            <Text style={styles.listItem}>2. ユーザーは、いかなる場合にも、アカウントを第三者に譲渡または貸与することはできません。</Text>
            <Text style={styles.listItem}>3. 第三者によるアカウントの使用によって生じた損害は、当社に故意または重大な過失がある場合を除き、当社は一切の責任を負わないものとします。</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第5条（禁止事項）</Text>
            <Text style={styles.paragraph}>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</Text>
            <Text style={styles.listItem}>• 法令または公序良俗に違反する行為</Text>
            <Text style={styles.listItem}>• 犯罪行為に関連する行為</Text>
            <Text style={styles.listItem}>• 当社、本サービスの他のユーザー、またはその他第三者の知的財産権、肖像権、プライバシー、名誉その他の権利または利益を侵害する行為</Text>
            <Text style={styles.listItem}>• 本サービスの運営を妨害するおそれのある行為</Text>
            <Text style={styles.listItem}>• 虚偽の位置情報を投稿する行為</Text>
            <Text style={styles.listItem}>• 他のユーザーに対する嫌がらせ、誹謗中傷、なりすまし行為</Text>
            <Text style={styles.listItem}>• わいせつ、暴力的、差別的な表現を含む情報の送信</Text>
            <Text style={styles.listItem}>• 営利を目的とした宣伝、広告、勧誘、その他営業行為</Text>
            <Text style={styles.listItem}>• 不正アクセス、またはこれを試みる行為</Text>
            <Text style={styles.listItem}>• 本サービスの他のユーザーの情報の収集</Text>
            <Text style={styles.listItem}>• 反社会的勢力等への利益供与</Text>
            <Text style={styles.listItem}>• 18歳未満であることを隠して本サービスを利用する行為</Text>
            <Text style={styles.listItem}>• 年齢確認において虚偽の情報を提供する行為</Text>
            <Text style={styles.listItem}>• その他、当社が不適切と判断する行為</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第6条（投稿コンテンツ）</Text>
            <Text style={styles.listItem}>1. ユーザーは、投稿コンテンツについて、自らが投稿その他送信することについての適法な権利を有していること、及び投稿コンテンツが第三者の権利を侵害していないことについて、当社に対し表明し、保証するものとします。</Text>
            <Text style={styles.listItem}>2. ユーザーは、投稿コンテンツについて、当社に対し、世界的、非独占的、無償、サブライセンス可能かつ譲渡可能な使用、複製、配布、派生著作物の作成、表示及び実行に関する権利を付与します。</Text>
            <Text style={styles.listItem}>3. 当社は、ユーザーが投稿したコンテンツについて、本サービスの運営に必要な範囲で、複製、編集、削除等を行うことができるものとします。</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第7条（コンテンツの削除）</Text>
            <Text style={styles.paragraph}>
              当社は、ユーザーが本規約に違反した場合、または本サービスの運営上必要と判断した場合、事前の通知なく、投稿コンテンツを削除することができるものとします。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第8条（サービスの提供の停止等）</Text>
            <Text style={styles.listItem}>1. 当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。</Text>
            <Text style={styles.subListItem}>• 本サービスにかかるシステムの保守点検または更新を行う場合</Text>
            <Text style={styles.subListItem}>• 地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</Text>
            <Text style={styles.subListItem}>• コンピュータまたは通信回線等が事故により停止した場合</Text>
            <Text style={styles.subListItem}>• その他、当社が本サービスの提供が困難と判断した場合</Text>
            <Text style={styles.listItem}>2. 当社は、本サービスの提供の停止または中断により、ユーザーまたは第三者が被ったいかなる不利益または損害についても、一切の責任を負わないものとします。</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第9条（利用制限および登録抹消）</Text>
            <Text style={styles.paragraph}>
              当社は、ユーザーが本規約のいずれかの条項に違反した場合、事前の通知なく、当該ユーザーに対して、本サービスの全部もしくは一部の利用を制限し、またはユーザーとしての登録を抹消することができるものとします。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第10条（退会）</Text>
            <Text style={styles.paragraph}>
              ユーザーは、当社の定める手続により、本サービスから退会できるものとします。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第11条（保証の否認および免責事項）</Text>
            <Text style={styles.listItem}>1. 当社は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます。）がないことを明示的にも黙示的にも保証しておりません。</Text>
            <Text style={styles.listItem}>2. 当社は、本サービスに起因してユーザーに生じたあらゆる損害について、当社の故意または重過失による場合を除き、一切の責任を負いません。</Text>
            <Text style={styles.listItem}>3. 当社は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第12条（サービス内容の変更等）</Text>
            <Text style={styles.paragraph}>
              当社は、ユーザーへの事前の通知なく、本サービスの内容を変更または本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第13条（利用規約の変更）</Text>
            <Text style={styles.paragraph}>
              当社は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。なお、本規約の変更後、本サービスの利用を開始した場合には、当該ユーザーは変更後の規約に同意したものとみなします。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第14条（個人情報の取扱い）</Text>
            <Text style={styles.paragraph}>
              当社は、本サービスの利用によって取得する個人情報については、当社「プライバシーポリシー」に従い適切に取り扱うものとします。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第15条（通知または連絡）</Text>
            <Text style={styles.paragraph}>
              ユーザーと当社との間の通知または連絡は、当社の定める方法によって行うものとします。当社は、ユーザーから、当社が別途定める方式に従った変更届け出がない限り、現在登録されている連絡先が有効なものとみなして当該連絡先へ通知または連絡を行い、これらは、発信時にユーザーへ到達したものとみなします。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第16条（権利義務の譲渡の禁止）</Text>
            <Text style={styles.paragraph}>
              ユーザーは、当社の書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利もしくは義務を第三者に譲渡し、または担保に供することはできません。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>第17条（準拠法・裁判管轄）</Text>
            <Text style={styles.listItem}>1. 本規約の解釈にあたっては、日本法を準拠法とします。</Text>
            <Text style={styles.listItem}>2. 本サービスに関して紛争が生じた場合には、東京地方裁判所を専属的合意管轄とします。</Text>
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
    marginBottom: 8,
  },
  subListItem: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text.primary,
    marginLeft: 20,
    marginBottom: 6,
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