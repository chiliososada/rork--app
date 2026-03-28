import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, MessageCircle, Users, Heart, Award, MoreHorizontal, Flag, Trash2, Shield } from 'lucide-react-native';
import { EnhancedTopic } from '@/types';
import Colors from '@/constants/colors';
import { TopicCardImage } from '@/components/TopicImage';
import { TopicCardAvatar } from '@/components/UserAvatar';
import TopicTags from '@/components/TopicTags';
import { useAuthStore } from '@/store/auth-store';
import { formatChatListTime } from '@/lib/utils/timeUtils';
import { useExploreStore } from '@/store/explore-store';
import { useUserBlocking } from '@/store/blocking-store';
import ReportModal from '@/components/ReportModal';

interface EnhancedTopicCardProps {
  topic: EnhancedTopic;
  showMenuButton?: boolean;
  onDelete?: (topicId: string) => void;
}

function EnhancedTopicCard({ 
  topic, 
  showMenuButton = false, 
  onDelete 
}: EnhancedTopicCardProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { trackInteraction } = useExploreStore();
  const { isUserBlockedSync, blockUserWithConfirmation, unblockUserWithConfirmation } = useUserBlocking();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  // Check if the topic author is blocked
  const isAuthorBlocked = user && topic.author.id !== user.id ? isUserBlockedSync(topic.author.id) : false;
  const isOwnTopic = user?.id === topic.author.id;

  // Initialize block status
  React.useEffect(() => {
    setIsBlocked(isAuthorBlocked);
  }, [isAuthorBlocked]);
  
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m先`;
    } else {
      return `${(meters / 1000).toFixed(1)}km先`;
    }
  };
  
  const handlePress = async () => {
    // トラッキング
    await trackInteraction(topic.id, 'click', topic.category);
    router.push(`/topic/${topic.id}`);
  };

  const handleMenuPress = (e: any) => {
    e.stopPropagation();
    setShowActionMenu(true);
  };

  const handleReportPress = () => {
    setShowActionMenu(false);
    setShowReportModal(true);
  };

  const handleBlockPress = async () => {
    setShowActionMenu(false);
    
    if (isBlocked) {
      // Unblock user
      const success = await unblockUserWithConfirmation(topic.author.id, topic.author.name);
      if (success) {
        setIsBlocked(false);
      }
    } else {
      // Block user
      const success = await blockUserWithConfirmation(topic.author.id, topic.author.name);
      if (success) {
        setIsBlocked(true);
      }
    }
  };

  const closeMenu = () => {
    setShowActionMenu(false);
  };
  
  const handleDeletePress = (e: any) => {
    e.stopPropagation();
    
    Alert.alert(
      "投稿を削除",
      "この投稿を削除しますか？削除した投稿は復元できません。",
      [
        {
          text: "キャンセル",
          style: "cancel"
        },
        {
          text: "削除",
          style: "destructive",
          onPress: () => {
            if (onDelete) {
              onDelete(topic.id);
            }
          }
        }
      ]
    );
  };
  
  // 移除closeMenu函数
  
  return (
    <>
      <TouchableOpacity 
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.header}>
          <View style={styles.authorContainer}>
            <TopicCardAvatar user={topic.author} />
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>{topic.author.name}</Text>
                {/* 统一的徽章区域 */}
                {(topic.isPromoted || topic.contentType === 'challenge') && (
                  <View style={styles.badgeContainer}>
                    {topic.isPromoted && (
                      <View style={styles.inlineBadge}>
                        <Text style={styles.badgeText}>PR</Text>
                      </View>
                    )}
                    {topic.contentType === 'challenge' && (
                      <View style={[styles.inlineBadge, styles.challengeInlineBadge]}>
                        <Award size={10} color="#fff" />
                      </View>
                    )}
                  </View>
                )}
              </View>
              <Text style={styles.time}>{formatChatListTime(topic.createdAt)}</Text>
            </View>
          </View>

          {/* Menu Button - Show only for other users' topics */}
          {!isOwnTopic && !isAuthorBlocked && (
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={handleMenuPress}
              activeOpacity={0.7}
            >
              <MoreHorizontal size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>{topic.title}</Text>
          
          {/* タグのみ表示 */}
          <TopicTags 
            tags={topic.tags}
            style={styles.tagsContainer}
          />
          
          <Text style={styles.description}>
            {topic.description}
          </Text>
          
          {/* 画像 */}
          <TopicCardImage topic={topic} />
        </View>
        
        {/* 推薦理由 - 极简版 */}
        {topic.recommendationReason && (
          <Text style={styles.recommendationText}>
            💡 {topic.recommendationReason}
          </Text>
        )}
        
        <View style={styles.footer}>
          <View style={styles.locationContainer}>
            <MapPin size={14} color={Colors.location} />
            <Text style={styles.locationText}>
              {topic.location.name || '不明な場所'} • {formatDistance(topic.distance || 0)}
            </Text>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Heart 
                size={16} 
                color={topic.isLiked ? Colors.like : Colors.text.tertiary}
                fill={topic.isLiked ? Colors.like : 'transparent'}
              />
              <Text style={[styles.statText, topic.isLiked && { color: Colors.like }]}>
                {topic.likesCount || 0}
              </Text>
            </View>
            
            <View style={styles.stat}>
              <MessageCircle size={16} color={Colors.message} />
              <Text style={styles.statText}>{topic.commentCount}</Text>
            </View>
            
            <View style={styles.stat}>
              <Users size={16} color={Colors.accent} />
              <Text style={styles.statText}>{topic.participantCount}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Action Menu Modal */}
      <Modal
        visible={showActionMenu}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <View style={styles.actionMenu}>
            {isOwnTopic && onDelete && (
              <TouchableOpacity 
                style={styles.actionMenuItem}
                onPress={handleDeletePress}
                activeOpacity={0.7}
              >
                <Trash2 size={20} color={Colors.error} />
                <Text style={styles.deleteText}>削除</Text>
              </TouchableOpacity>
            )}
            
            {!isOwnTopic && (
              <>
                <TouchableOpacity 
                  style={styles.actionMenuItem}
                  onPress={handleReportPress}
                  activeOpacity={0.7}
                >
                  <Flag size={20} color="#FF9500" />
                  <Text style={styles.reportText}>通報</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionMenuItem}
                  onPress={handleBlockPress}
                  activeOpacity={0.7}
                >
                  <Shield size={20} color={isBlocked ? '#34C759' : '#FF3B30'} />
                  <Text style={styles.blockText}>
                    {isBlocked ? 'ブロック解除' : 'ブロック'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            
            <TouchableOpacity 
              style={[styles.actionMenuItem, styles.cancelItem]}
              onPress={closeMenu}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={topic.author.id}
        reportedUserName={topic.author.name}
        contentType="topic"
        contentId={topic.id}
        contentPreview={`${topic.title}: ${topic.description?.substring(0, 100)}...`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
    position: 'relative',
  },
  // 移除了绝对定位的徽章样式
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  authorInfo: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  inlineBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  challengeInlineBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.text.light,
    fontSize: 10,
    fontWeight: '600',
  },
  time: {
    fontSize: 13,
    color: Colors.text.tertiary,
    fontWeight: '400',
  },
  content: {
    marginBottom: 20,
  },
  tagsContainer: {
    marginTop: 6,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
    lineHeight: 24,
  },
  description: {
    fontSize: 15,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginTop: 8,
  },
  recommendationText: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationText: {
    fontSize: 13,
    color: Colors.location,
    marginLeft: 6,
    fontWeight: '500',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 6,
  },
  statText: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
    minWidth: 16,
  },
  menuButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionMenu: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  cancelItem: {
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.error,
    marginLeft: 12,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  reportText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF9500',
    marginLeft: 12,
  },
  blockText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginLeft: 12,
  },
});

// 记忆化组件以优化性能
export default memo(EnhancedTopicCard);