import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useTopicStore } from "@/store/topic-store";
import { useAuthStore } from "@/store/auth-store";
import MessageItem from "@/components/MessageItem";
import { Message } from "@/types";

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { currentTopic, messages, fetchTopicById, fetchMessages, addMessage } = useTopicStore();
  const [messageText, setMessageText] = useState("");
  const [lastSent, setLastSent] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
  useEffect(() => {
    if (id) {
      fetchTopicById(id);
      fetchMessages(id);
      
      // Simulate real-time updates
      const interval = setInterval(() => {
        fetchMessages(id);
      }, 5000);
      
      return () => clearInterval(interval);
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
    if (!messageText.trim() || !id || !user) return;
    
    // Rate limiting
    const now = Date.now();
    if (now - lastSent < 5000) {
      alert("Please wait a few seconds before sending another message");
      return;
    }
    
    await addMessage(id, messageText, user.id);
    setMessageText("");
    setLastSent(now);
  };
  
  const renderMessage = ({ item }: { item: Message }) => {
    return <MessageItem message={item} />;
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{
          title: currentTopic?.title || "Chat Room",
        }} 
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={100}
      >
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
              </View>
            }
          />
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
            />
            <TouchableOpacity 
              style={[
                styles.sendButton,
                !messageText.trim() ? styles.sendButtonDisabled : {}
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim()}
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