import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAdultContentStore } from '@/store/adult-content-store';

interface AgeVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({
  visible,
  onClose,
  onVerified
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [verificationMethod, setVerificationMethod] = useState<string>('self_declared');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'intro' | 'date_select' | 'method_select'>('intro');

  const {
    submitAgeVerification,
    confirmAdultContent,
    verificationConfig,
    isLoading,
    error
  } = useAdultContentStore();

  // 获取18年前的日期作为最大可选日期
  const get18YearsAgo = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().split('T')[0];
  };

  // 获取100年前的日期作为最小可选日期  
  const get100YearsAgo = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 100);
    return date.toISOString().split('T')[0];
  };

  const handleDateSelect = (date: any) => {
    setSelectedDate(date.dateString);
  };

  const handleSubmitVerification = async () => {
    if (!selectedDate) {
      Alert.alert('エラー', '生年月日を選択してください');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const birthDate = new Date(selectedDate);
      const result = await submitAgeVerification(birthDate, verificationMethod);
      
      if (result.success) {
        if (result.requiresReview) {
          Alert.alert(
            '確認中',
            'あなたの年齢確認は現在審査中です。審査が完了するまでお待ちください。',
            [{ text: 'OK', onPress: onClose }]
          );
        } else {
          Alert.alert(
            '確認完了',
            '年齢確認が完了しました。',
            [{ text: 'OK', onPress: () => {
              onVerified();
              onClose();
            }}]
          );
        }
      } else {
        Alert.alert('エラー', result.message);
      }
    } catch (error) {
      console.error('年齢確認エラー:', error);
      Alert.alert('エラー', '年齢確認に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFallbackConfirmation = () => {
    // 宽限期内的客户端确认（向后兼容）
    confirmAdultContent('modal');
    Alert.alert(
      'ご確認いただきました',
      '24時間の猶予期間中にアクセスが可能です。本格的なご利用には年齢確認が必要です。',
      [{ text: 'OK', onPress: () => {
        onVerified();
        onClose();
      }}]
    );
  };

  const renderIntroStep = () => (
    <View className="p-6">
      <View className="items-center mb-6">
        <Ionicons name="shield-checkmark" size={48} color="#F59E0B" />
        <Text className="text-xl font-bold text-gray-800 mt-4 text-center">
          年齢確認のお願い
        </Text>
      </View>
      
      <Text className="text-gray-600 text-center mb-6 leading-6">
        このアプリは18歳以上の方を対象としています。{'\n'}
        ご利用には年齢確認が必要です。
      </Text>

      <View className="bg-yellow-50 p-4 rounded-lg mb-6">
        <Text className="text-sm text-yellow-800">
          <Text className="font-bold">個人情報の保護について：</Text>{'\n'}
          年齢確認に使用される情報は暗号化され、
          法的要件に従って安全に保管されます。
        </Text>
      </View>

      <TouchableOpacity
        className="bg-blue-600 py-4 px-6 rounded-lg mb-3"
        onPress={() => setStep('date_select')}
      >
        <Text className="text-white text-center font-semibold">
          年齢確認を開始
        </Text>
      </TouchableOpacity>

      {verificationConfig?.gracePeriodHours && (
        <TouchableOpacity
          className="bg-gray-200 py-4 px-6 rounded-lg"
          onPress={handleFallbackConfirmation}
        >
          <Text className="text-gray-700 text-center font-semibold">
            24時間の猶予期間でアクセス
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderDateSelectStep = () => (
    <ScrollView className="p-6">
      <View className="items-center mb-6">
        <Ionicons name="calendar" size={32} color="#3B82F6" />
        <Text className="text-lg font-bold text-gray-800 mt-2">
          生年月日を選択してください
        </Text>
      </View>

      <Calendar
        onDayPress={handleDateSelect}
        markedDates={{
          [selectedDate]: {
            selected: true,
            selectedColor: '#3B82F6'
          }
        }}
        maxDate={get18YearsAgo()}
        minDate={get100YearsAgo()}
        theme={{
          selectedDayBackgroundColor: '#3B82F6',
          todayTextColor: '#3B82F6',
          arrowColor: '#3B82F6',
        }}
      />

      {selectedDate && (
        <View className="mt-6">
          <TouchableOpacity
            className="bg-blue-600 py-4 px-6 rounded-lg"
            onPress={handleSubmitVerification}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold">
                確認を送信
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        className="mt-3 py-2"
        onPress={() => setStep('intro')}
      >
        <Text className="text-gray-500 text-center">戻る</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">
            年齢確認
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {error && (
          <View className="bg-red-50 p-4 mx-4 mt-4 rounded-lg">
            <Text className="text-red-800 text-center">{error}</Text>
          </View>
        )}

        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-600 mt-4">設定を読み込み中...</Text>
          </View>
        ) : (
          <>
            {step === 'intro' && renderIntroStep()}
            {step === 'date_select' && renderDateSelectStep()}
          </>
        )}
      </View>
    </Modal>
  );
};