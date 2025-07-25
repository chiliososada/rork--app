import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, MessageCircle, Users, Heart, Bookmark, Trash2, Edit3, Award } from 'lucide-react-native';
import { EnhancedTopic } from '@/types';
import Colors from '@/constants/colors';
import { TopicCardImage } from '@/components/TopicImage';
import { TopicCardAvatar } from '@/components/UserAvatar';
import TopicTags from '@/components/TopicTags';
import { useAuthStore } from '@/store/auth-store';
import { formatChatListTime } from '@/lib/utils/timeUtils';
import { useExploreStore } from '@/store/explore-store';

interface EnhancedTopicCardProps {
  topic: EnhancedTopic;
  onSimilarPost?: (topic: EnhancedTopic) => void;
  showMenuButton?: boolean;
  onDelete?: (topicId: string) => void;
}

export default function EnhancedTopicCard({ 
  topic, 
  onSimilarPost,
  showMenuButton = false, 
  onDelete 
}: EnhancedTopicCardProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { trackInteraction, categories } = useExploreStore();
  
  // 获取分类图标
  const getCategoryIcon = (categoryKey?: string) => {
    if (!categoryKey || !categories) return null;
    const category = categories.find(cat => cat.categoryKey === categoryKey);
    return category?.iconEmoji || null;
  };
  
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
  
  
  const handleSimilarPost = async (e: any) => {
    e.stopPropagation();
    await trackInteraction(topic.id, 'similar_post', topic.category);
    if (onSimilarPost) {
      onSimilarPost(topic);
    }
  };
  
  // 移除handleMenuPress函数
  
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
        {/* PRバッジ */}
        {topic.isPromoted && (
          <View style={styles.promotedBadge}>
            <Text style={styles.promotedText}>PR</Text>
          </View>
        )}
        
        {/* チャレンジバッジ */}
        {topic.contentType === 'challenge' && (
          <View style={styles.challengeBadge}>
            <Award size={12} color="#fff" />
            <Text style={styles.challengeText}>チャレンジ</Text>
          </View>
        )}
        
        <View style={styles.header}>
          <View style={styles.authorContainer}>
            <TopicCardAvatar user={topic.author} />
            <Text style={styles.authorName}>{topic.author.name}</Text>
          </View>
          
          <View style={styles.headerCenter}>
            {getCategoryIcon(topic.category) && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryIcon}>{getCategoryIcon(topic.category)}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.headerRight}>
            <Text style={styles.time}>{formatChatListTime(topic.createdAt)}</Text>
          </View>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>{topic.title}</Text>
          
          {/* タグ - 标题正下方 */}
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
        
        {/* 推薦理由 - 优化版 */}
        {topic.recommendationReason && (
          <View style={styles.recommendationContainer}>
            <Text style={styles.recommendationText}>
              💡 {topic.recommendationReason}
            </Text>
          </View>
        )}
        
        <View style={styles.footer}>
          <View style={styles.leftSection}>
            <View style={styles.locationContainer}>
              <MapPin size={12} color={Colors.text.secondary} />
              <Text style={styles.locationText}>
                {topic.location.name || '不明な場所'} • {formatDistance(topic.distance || 0)}
              </Text>
            </View>
          </View>
          
          <View style={styles.centerSection}>
            <View style={styles.stat}>
              <Heart 
                size={14} 
                color={topic.isLiked ? '#FF6B6B' : Colors.text.secondary}
                fill={topic.isLiked ? '#FF6B6B' : 'transparent'}
              />
              <Text style={[styles.statText, topic.isLiked && { color: '#FF6B6B' }]}>
                {topic.likesCount || 0}
              </Text>
            </View>
            
            <View style={styles.stat}>
              <MessageCircle size={14} color={Colors.text.secondary} />
              <Text style={styles.statText}>{topic.commentCount}</Text>
            </View>
            
            <View style={styles.stat}>
              <Users size={14} color={Colors.text.secondary} />
              <Text style={styles.statText}>{topic.participantCount}</Text>
            </View>
          </View>
          
          <View style={styles.rightSection}>
            {/* 似たような投稿ボタン */}
            {onSimilarPost && (
              <TouchableOpacity 
                style={styles.similarPostButton}
                onPress={handleSimilarPost}
                activeOpacity={0.7}
              >
                <Edit3 size={12} color={Colors.primary} />
                <Text style={styles.similarPostText}>似たような</Text>
              </TouchableOpacity>
            )}
            
            {/* 削除ボタン（自分の投稿のみ） */}
            {showMenuButton && user?.id === topic.author.id && (
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={handleDeletePress}
                activeOpacity={0.7}
              >
                <Trash2 size={12} color={Colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      {/* 移除了Modal */}
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
  promotedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 1,
  },
  promotedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  challengeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FFB347',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 1,
    gap: 4,
  },
  challengeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
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
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  categoryBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  time: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  content: {
    marginBottom: 12,
  },
  categoryIcon: {
    fontSize: 16,
    fontWeight: '600',
  },
  tagsContainer: {
    marginTop: 6,
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
  recommendationContainer: {
    backgroundColor: Colors.primary + '08',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  recommendationText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  leftSection: {
    flex: 1,
  },
  centerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  statText: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginLeft: 2,
  },
  similarPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  similarPostText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  deleteButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: Colors.error + '10',
  },
  // 移除了所有Modal相关的样式
});