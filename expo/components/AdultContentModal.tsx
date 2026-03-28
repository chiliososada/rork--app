import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { AlertTriangle, Shield, FileText } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAdultContentStore } from '@/store/adult-content-store';

interface AdultContentModalProps {
  visible: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  isFirstTime?: boolean;
}

export default function AdultContentModal({ visible, onConfirm, onDecline, isFirstTime = false }: AdultContentModalProps) {
  const { confirmAdultContent } = useAdultContentStore();

  const handleConfirm = () => {
    // 在store中记录确认状态
    confirmAdultContent('modal');
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <AlertTriangle size={48} color={Colors.error} />
          </View>
          
          <Text style={styles.title}>
            {isFirstTime ? '初回利用時の確認' : '年齢確認'}
          </Text>
          
          <Text style={styles.message}>
            このサービスには成人向けコンテンツが{'\n'}
            含まれる可能性があります。
          </Text>
          
          <Text style={styles.question}>
            あなたは18歳以上ですか？
          </Text>

          {isFirstTime && (
            <View style={styles.firstTimeInfo}>
              <Shield size={16} color="#007AFF" />
              <Text style={styles.firstTimeText}>
                初回のみこの確認を行います。同意後はサービスを継続利用できます。
              </Text>
            </View>
          )}
          
          <View style={styles.legalNotice}>
            <FileText size={16} color="#856404" />
            <Text style={styles.legalNoticeText}>
              このサービスの利用により、成人向けコンテンツの閲覧に同意し、{'\n'}
              18歳以上であることを確認いたします。
            </Text>
          </View>
          
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              虚偽の申告は利用規約違反となり、{'\n'}
              アカウントが停止される場合がございます。
            </Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.declineButton]} 
              onPress={onDecline}
              activeOpacity={0.7}
            >
              <Text style={styles.declineButtonText}>
                {isFirstTime ? 'サービスを退出' : 'いいえ'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.confirmButton]} 
              onPress={handleConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmButtonText}>
                はい、18歳以上です
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 20,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: Colors.border,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  firstTimeInfo: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  firstTimeText: {
    fontSize: 13,
    color: '#1976D2',
    textAlign: 'left',
    lineHeight: 18,
    marginLeft: 8,
    flex: 1,
  },
  legalNotice: {
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  legalNoticeText: {
    fontSize: 12,
    color: '#7B1FA2',
    textAlign: 'left',
    lineHeight: 18,
    marginLeft: 8,
    flex: 1,
  },
});