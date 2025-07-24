import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, MessageCircle, Users, Heart, Bookmark, MoreHorizontal, Trash2 } from 'lucide-react-native';
import { Topic } from '@/types';
import Colors from '@/constants/colors';
import { TopicCardImage } from '@/components/TopicImage';
import { TopicCardAvatar } from '@/components/UserAvatar';
import { useAuthStore } from '@/store/auth-store';
import { formatChatListTime } from '@/lib/utils/timeUtils';
import { TopicInteractionService } from '@/lib/services/topicInteractionService';

interface TopicCardProps {
  topic: Topic;
  onFavoriteToggle?: (topicId: string, isFavorited: boolean) => void;
  onLikeToggle?: (topicId: string, likeData: { isLiked: boolean; count: number }) => void;
  showMenuButton?: boolean;
  onDelete?: (topicId: string) => void;
}

export default function TopicCard({ topic, onFavoriteToggle, onLikeToggle, showMenuButton = false, onDelete }: TopicCardProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m先`;
    } else {
      return `${(meters / 1000).toFixed(1)}km先`;
    }
  };
  
  
  const handlePress = () => {
    router.push(`/topic/${topic.id}`);
  };
  
  const handleFavoritePress = async (e: any) => {
    e.stopPropagation(); // Prevent triggering the topic navigation
    if (!user?.id || isFavoriteLoading) return;
    
    setIsFavoriteLoading(true);
    try {
      const isFavorited = await TopicInteractionService.toggleFavorite(topic.id, user.id);
      
      // 如果有自定义handler，调用它（用于局部更新）
      if (onFavoriteToggle) {
        onFavoriteToggle(topic.id, isFavorited);
      }
      // 事件总线会自动处理跨页面同步
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsFavoriteLoading(false);
    }
  };
  
  const handleLikePress = async (e: any) => {
    e.stopPropagation(); // Prevent triggering the topic navigation
    if (!user?.id || isLikeLoading) return;
    
    setIsLikeLoading(true);
    try {
      const likeData = await TopicInteractionService.toggleLike(topic.id, user.id);
      
      // 如果有自定义handler，调用它（用于局部更新）
      if (onLikeToggle) {
        onLikeToggle(topic.id, likeData);
      }
      // 事件总线会自动处理跨页面同步
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLikeLoading(false);
    }
  };
  
  const handleMenuPress = (e: any) => {
    e.stopPropagation();
    setShowActionMenu(true);
  };
  
  const handleDeletePress = () => {
    setShowActionMenu(false);
    
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
  
  const closeMenu = () => {
    setShowActionMenu(false);
  };
  
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
          <Text style={styles.authorName}>{topic.author.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleFavoritePress}
            disabled={isFavoriteLoading}
            activeOpacity={0.7}
          >
            <Bookmark
              size={18}
              color={topic.isFavorited ? '#007AFF' : Colors.text.secondary}
              fill={topic.isFavorited ? '#007AFF' : 'transparent'}
            />
          </TouchableOpacity>
          <Text style={styles.time}>{formatChatListTime(topic.createdAt)}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{topic.title}</Text>
        <Text style={styles.description}>
          {topic.description}
        </Text>
        
        {/* Topic Image */}
        <TopicCardImage topic={topic} />
      </View>
      
      <View style={styles.footer}>
        <View style={styles.locationContainer}>
          <MapPin size={14} color={Colors.text.secondary} />
          <Text style={styles.locationText}>
            {topic.location.name || '不明な場所'} • {formatDistance(topic.distance || 0)}
          </Text>
        </View>
        
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.stat} onPress={handleLikePress} activeOpacity={0.7}>
            <Heart 
              size={14} 
              color={topic.isLiked ? '#FF6B6B' : Colors.text.secondary}
              fill={topic.isLiked ? '#FF6B6B' : 'transparent'}
            />
            <Text style={[styles.statText, topic.isLiked && { color: '#FF6B6B' }]}>
              {topic.likesCount || 0}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.stat}>
            <MessageCircle size={14} color={Colors.text.secondary} />
            <Text style={styles.statText}>{topic.commentCount}</Text>
          </View>
          
          <View style={styles.stat}>
            <Users size={14} color={Colors.text.secondary} />
            <Text style={styles.statText}>{topic.participantCount}</Text>
          </View>
        </View>
        
        {/* Menu Button */}
        {showMenuButton && (
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={handleMenuPress}
            activeOpacity={0.7}
          >
            <MoreHorizontal size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        )}
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
            <TouchableOpacity 
              style={styles.actionMenuItem}
              onPress={handleDeletePress}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color={Colors.error} />
              <Text style={styles.deleteText}>削除</Text>
            </TouchableOpacity>
            
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  favoriteButton: {
    padding: 4,
    borderRadius: 20,
  },
  time: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  content: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  statText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  menuButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
});