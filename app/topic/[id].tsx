import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, MessageCircle, Users, Send, ChevronLeft } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useTopicStore } from "@/store/topic-store";
import { useAuthStore } from "@/store/auth-store";
import CommentItem from "@/components/CommentItem";

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentTopic, comments, fetchTopicById, fetchComments, addComment, isLoading } = useTopicStore();
  const [commentText, setCommentText] = useState("");
  
  useEffect(() => {
    if (id) {
      fetchTopicById(id);
      fetchComments(id);
    }
  }, [id]);
  
  const formatDistance = (meters?: number) => {
    if (!meters) return "Unknown distance";
    
    if (meters < 1000) {
      return `${meters.toFixed(0)}m away`;
    } else {
      return `${(meters / 1000).toFixed(1)}km away`;
    }
  };
  
  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const handleSendComment = async () => {
    if (!commentText.trim() || !id || !user) return;
    
    await addComment(id, commentText, user.id);
    setCommentText("");
  };
  
  const handleJoinChat = () => {
    if (id) {
      router.push(`/chat/${id}`);
    }
  };
  
  if (!currentTopic && isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Loading topic...</Text>
      </SafeAreaView>
    );
  }
  
  if (!currentTopic) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Topic not found</Text>
      </SafeAreaView>
    );
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
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={100}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.topicHeader}>
            <Text style={styles.topicTitle}>{currentTopic.title}</Text>
            <View style={styles.authorRow}>
              <Text style={styles.authorName}>{currentTopic.author.name}さんの投稿</Text>
              <Text style={styles.topicTime}>{formatTime(currentTopic.createdAt)}</Text>
            </View>
          </View>
          
          <View style={styles.topicContent}>
            <Text style={styles.topicDescription}>{currentTopic.description}</Text>
            
            <View style={styles.topicMeta}>
              <View style={styles.locationContainer}>
                <MapPin size={14} color={Colors.text.secondary} />
                <Text style={styles.locationText}>
                  {currentTopic.location.name || "不明な場所"} • {formatDistance(currentTopic.distance)}
                </Text>
              </View>
              
              <View style={styles.statsContainer}>
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
                <CommentItem key={comment.id} comment={comment} />
              ))
            )}
          </View>
        </ScrollView>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="コメントを追加..."
            value={commentText}
            onChangeText={setCommentText}
            multiline
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
    marginLeft: 16,
    marginRight: 48, // Account for back button width
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  topicHeader: {
    padding: 16,
  },
  topicTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 8,
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
    backgroundColor: Colors.card,
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  topicDescription: {
    fontSize: 16,
    color: Colors.text.primary,
    lineHeight: 24,
    marginBottom: 16,
  },
  topicMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 4,
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
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  commentTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  chatRoomButton: {
    backgroundColor: 'rgba(91, 114, 242, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chatRoomText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "500",
  },
  noComments: {
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    alignItems: "center",
  },
  noCommentsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.inactive,
  },
  chatButton: {
    padding: 8,
  },
});