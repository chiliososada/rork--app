import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart } from 'lucide-react-native';
import { Comment } from '@/types';
import Colors from '@/constants/colors';
import { CommentAvatar } from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/utils/timeUtils';

interface CommentItemProps {
  comment: Comment;
  onLike?: (commentId: string) => void;
}

export default function CommentItem({ comment, onLike }: CommentItemProps) {
  
  const handleLike = () => {
    if (onLike) {
      onLike(comment.id);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.authorContainer}>
          <CommentAvatar user={comment.author} />
          <Text style={styles.authorName}>{comment.author.name}</Text>
        </View>
        <Text style={styles.time}>{formatMessageTime(comment.createdAt)}</Text>
      </View>
      
      <Text style={styles.text}>{comment.text}</Text>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.likeButton}
          onPress={handleLike}
          activeOpacity={0.7}
        >
          <Heart 
            size={18} 
            color={comment.isLikedByUser ? '#FF6B6B' : Colors.text.secondary}
            fill={comment.isLikedByUser ? '#FF6B6B' : 'transparent'}
          />
          <Text style={styles.likeCount}>{comment.likes}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  time: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  text: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 22,
    marginBottom: 12,
    marginLeft: 42,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 42,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  likeCount: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
});