import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, ChevronLeft } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useTopicStore } from "@/store/topic-store";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import MessageItem from "@/components/MessageItem";
import { Message } from "@/types";

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentTopic, fetchTopicById } = useTopicStore();
  const { 
    getMessagesForTopic, 
    fetchMessages, 
    addMessage, 
    subscribeToTopic, 
    unsubscribeFromTopic,
    setCurrentTopic,
    isSending,
    isLoading 
  } = useChatStore();
  
  const [messageText, setMessageText] = useState("");
  const [lastSent, setLastSent] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
  // 現在のトピックのメッセージを取得
  const messages = id ? getMessagesForTopic(id) : [];
  
  useEffect(() => {
    if (id) {
      // トピック情報を取得
      fetchTopicById(id);
      
      // 現在のトピックを設定
      setCurrentTopic(id);
      
      // メッセージを取得
      fetchMessages(id);
      
      // Realtimeサブスクリプションを開始
      subscribeToTopic(id);
      
      // クリーンアップ関数でサブスクリプションを解除
      return () => {
        unsubscribeFromTopic(id);
        setCurrentTopic(null);
      };
    }
  }, [id]);
  
  useEffect(() => {
    // Scroll to bottom when messages change
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);
  
  const handleSendMessage = async () => {
    if (!messageText.trim() || !id || !user || isSending) return;
    
    // Rate limiting
    const now = Date.now();
    if (now - lastSent < 3000) {
      alert("数秒待ってから次のメッセージを送信してください");
      return;
    }
    
    try {
      await addMessage(id, messageText, user.id);
      setMessageText("");
      setLastSent(now);
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
    }
  };
  
  const renderMessage = ({ item }: { item: Message }) => {
    return <MessageItem message={item} />;
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        <Text style={styles.headerTitle}>{currentTopic?.title || "チャットルーム"}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.messagesList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>まだメッセージがありません。会話を始めましょう！</Text>
              </View>
            }
          />
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="メッセージを入力..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
            />
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!messageText.trim() || isSending) ? styles.sendButtonDisabled : {}
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || isSending}
            >
              <Send size={20} color={Colors.text.light} />
            </TouchableOpacity>
          </View>
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
  placeholder: {
    width: 40,
    height: 40,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 16 : 16,
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
});