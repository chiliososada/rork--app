import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Share, Platform } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, MessageCircle, Users, Heart, Bookmark, Share2 } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useTopicDetailsStore } from "@/store/topic-details-store";
import { useAuthStore } from "@/store/auth-store";
import { useLocationStore } from "@/store/location-store";
import CommentItem from "@/components/CommentItem";
import CommentInput from "@/components/input/CommentInput";
import TopicImage from "@/components/TopicImage";
import TopicTags from "@/components/TopicTags";
import JoinChatButton from "@/components/JoinChatButton";
import CategoryBadge from "@/components/CategoryBadge";
import { formatMessageTime } from "@/lib/utils/timeUtils";
import FollowButton from "@/components/FollowButton";
import { useFollowStore } from "@/store/follow-store";

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentLocation } = useLocationStore();
  const { 
    currentTopic, 
    comments, 
    fetchTopicById, 
    fetchComments, 
    addComment, 
    likeComment, 
    toggleFavorite, 
    toggleLike, 
    isLoading, 
    clearCurrentTopic,
    error
  } = useTopicDetailsStore();
  const [commentText, setCommentText] = useState("");
  const { fetchFollowStatus } = useFollowStore();
  
  useEffect(() => {
    if (id) {
      fetchTopicById(id);
      fetchComments(id);
    }
    
    // Cleanup when component unmounts
    return () => {
      clearCurrentTopic();
    };
  }, [id, fetchTopicById, fetchComments, clearCurrentTopic]);
  
  // Fetch follow status when topic is loaded
  useEffect(() => {
    if (currentTopic && user?.id && currentTopic.author.id !== user.id) {
      fetchFollowStatus(user.id, [currentTopic.author.id]);
    }
  }, [currentTopic?.author.id, user?.id]);
  
  // Helper function to calculate distance between two coordinates in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const formatDistance = () => {
    if (!currentTopic || !currentLocation) return "距離不明";
    
    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      currentTopic.location.latitude,
      currentTopic.location.longitude
    );
    
    if (distance < 1000) {
      return `${distance.toFixed(0)}m先`;
    } else {
      return `${(distance / 1000).toFixed(1)}km先`;
    }
  };
  
  
  const handleSendComment = async () => {
    if (!commentText.trim() || !id || !user) return;
    
    try {
      await addComment(id, commentText, user.id);
      setCommentText("");
    } catch (error) {
      // Error is handled in the store
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    await likeComment(commentId, user.id);
  };
  
  const handleJoinChat = () => {
    if (id) {
      router.push(`/chat/${id}`);
    }
  };
  
  const handleJoinTopic = () => {
    // 加入成功后可以自动跳转到聊天室
    handleJoinChat();
  };
  
  const handleLeaveTopic = () => {
    // 退出后的处理，可以显示提示或返回上一页
    // 这里暂时不做特殊处理
  };
  
  const handleFavoritePress = async () => {
    if (user?.id && id) {
      await toggleFavorite(id, user.id);
    }
  };
  
  const handleLikePress = async () => {
    if (user?.id && id) {
      await toggleLike(id, user.id);
    }
  };
  
  const handleShare = async () => {
    if (!currentTopic) return;
    
    try {
      const shareUrl = `https://tokyopark.app/topic/${id}`;
      const shareTitle = currentTopic.title;
      const shareDescription = currentTopic.description?.length > 100 
        ? currentTopic.description.substring(0, 100) + '...' 
        : currentTopic.description;
      
      // Android需要将URL包含在message中，iOS可以分别处理
      const shareMessage = Platform.OS === 'android' 
        ? `${shareTitle}\n\n${shareDescription}\n\n話題を見る：${shareUrl}`
        : `${shareTitle}\n\n${shareDescription}`;
      
      const result = await Share.share({
        title: shareTitle,
        message: shareMessage,
        url: Platform.OS === 'ios' ? shareUrl : undefined,
      });

      // 处理分享结果
      if (result.action === Share.sharedAction) {
        console.log('分享成功');
        // 可选：添加分享统计追踪
        // trackInteraction?.(id, 'share');
      } else if (result.action === Share.dismissedAction) {
        console.log('用户取消分享');
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
          ? error 
          : '未知错误';
      console.error('分享失败:', errorMessage);
    }
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>トピックを読み込み中...</Text>
      </SafeAreaView>
    );
  }
  
  // Show error state
  if (!currentTopic && error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>トピックが見つかりません</Text>
      </SafeAreaView>
    );
  }
  
  // Show loading if no topic data yet (but no error)
  if (!currentTopic) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>トピックを読み込み中...</Text>
      </SafeAreaView>
    );
  }
  
  // If we have a topic but it's not the one we're looking for, show loading
  if (currentTopic.id !== id) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>トピックを読み込み中...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Stack.Screen 
        options={{
          title: 'トピック詳細',
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.card,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '600',
            color: Colors.text.primary,
          },
          headerTintColor: Colors.text.primary,
          headerBackTitle: '',
          headerBackVisible: true,
          headerShadowVisible: true,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={{ marginRight: 12 }}
                onPress={handleShare}
              >
                <Share2
                  size={24}
                  color={Colors.text.secondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginRight: 8 }}
                onPress={handleFavoritePress}
              >
                <Bookmark
                  size={24}
                  color={currentTopic.isFavorited ? '#007AFF' : Colors.text.secondary}
                  fill={currentTopic.isFavorited ? '#007AFF' : 'transparent'}
                />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      
      <View style={styles.contentContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topicCard}>
            <View style={styles.topicHeader}>
              <View style={styles.headerTop}>
                <Text style={styles.topicTitle}>{currentTopic.title}</Text>
                {currentTopic.category && (
                  <CategoryBadge 
                    category={currentTopic.category} 
                    size="medium"
                    style={styles.categoryBadge}
                  />
                )}
              </View>
              <View style={styles.authorRow}>
                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>{currentTopic.author.name}さんの投稿</Text>
                  <Text style={styles.topicTime}>{formatMessageTime(currentTopic.createdAt)}</Text>
                </View>
                <FollowButton
                  targetUserId={currentTopic.author.id}
                  size="small"
                  showIcon={false}
                />
              </View>
            </View>
            
            <View style={styles.topicContent}>
              <Text style={styles.topicDescription}>{currentTopic.description}</Text>
              
              {/* Topic Tags */}
              <TopicTags 
                tags={currentTopic.tags} 
                style={styles.topicTags}
              />
              
              {/* Topic Image */}
              <TopicImage 
                topic={currentTopic} 
                size="large" 
                style={styles.topicImage} 
              />
              
              <View style={styles.topicMeta}>
                <View style={styles.locationContainer}>
                  <MapPin size={14} color={Colors.text.secondary} />
                  <Text style={styles.locationText}>
                    {currentTopic.location.name || "不明な場所"} • {formatDistance()}
                  </Text>
                </View>
                
                <View style={styles.statsContainer}>
                  <TouchableOpacity style={styles.stat} onPress={handleLikePress} activeOpacity={0.7}>
                    <Heart 
                      size={14} 
                      color={currentTopic.isLiked ? '#FF6B6B' : Colors.text.secondary}
                      fill={currentTopic.isLiked ? '#FF6B6B' : 'transparent'}
                    />
                    <Text style={[styles.statText, currentTopic.isLiked && { color: '#FF6B6B' }]}>
                      {currentTopic.likesCount || 0}
                    </Text>
                  </TouchableOpacity>
                  
                  <View style={styles.stat}>
                    <MessageCircle size={14} color={Colors.text.secondary} />
                    <Text style={styles.statText}>{comments.length}</Text>
                  </View>
                  
                  <View style={styles.stat}>
                    <Users size={14} color={Colors.text.secondary} />
                    <Text style={styles.statText}>{currentTopic.participantCount}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.commentsSection}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>コメント</Text>
              <JoinChatButton
                topicId={id || ''}
                isCreator={user?.id === currentTopic.author.id}
                isParticipated={currentTopic.isParticipated || false}
                onJoin={handleJoinTopic}
                onLeave={handleLeaveTopic}
              />
            </View>
            
            {comments.length === 0 ? (
              <View style={styles.noComments}>
                <Text style={styles.noCommentsText}>まだコメントがありません。最初のコメントを投稿してみましょう！</Text>
              </View>
            ) : (
              comments.map((comment) => (
                <CommentItem 
                  key={comment.id} 
                  comment={comment} 
                  onLike={handleLikeComment}
                />
              ))
            )}
          </View>
        </ScrollView>
        
        <CommentInput
          value={commentText}
          onChangeText={setCommentText}
          onSend={handleSendComment}
          placeholder="コメントを追加..."
          disabled={false}
          isSending={false}
          maxLength={500}
          showCharacterCount={true}
          autoFocus={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
  },
  topicCard: {
    backgroundColor: Colors.card,
    margin: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  topicHeader: {
    padding: 24,
    paddingBottom: 20,
    backgroundColor: '#FAFAFA',
  },
  headerTop: {
    marginBottom: 12,
  },
  topicTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 8,
    lineHeight: 32,
  },
  categoryBadge: {
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  topicTime: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  topicContent: {
    padding: 24,
    paddingTop: 20,
  },
  topicDescription: {
    fontSize: 16,
    color: Colors.text.primary,
    lineHeight: 26,
    marginBottom: 12,
  },
  topicTags: {
    marginBottom: 16,
  },
  topicImage: {
    marginBottom: 20,
  },
  topicMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  locationText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 4,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  statText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  commentsSection: {
    padding: 16,
    paddingTop: 8,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
  },
  commentTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  chatRoomButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  chatRoomText: {
    fontSize: 13,
    color: Colors.text.light,
    fontWeight: "600",
  },
  noComments: {
    padding: 32,
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    alignItems: "center",
    marginTop: 8,
  },
  noCommentsText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: 24,
  },
});