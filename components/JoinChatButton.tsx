import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MessageCircle, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useChatTopicsStore } from '@/store/chat-topics-store';
import { useAuthStore } from '@/store/auth-store';

interface JoinChatButtonProps {
  topicId: string;
  isCreator: boolean;
  isParticipated: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  style?: import('react-native').ViewStyle;
}

export default function JoinChatButton({
  topicId,
  isCreator,
  isParticipated,
  onJoin,
  onLeave,
  style
}: JoinChatButtonProps) {
  const { user } = useAuthStore();
  const { joinTopic } = useChatTopicsStore();
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (!user) return;
    
    // 如果已参加，不执行任何操作（仅显示状态）
    if (isParticipated) {
      onJoin?.(); // 直接进入聊天室
      return;
    }
    
    setIsLoading(true);
    try {
      await joinTopic(topicId, user.id);
      onJoin?.();
    } catch (error) {
      console.error('Failed to join topic:', error);
      // Error toast - user-friendly message in Japanese
      alert('チャットルームへの参加に失敗しました。ネットワーク接続を確認してから再試行してください。');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCreator) {
    return (
      <TouchableOpacity style={[styles.button, styles.creatorButton, style]} disabled>
        <Check size={16} color={Colors.text.light} />
        <Text style={[styles.buttonText, styles.creatorText]}>作成者</Text>
      </TouchableOpacity>
    );
  }

  const buttonStyle = isParticipated 
    ? [styles.button, styles.joinedButton]
    : [styles.button, styles.joinButton];
    
  const textStyle = isParticipated 
    ? [styles.buttonText, styles.joinedText]
    : [styles.buttonText, styles.joinText];

  const icon = isParticipated 
    ? <Check size={16} color={Colors.text.secondary} />
    : <MessageCircle size={16} color={Colors.text.light} />;

  const text = isParticipated ? '参加済みのチャットルーム' : 'チャットに参加';

  return (
    <TouchableOpacity 
      style={[buttonStyle, style]} 
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator size={16} color={isParticipated ? Colors.text.secondary : Colors.text.light} />
      ) : (
        icon
      )}
      <Text style={textStyle}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  joinButton: {
    backgroundColor: Colors.primary,
  },
  joinedButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  creatorButton: {
    backgroundColor: Colors.success,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  joinText: {
    color: Colors.text.light,
  },
  joinedText: {
    color: Colors.text.secondary,
  },
  creatorText: {
    color: Colors.text.light,
  },
});