import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Heart, MoreHorizontal, Flag } from 'lucide-react-native';
import { Comment } from '@/types';
import Colors from '@/constants/colors';
import { CommentAvatar } from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/utils/timeUtils';
import { useAuthStore } from '@/store/auth-store';
import { useUserBlockStatus } from '@/hooks/useContentFilter';
import ReportModal from '@/components/ReportModal';

interface CommentItemProps {
  comment: Comment;
  onLike?: (commentId: string) => void;
}

export default function CommentItem({ comment, onLike }: CommentItemProps) {
  const { user } = useAuthStore();
  const { isBlocked } = useUserBlockStatus(comment.author.id);
  const [showReportModal, setShowReportModal] = useState(false);
  
  const isOwnComment = user?.id === comment.author.id;
  
  const handleLike = () => {
    if (onLike) {
      onLike(comment.id);
    }
  };

  const handleLongPress = () => {
    if (isOwnComment || isBlocked) return;
    
    Alert.alert(
      'コメントオプション',
      `${comment.author.name}さんのコメントに対する操作を選択してください`,
      [
        {
          text: 'コメントを通報',
          onPress: () => setShowReportModal(true),
          style: 'destructive',
        },
        {
          text: 'キャンセル',
          style: 'cancel',
        },
      ]
    );
  };

  // Don't render if author is blocked
  if (isBlocked) {
    return null;
  }
  
  return (
    <>
      <TouchableOpacity 
        style={styles.container}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
        disabled={isOwnComment}
      >
        <View style={styles.header}>
          <View style={styles.authorContainer}>
            <CommentAvatar user={comment.author} />
            <Text style={styles.authorName}>{comment.author.name}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.time}>{formatMessageTime(comment.createdAt)}</Text>
            {!isOwnComment && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={handleLongPress}
                activeOpacity={0.7}
              >
                <MoreHorizontal size={16} color={Colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
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
      </TouchableOpacity>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={comment.author.id}
        reportedUserName={comment.author.name}
        contentType="comment"
        contentId={comment.id}
        contentPreview={comment.text.substring(0, 100)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 3,
    backgroundColor: Colors.card,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  time: {
    fontSize: 11,
    color: Colors.text.secondary,
    opacity: 0.8,
  },
  text: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 8,
    marginLeft: 36,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    minWidth: 44,
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
  },
  likeCount: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginLeft: 3,
    fontWeight: '500',
  },
  moreButton: {
    padding: 4,
    borderRadius: 8,
  },
});