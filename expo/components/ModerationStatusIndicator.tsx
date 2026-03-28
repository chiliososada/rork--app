import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ModerationStatus, ModerationReason } from '@/types';

interface ModerationStatusIndicatorProps {
  status?: ModerationStatus;
  reason?: ModerationReason;
  style?: any;
  compact?: boolean; // For smaller displays
}

export default function ModerationStatusIndicator({ 
  status, 
  reason, 
  style,
  compact = false 
}: ModerationStatusIndicatorProps) {
  // Don't show anything for approved content
  if (!status || status === 'approved') {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock size={compact ? 14 : 16} color="#FF9500" />,
          title: '審査中',
          message: getReasonMessage(reason),
          backgroundColor: '#FFF3E0',
          borderColor: '#FFB74D',
          textColor: '#E65100'
        };
      case 'rejected':
        return {
          icon: <XCircle size={compact ? 14 : 16} color="#F44336" />,
          title: '承認されませんでした',
          message: '内容を見直してください',
          backgroundColor: '#FFEBEE',
          borderColor: '#EF5350',
          textColor: '#C62828'
        };
      default:
        return null;
    }
  };

  const getReasonMessage = (reason?: ModerationReason): string => {
    switch (reason) {
      case 'sensitive_words':
        return '不適切な表現が含まれている可能性があります';
      case 'excessive_urls':
        return 'リンクが多すぎる可能性があります';
      case 'duplicate_content':
        return '重複するコンテンツの可能性があります';
      case 'manual_review':
        return '手動審査が必要です';
      default:
        return '内容を確認中です';
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: config.backgroundColor }, style]}>
        <View style={styles.compactContent}>
          {config.icon}
          <Text style={[styles.compactText, { color: config.textColor }]}>
            {config.title}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
        style
      ]}
    >
      <View style={styles.header}>
        {config.icon}
        <Text style={[styles.title, { color: config.textColor }]}>
          {config.title}
        </Text>
      </View>
      
      <Text style={[styles.message, { color: config.textColor }]}>
        {config.message}
      </Text>

      {status === 'pending' && (
        <View style={styles.infoBox}>
          <AlertTriangle size={14} color="#FF9500" />
          <Text style={styles.infoText}>
            承認後、他のユーザーに表示されます
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#FF9500',
    marginLeft: 6,
    flex: 1,
  },
  // Compact styles
  compactContainer: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});

// Helper component for displaying moderation status in topic cards
export function TopicModerationBadge({ 
  status, 
  reason 
}: { 
  status?: ModerationStatus; 
  reason?: ModerationReason;
}) {
  if (!status || status === 'approved') {
    return null;
  }

  return (
    <View style={topicBadgeStyles.container}>
      <Clock size={12} color="#FF9500" />
      <Text style={topicBadgeStyles.text}>審査中</Text>
    </View>
  );
}

const topicBadgeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    top: 8,
    right: 8,
  },
  text: {
    fontSize: 10,
    color: '#FF9500',
    fontWeight: '500',
    marginLeft: 2,
  },
});