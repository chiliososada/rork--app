import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contentModerationService, ReportReason, ContentType } from '@/lib/content-moderation';

interface ReportContentModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: ContentType;
  contentId: string;
  reportedUserId: string;
  reporterId: string;
  onReportSubmitted?: () => void;
}

const REPORT_REASONS: Array<{ key: ReportReason; label: string; description: string }> = [
  {
    key: 'spam',
    label: 'スパム',
    description: '宣伝目的や繰り返し投稿など'
  },
  {
    key: 'harassment',
    label: 'ハラスメント',
    description: '嫌がらせや個人攻撃'
  },
  {
    key: 'hate_speech',
    label: 'ヘイトスピーチ',
    description: '差別的な発言や憎悪表現'
  },
  {
    key: 'adult_content',
    label: 'アダルトコンテンツ',
    description: '性的な内容や不適切な画像'
  },
  {
    key: 'violence',
    label: '暴力的表現',
    description: '暴力の扇動や脅迫'
  },
  {
    key: 'discrimination',
    label: '差別的表現',
    description: '人種、性別、宗教等による差別'
  },
  {
    key: 'false_information',
    label: '虚偽情報',
    description: 'デマや誤解を招く情報'
  },
  {
    key: 'copyright_violation',
    label: '著作権侵害',
    description: '無断転載や著作権違反'
  },
  {
    key: 'personal_information',
    label: '個人情報',
    description: 'プライバシー侵害や個人情報の暴露'
  },
  {
    key: 'other',
    label: 'その他',
    description: '上記に該当しない問題'
  }
];

export const ReportContentModal: React.FC<ReportContentModalProps> = ({
  visible,
  onClose,
  contentType,
  contentId,
  reportedUserId,
  reporterId,
  onReportSubmitted
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'select_reason' | 'add_details' | 'confirm'>('select_reason');

  const resetModal = () => {
    setSelectedReason(null);
    setDescription('');
    setStep('select_reason');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleReasonSelect = (reason: ReportReason) => {
    setSelectedReason(reason);
    setStep('add_details');
  };

  const handleSubmitReport = async () => {
    if (!selectedReason) {
      Alert.alert('エラー', '報告理由を選択してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await contentModerationService.submitUserReport(
        reporterId,
        reportedUserId,
        contentType,
        contentId,
        selectedReason,
        description.trim() || undefined
      );

      if (result.status === 'submitted') {
        Alert.alert(
          '報告完了',
          'コンテンツの報告を受け付けました。確認後、適切な対応を取らせていただきます。',
          [
            {
              text: 'OK',
              onPress: () => {
                onReportSubmitted?.();
                handleClose();
              }
            }
          ]
        );
      } else {
        // エラーメッセージを表示
        let errorTitle = 'エラー';
        let errorMessage = result.message;

        if (result.status === 'rate_limited') {
          errorTitle = '報告上限';
          errorMessage = '1日の報告上限に達しました。時間をおいて再度お試しください。';
        } else if (result.status === 'duplicate') {
          errorTitle = '重複報告';
          errorMessage = '同じコンテンツの報告が既に存在します。';
        }

        Alert.alert(errorTitle, errorMessage);
      }
    } catch (error) {
      console.error('報告送信エラー:', error);
      Alert.alert('エラー', '報告の送信に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getContentTypeDisplayName = (): string => {
    switch (contentType) {
      case 'topic':
        return '話題';
      case 'comment':
        return 'コメント';
      case 'chat_message':
        return 'チャットメッセージ';
      case 'user_profile':
        return 'ユーザープロフィール';
      default:
        return 'コンテンツ';
    }
  };

  const renderReasonSelection = () => (
    <ScrollView className="flex-1">
      <Text className="text-lg font-bold text-gray-800 mb-2">
        報告理由を選択してください
      </Text>
      <Text className="text-sm text-gray-600 mb-6">
        この{getContentTypeDisplayName()}について問題があると思われる理由を選択してください
      </Text>

      {REPORT_REASONS.map((reason) => (
        <TouchableOpacity
          key={reason.key}
          className="bg-white p-4 mb-3 rounded-lg border border-gray-200"
          onPress={() => handleReasonSelect(reason.key)}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-800 mb-1">
                {reason.label}
              </Text>
              <Text className="text-sm text-gray-600">
                {reason.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderDetailsInput = () => (
    <ScrollView className="flex-1">
      <Text className="text-lg font-bold text-gray-800 mb-2">
        詳細情報（任意）
      </Text>
      <Text className="text-sm text-gray-600 mb-4">
        選択した理由: <Text className="font-semibold">
          {REPORT_REASONS.find(r => r.key === selectedReason)?.label}
        </Text>
      </Text>
      <Text className="text-sm text-gray-600 mb-4">
        問題の詳細や追加情報があれば記入してください。より適切な対応のために役立ちます。
      </Text>

      <TextInput
        className="bg-white p-4 rounded-lg border border-gray-200 text-gray-800"
        placeholder="詳細を記入してください（任意）"
        placeholderTextColor="#9CA3AF"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={6}
        maxLength={500}
        textAlignVertical="top"
      />

      <Text className="text-xs text-gray-500 mt-2 text-right">
        {description.length}/500文字
      </Text>

      <View className="bg-blue-50 p-4 rounded-lg mt-6 border border-blue-200">
        <View className="flex-row items-start">
          <Ionicons name="information-circle" size={20} color="#3B82F6" className="mr-2 mt-0.5" />
          <Text className="text-sm text-blue-800 flex-1">
            報告は匿名で処理されます。虚偽の報告や悪用は利用規約違反となる場合があります。
          </Text>
        </View>
      </View>

      <View className="flex-row space-x-3 mt-6">
        <TouchableOpacity
          className="flex-1 bg-gray-200 py-3 px-4 rounded-lg"
          onPress={() => setStep('select_reason')}
        >
          <Text className="text-gray-700 text-center font-medium">戻る</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 bg-red-600 py-3 px-4 rounded-lg"
          onPress={handleSubmitReport}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white text-center font-medium">報告する</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-gray-50">
        {/* ヘッダー */}
        <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">
            コンテンツを報告
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* 進行状況インジケーター */}
        <View className="flex-row bg-white px-4 py-3">
          <View className="flex-1 flex-row items-center">
            <View className={`w-6 h-6 rounded-full ${step === 'select_reason' ? 'bg-blue-600' : 'bg-blue-200'} items-center justify-center mr-2`}>
              <Text className={`text-sm font-bold ${step === 'select_reason' ? 'text-white' : 'text-blue-600'}`}>1</Text>
            </View>
            <Text className={`text-sm ${step === 'select_reason' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
              理由選択
            </Text>
          </View>
          <View className="flex-1 flex-row items-center">
            <View className={`w-6 h-6 rounded-full ${step === 'add_details' ? 'bg-blue-600' : 'bg-gray-200'} items-center justify-center mr-2`}>
              <Text className={`text-sm font-bold ${step === 'add_details' ? 'text-white' : 'text-gray-400'}`}>2</Text>
            </View>
            <Text className={`text-sm ${step === 'add_details' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
              詳細入力
            </Text>
          </View>
        </View>

        {/* メインコンテンツ */}
        <View className="flex-1 p-4">
          {step === 'select_reason' && renderReasonSelection()}
          {step === 'add_details' && renderDetailsInput()}
        </View>
      </View>
    </Modal>
  );
};