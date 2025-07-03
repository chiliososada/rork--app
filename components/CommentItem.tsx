import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Heart } from 'lucide-react-native';
import { Comment } from '@/types';
import Colors from '@/constants/colors';

interface CommentItemProps {
  comment: Comment;
  onLike?: (commentId: string) => void;
}

export default function CommentItem({ comment, onLike }: CommentItemProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return `${Math.floor(diffMins / 1440)}d ago`;
    }
  };
  
  const handleLike = () => {
    if (onLike) {
      onLike(comment.id);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.authorContainer}>
          <Image source={{ uri: comment.author.avatar }} style={styles.avatar} />
          <Text style={styles.authorName}>{comment.author.name}</Text>
        </View>
        <Text style={styles.time}>{formatTime(comment.createdAt)}</Text>
      </View>
      
      <Text style={styles.text}>{comment.text}</Text>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.likeButton}
          onPress={handleLike}
          activeOpacity={0.7}
        >
          <Heart 
            size={16} 
            color={Colors.text.secondary}
            fill={comment.likes > 0 ? Colors.secondary : 'transparent'}
          />
          <Text style={styles.likeCount}>{comment.likes}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  time: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  text: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: Colors.background,
  },
  likeCount: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
});