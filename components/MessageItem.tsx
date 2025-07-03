import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Message } from '@/types';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';

interface MessageItemProps {
  message: Message;
}

export default function MessageItem({ message }: MessageItemProps) {
  const { user } = useAuthStore();
  const isCurrentUser = user?.id === message.author.id;
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <View style={[
      styles.container,
      isCurrentUser ? styles.currentUserContainer : {}
    ]}>
      {!isCurrentUser && (
        <Image source={{ uri: message.author.avatar }} style={styles.avatar} />
      )}
      
      <View style={[
        styles.bubble,
        isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
      ]}>
        {!isCurrentUser && (
          <Text style={styles.authorName}>{message.author.name}</Text>
        )}
        
        <Text style={[
          styles.text,
          isCurrentUser ? styles.currentUserText : {}
        ]}>
          {message.text}
        </Text>
        
        <Text style={[
          styles.time,
          isCurrentUser ? styles.currentUserTime : {}
        ]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  currentUserContainer: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  currentUserBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  currentUserText: {
    color: Colors.text.light,
  },
  time: {
    fontSize: 10,
    color: Colors.text.secondary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  currentUserTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});