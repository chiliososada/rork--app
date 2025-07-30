import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { X, Flag, AlertTriangle, Shield, Zap, RefreshCw, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useReporting } from '@/store/reporting-store';
import { useToast } from '@/hooks/useToast';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
  contentType: 'topic' | 'comment' | 'chat_message' | 'user' | 'private_message';
  contentId?: string;
  contentPreview?: string; // Optional preview of content being reported
}

export default function ReportModal({
  visible,
  onClose,
  reportedUserId,
  reportedUserName,
  contentType,
  contentId,
  contentPreview,
}: ReportModalProps) {
  const {
    reportCategories,
    loadReportCategories,
    submitReportWithFeedback,
    canSubmitReport,
    isSubmitting,
  } = useReporting();
  const toast = useToast();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<'category' | 'details' | 'confirmation'>('category');
  const [submitError, setSubmitError] = useState<string>('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const reportLimits = canSubmitReport();
  const selectedCategory = reportCategories.find(cat => cat.id === selectedCategoryId);

  useEffect(() => {
    if (visible && reportCategories.length === 0) {
      setIsLoadingCategories(true);
      loadReportCategories().finally(() => {
        setIsLoadingCategories(false);
      });
    }
  }, [visible, reportCategories.length]);

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setSelectedCategoryId('');
      setCustomReason('');
      setDescription('');
      setStep('category');
      setSubmitError('');
    }
  }, [visible]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    const category = reportCategories.find(cat => cat.id === categoryId);
    
    if (category?.requires_details) {
      setStep('details');
    } else {
      setStep('confirmation');
    }
  };

  const handleSubmit = async () => {
    setSubmitError('');

    if (!selectedCategoryId) {
      toast.warning('入力エラー', '通報理由を選択してください');
      return;
    }

    if (selectedCategory?.requires_details && !description.trim()) {
      toast.warning('入力エラー', '詳細な説明を入力してください');
      return;
    }

    if (!reportLimits.canReport) {
      toast.warning(
        '通報制限',
        `1時間以内に送信できる通報は5件までです。\n次回通報可能時刻: ${reportLimits.resetTime.toLocaleTimeString()}`
      );
      return;
    }

    try {
      const result = await submitReportWithFeedback({
        reportedUserId,
        contentType,
        contentId,
        categoryId: selectedCategoryId,
        reason: customReason || selectedCategory?.display_name_ja || '',
        description: description.trim() || undefined,
      });

      if (result.success) {
        toast.success(
          '通報完了',
          '通報内容を確認し、適切な対応を行います。ご協力ありがとうございました。'
        );
        handleClose();
      } else {
        setSubmitError(result.message);
        toast.error('通報失敗', result.message);
      }
    } catch (error: any) {
      console.error('Error submitting report:', error);
      
      let errorMessage = '通報の送信に失敗しました。';
      if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
        errorMessage = 'ネットワークエラーが発生しました。接続を確認してお試しください。';
      } else if (error?.message?.includes('rate limit')) {
        errorMessage = '送信回数の制限に達しました。しばらく時間をおいてからお試しください。';
      } else if (error?.message?.includes('validation')) {
        errorMessage = '入力内容に問題があります。内容を確認してお試しください。';
      }
      
      setSubmitError(errorMessage);
      toast.error('エラー', errorMessage);
    }
  };

  const handleRetry = () => {
    setSubmitError('');
    handleSubmit();
  };

  const renderCategoryIcon = (categoryKey: string) => {
    const iconProps = { size: 20, color: Colors.primary };
    
    switch (categoryKey) {
      case 'harassment':
      case 'hate_speech':
        return <AlertTriangle {...iconProps} color="#FF3B30" />;
      case 'inappropriate_content':
      case 'underage_user':
        return <Shield {...iconProps} color="#FF9500" />;
      case 'spam':
        return <Zap {...iconProps} color="#5856D6" />;
      default:
        return <Flag {...iconProps} />;
    }
  };

  const renderCategoryStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>通報理由を選択してください</Text>
      
      {contentPreview && (
        <View style={styles.contentPreview}>
          <Text style={styles.contentPreviewLabel}>通報対象:</Text>
          <Text style={styles.contentPreviewText} numberOfLines={3}>
            {contentPreview}
          </Text>
        </View>
      )}

      <ScrollView style={styles.categoriesContainer} showsVerticalScrollIndicator={false}>
        {isLoadingCategories ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>通報カテゴリを読み込み中...</Text>
          </View>
        ) : (
          ['critical', 'important', 'standard'].map((priority) => {
          const categories = reportCategories.filter(cat => {
            if (priority === 'critical') {
              return ['harassment', 'hate_speech', 'underage_user'].includes(cat.category_key);
            } else if (priority === 'important') {
              return ['inappropriate_content', 'privacy_violation', 'false_information'].includes(cat.category_key);
            } else {
              return ['spam', 'copyright_violation', 'impersonation', 'other'].includes(cat.category_key);
            }
          });

          if (categories.length === 0) return null;

          return (
            <View key={priority} style={styles.categoryGroup}>
              {priority === 'critical' && (
                <Text style={styles.categoryGroupTitle}>緊急性の高い問題</Text>
              )}
              {priority === 'important' && (
                <Text style={styles.categoryGroupTitle}>重要な問題</Text>
              )}
              {priority === 'standard' && (
                <Text style={styles.categoryGroupTitle}>一般的な問題</Text>
              )}
              
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    selectedCategoryId === category.id && styles.categoryItemSelected
                  ]}
                  onPress={() => handleCategorySelect(category.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryIcon}>
                    {renderCategoryIcon(category.category_key)}
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>{category.display_name_ja}</Text>
                    {category.description_ja && (
                      <Text style={styles.categoryDescription}>{category.description_ja}</Text>
                    )}
                    {category.requires_details && (
                      <Text style={styles.categoryNote}>※ 詳細な説明が必要です</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })
        )}
      </ScrollView>
    </View>
  );

  const renderDetailsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>詳細を入力してください</Text>
      
      <View style={styles.selectedCategoryInfo}>
        <View style={styles.categoryIcon}>
          {renderCategoryIcon(selectedCategory?.category_key || '')}
        </View>
        <Text style={styles.selectedCategoryName}>
          {selectedCategory?.display_name_ja}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>具体的な問題の説明 *</Text>
        <TextInput
          style={styles.textArea}
          value={description}
          onChangeText={setDescription}
          placeholder="何が問題なのか、具体的に説明してください..."
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
        />
        <Text style={styles.characterCount}>{description.length}/500</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep('category')}
        >
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, !description.trim() && styles.nextButtonDisabled]}
          onPress={() => setStep('confirmation')}
          disabled={!description.trim()}
        >
          <Text style={styles.nextButtonText}>次へ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfirmationStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>通報内容の確認</Text>
      
      <View style={styles.confirmationCard}>
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>通報対象:</Text>
          <Text style={styles.confirmationValue}>
            {reportedUserName}さん
            {contentType !== 'user' && ` の${contentType === 'topic' ? '投稿' : contentType === 'comment' ? 'コメント' : 'メッセージ'}`}
          </Text>
        </View>
        
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>通報理由:</Text>
          <Text style={styles.confirmationValue}>{selectedCategory?.display_name_ja}</Text>
        </View>
        
        {description && (
          <View style={styles.confirmationRow}>
            <Text style={styles.confirmationLabel}>詳細:</Text>
            <Text style={styles.confirmationValue}>{description}</Text>
          </View>
        )}
      </View>

      <View style={styles.warningCard}>
        <AlertTriangle size={20} color="#FF9500" />
        <Text style={styles.warningText}>
          虚偽の通報や悪用は利用規約違反となり、アカウントの制限対象となる場合があります。
        </Text>
      </View>

      {submitError && (
        <View style={styles.errorCard}>
          <XCircle size={20} color="#DC3545" />
          <View style={styles.errorContent}>
            <Text style={styles.errorText}>{submitError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              disabled={isSubmitting}
            >
              <RefreshCw size={16} color="#007AFF" />
              <Text style={styles.retryButtonText}>再試行</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep(selectedCategory?.requires_details ? 'details' : 'category')}
          disabled={isSubmitting}
        >
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>送信中...</Text>
            </>
          ) : (
            <Text style={styles.submitButtonText}>通報する</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Flag size={24} color={Colors.primary} />
            <Text style={styles.headerTitle}>通報</Text>
          </View>
          <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
            <X size={24} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {!reportLimits.canReport && (
            <View style={styles.limitWarning}>
              <AlertTriangle size={20} color="#FF9500" />
              <Text style={styles.limitWarningText}>
                1時間に送信できる通報は5件までです。
                残り: {reportLimits.remainingReports}件
              </Text>
            </View>
          )}

          {step === 'category' && renderCategoryStep()}
          {step === 'details' && renderDetailsStep()}
          {step === 'confirmation' && renderConfirmationStep()}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  limitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  limitWarningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  contentPreview: {
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  contentPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  contentPreviewText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  categoriesContainer: {
    flex: 1,
  },
  categoryGroup: {
    marginBottom: 24,
  },
  categoryGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 2,
  },
  categoryNote: {
    fontSize: 11,
    color: Colors.primary,
    fontStyle: 'italic',
  },
  selectedCategoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  selectedCategoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.card,
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'right',
    marginTop: 4,
  },
  confirmationCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  confirmationRow: {
    marginBottom: 12,
  },
  confirmationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  confirmationValue: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8D7DA',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  errorContent: {
    flex: 1,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#721C24',
    lineHeight: 18,
    marginBottom: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  backButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  nextButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  nextButtonDisabled: {
    backgroundColor: Colors.text.secondary,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.text.secondary,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
});