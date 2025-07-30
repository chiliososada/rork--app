import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { CheckCircle, Clock, Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface ContentModerationNoticeProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'topic' | 'comment';
  moderationStatus: 'pending' | 'approved' | 'rejected';
  reason?: string;
}

export default function ContentModerationNotice({
  visible,
  onClose,
  contentType,
  moderationStatus,
  reason
}: ContentModerationNoticeProps) {
  const getNoticeConfig = () => {
    const isComment = contentType === 'comment';
    
    switch (moderationStatus) {
      case 'approved':
        return {
          icon: <CheckCircle size={48} color="#4CAF50" />,
          title: '投稿完了',
          message: isComment 
            ? 'コメントが投稿されました。' 
            : 'トピックが作成されました。',
          backgroundColor: '#E8F5E9',
          buttonColor: '#4CAF50',
          buttonText: 'OK'
        };
      
      case 'pending':
        return {
          icon: <Clock size={48} color="#FF9500" />,
          title: '審査中です',
          message: isComment
            ? 'コメントを審査中です。承認後、他のユーザーに表示されます。\n\nご投稿ありがとうございました。'
            : 'トピックを審査中です。承認後、他のユーザーに表示されます。\n\nご投稿ありがとうございました。',
          backgroundColor: '#FFF3E0',
          buttonColor: '#FF9500',
          buttonText: '了解しました'
        };
      
      case 'rejected':
        return {
          icon: <Shield size={48} color="#F44336" />,
          title: '投稿できませんでした',
          message: isComment
            ? 'コメントの内容に問題がある可能性があります。内容を見直してもう一度お試しください。'
            : 'トピックの内容に問題がある可能性があります。内容を見直してもう一度お試しください。',
          backgroundColor: '#FFEBEE',
          buttonColor: '#F44336',
          buttonText: '了解しました'
        };
      
      default:
        return null;
    }
  };

  const config = getNoticeConfig();
  if (!config) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
          <View style={styles.iconContainer}>
            {config.icon}
          </View>
          
          <Text style={styles.title}>{config.title}</Text>
          
          <Text style={styles.message}>{config.message}</Text>
          
          {reason && (
            <View style={styles.reasonContainer}>
              <Text style={styles.reasonLabel}>理由:</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          )}
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: config.buttonColor }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{config.buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
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
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  reasonContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 20,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 120,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

// Success notice specifically for approved content
export function ContentApprovedNotice({
  visible,
  onClose,
  contentType
}: {
  visible: boolean;
  onClose: () => void;
  contentType: 'topic' | 'comment';
}) {
  return (
    <ContentModerationNotice
      visible={visible}
      onClose={onClose}
      contentType={contentType}
      moderationStatus="approved"
    />
  );
}

// Pending notice specifically for content under review
export function ContentPendingNotice({
  visible,
  onClose,
  contentType,
  reason
}: {
  visible: boolean;
  onClose: () => void;
  contentType: 'topic' | 'comment';
  reason?: string;
}) {
  return (
    <ContentModerationNotice
      visible={visible}
      onClose={onClose}
      contentType={contentType}
      moderationStatus="pending"
      reason={reason}
    />
  );
}