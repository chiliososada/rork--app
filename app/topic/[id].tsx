import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, MessageCircle, Users, Send, ChevronLeft, Heart, Bookmark } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useTopicDetailStore } from "@/store/topic-detail-store";
import { useAuthStore } from "@/store/auth-store";
import { useLocationStore } from "@/store/location-store";
import CommentItem from "@/components/CommentItem";
import TopicImage from "@/components/TopicImage";
import { formatMessageTime } from "@/lib/utils/timeUtils";

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
    isLoadingComments,
    clearCurrentTopic
  } = useTopicDetailStore();
  const [commentText, setCommentText] = useState("");
  
  useEffect(() => {
    if (id) {
      fetchTopicById(id);
      fetchComments(id);
    }
    
    // Cleanup when component unmounts - only clear comments to prevent flashing
    return () => {
      clearCurrentTopic();
    };
  }, [id, fetchTopicById, fetchComments, clearCurrentTopic]);
  
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
  
  // Show loading only when there's no topic data at all and we're loading
  if (!currentTopic && isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>トピックを読み込み中...</Text>
      </SafeAreaView>
    );
  }
  
  // Show error only when we're not loading and have no topic
  if (!currentTopic && !isLoading) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>トピックが見つかりません</Text>
      </SafeAreaView>
    );
  }
  
  // If we have no current topic but we're not loading, return null to prevent flashing
  if (!currentTopic) {
    return null;
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>トピック詳細</Text>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={handleFavoritePress}
        >
          <Bookmark
            size={24}
            color={currentTopic.isFavorited ? '#007AFF' : Colors.text.secondary}
            fill={currentTopic.isFavorited ? '#007AFF' : 'transparent'}
          />
        </TouchableOpacity>
        
        {/* Loading indicator for topic refresh */}
        {isLoading && currentTopic && currentTopic.id !== id && (
          <View style={styles.headerLoadingIndicator}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        )}
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topicCard}>
            <View style={styles.topicHeader}>
              <Text style={styles.topicTitle}>{currentTopic.title}</Text>
              <View style={styles.authorRow}>
                <Text style={styles.authorName}>{currentTopic.author.name}さんの投稿</Text>
                <Text style={styles.topicTime}>{formatMessageTime(currentTopic.createdAt)}</Text>
              </View>
            </View>
            
            <View style={styles.topicContent}>
              <Text style={styles.topicDescription}>{currentTopic.description}</Text>
              
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
              <TouchableOpacity 
                style={styles.chatRoomButton}
                onPress={handleJoinChat}
              >
                <Text style={styles.chatRoomText}>チャットルームに参加</Text>
              </TouchableOpacity>
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
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="コメントを追加..."
            placeholderTextColor="#999999"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            selectionColor="#007AFF"
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              !commentText.trim() ? styles.sendButtonDisabled : {}
            ]}
            onPress={handleSendComment}
            disabled={!commentText.trim()}
          >
            <Send size={20} color={Colors.text.light} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  favoriteButton: {
    padding: 8,
  },
  headerLoadingIndicator: {
    position: 'absolute',
    right: 60,
    top: '50%',
    marginTop: -10,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
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
  topicTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 12,
    lineHeight: 32,
  },
  authorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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
    paddingTop: 0,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  commentTitle: {
    fontSize: 20,
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
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 16 : 16,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxHeight: 100,
    minHeight: 44,
    fontSize: 16,
    textAlignVertical: 'top',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    color: Colors.text.primary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    marginBottom: 0,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowColor: '#C7C7CC',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  chatButton: {
    padding: 8,
  },
});