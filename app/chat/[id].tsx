import React, { useEffect, useState, useRef, useCallback } from "react";
import { StyleSheet, Text, View, FlatList, Modal, TouchableOpacity, TextInput } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, Users, X } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { useLocationStore } from "@/store/location-store";
import MessageItem from "@/components/MessageItem";
import DateSeparator from "@/components/DateSeparator";
import ChatInput from "@/components/input/ChatInput";
import { Message, Topic } from "@/types";
import { groupMessagesByDate, MessageGroup } from "@/lib/utils/timeUtils";
import { TopicDetailService } from "@/lib/services/topicDetailService";

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [currentTopic, setCurrentTopicState] = useState<Topic | null>(null);
  const [topicLoading, setTopicLoading] = useState(false);
  const { currentLocation } = useLocationStore();
  const { 
    getMessagesForTopic, 
    fetchMessages, 
    addMessage, 
    initializeGlobalConnection,
    updateUserTopics,
    setCurrentTopic,
    sendTypingIndicator,
    stopTypingIndicator,
    getTypingUsers,
    markAsRead,
    quotedMessage,
    setQuotedMessage,
    getOnlineUsers,
    updateUserPresence,
    removeUserPresence,
    searchMessages,
    clearSearch,
    searchQuery,
    searchResults,
    isSending,
    isLoading,
    isConnected,
    getConnectionStatus 
  } = useChatStore();
  
  const [messageText, setMessageText] = useState("");
  const [lastSent, setLastSent] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  
  // 入力中のユーザーを取得
  const typingUsers = id ? getTypingUsers(id).filter(t => t.userId !== user?.id) : [];
  
  // オンラインユーザーを取得（右上角のバッジ用、現在のユーザーを除外）
  const onlineUsers = id ? getOnlineUsers(id).filter(u => u.userId !== user?.id) : [];
  
  // モーダル用のオンラインユーザーリスト（現在のユーザーを含む）
  const allOnlineUsers = id ? getOnlineUsers(id) : [];
  // 現在のユーザーがリストにない場合は追加
  const onlineUsersForModal = user && id ? [
    ...allOnlineUsers,
    ...(allOnlineUsers.some(u => u.userId === user.id) ? [] : [{ userId: user.id, name: user.name }])
  ] : allOnlineUsers;
  
  // 現在のトピックのメッセージを取得
  const messages = id ? getMessagesForTopic(id) : [];
  
  // メッセージを日付でグループ化
  const messageGroups = groupMessagesByDate(messages);
  
  // 日付分隔符と消息を平展的な配列に結合
  const flattenedItems = messageGroups.reduce((acc: any[], group: MessageGroup) => {
    // 日期分隔符
    acc.push({
      type: 'date-separator',
      id: `date-${group.date.getTime()}`,
      dateString: group.dateString,
    });
    
    // 该日期的所有消息
    group.messages.forEach(message => {
      acc.push({
        type: 'message',
        ...message,
      });
    });
    
    return acc;
  }, []);
  
  // 接続状態を取得
  const connectionState = getConnectionStatus();
  
  // 独立したトピック詳細取得関数
  const loadTopicDetail = async () => {
    if (!id || !user) return;
    
    setTopicLoading(true);
    try {
      const topic = await TopicDetailService.fetchFullTopicDetail(
        id,
        user.id,
        currentLocation?.latitude,
        currentLocation?.longitude
      );
      setCurrentTopicState(topic);
    } catch (error) {
      console.error('Failed to load topic detail:', error);
    } finally {
      setTopicLoading(false);
    }
  };
  
  useEffect(() => {
    const initializeConnection = async () => {
      if (user?.id && !isConnected()) {
        await initializeGlobalConnection(user.id);
      }
      
      // 更新用户presence状态
      setTimeout(() => {
        if (user?.id && id) {
          updateUserPresence(id, user.id, user.nickname || user.name);
        }
      }, 1000);
    };
    
    if (id && user) {
      // トピック情報を独立して取得
      loadTopicDetail();
      
      // 現在のトピックを設定
      setCurrentTopic(id);
      
      // メッセージを取得
      fetchMessages(id);
      
      // 既読マーク
      markAsRead(id);
      
      // 全局连接初始化（非同期）
      initializeConnection();
      
      // 定期的にプレゼンス状態を更新 (20秒毎)
      const presenceInterval = setInterval(() => {
        if (user?.id && id) {
          updateUserPresence(id, user.id, user.nickname || user.name);
        }
      }, 20000);
      
      // クリーンアップ関数
      return () => {
        // ユーザーのオンライン状態を削除
        if (user?.id && id) {
          removeUserPresence(id, user.id);
        }
        clearInterval(presenceInterval);
        setCurrentTopic(null);
      };
    }
  }, [id, user, currentLocation, initializeGlobalConnection, isConnected, updateUserPresence, removeUserPresence, setCurrentTopic, fetchMessages, markAsRead]);
  
  useEffect(() => {
    // Scroll to bottom when messages change, but only if user is already at bottom
    if (flatListRef.current && messages.length > 0 && isAtBottom) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isAtBottom]);
  
  // チャット画面がアクティブな時は既読マーク
  const handleMarkAsRead = useCallback(() => {
    if (id) {
      markAsRead(id);
    }
  }, [id, markAsRead]);
  
  useEffect(() => {
    handleMarkAsRead();
  }, [handleMarkAsRead]);
  
  // メッセージが変更された時も既読マークを更新（頻度制限付き）
  useEffect(() => {
    if (messages.length > 0) {
      const timeoutId = setTimeout(() => {
        handleMarkAsRead();
      }, 1000); // 1秒遅延
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, handleMarkAsRead]);
  
  const handleTextChange = (text: string) => {
    setMessageText(text);
    
    // 入力時に最下部にスクロール（キーボードが表示されても最新メッセージが見える）
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      setIsAtBottom(true);
    }
    
    if (!id || !user) return;
    
    // 入力中インジケーターを送信
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      sendTypingIndicator(id, user.id, user.name);
    }
    
    // タイピングタイマーをリセット
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    const timeout = setTimeout(() => {
      setIsTyping(false);
      stopTypingIndicator(id, user.id);
    }, 2000);
    
    setTypingTimeout(timeout);
  };
  
  const handleSendMessage = async () => {
    if (!messageText.trim() || !id || !user || isSending) return;
    
    // Rate limiting
    const now = Date.now();
    if (now - lastSent < 3000) {
      alert("数秒待ってから次のメッセージを送信してください");
      return;
    }
    
    // 入力中インジケーターを停止
    if (isTyping) {
      setIsTyping(false);
      stopTypingIndicator(id, user.id);
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    }
    
    try {
      let finalText = messageText;
      
      // 引用返信がある場合、メッセージに含める
      if (quotedMessage) {
        finalText = `> ${quotedMessage.author.name}: ${quotedMessage.text}\n\n${messageText}`;
        setQuotedMessage(null);
      }
      
      await addMessage(id, finalText, user.id);
      setMessageText("");
      setLastSent(now);
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
    }
  };
  
  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'date-separator') {
      return <DateSeparator dateString={item.dateString} />;
    } else if (item.type === 'message') {
      return <MessageItem message={item} />;
    }
    return null;
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Stack.Screen 
        options={{
          title: topicLoading ? "読み込み中..." : (currentTopic?.title || "チャットルーム"),
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
              <View style={[{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginRight: 12,
              }, 
                connectionState === 'connected' ? { backgroundColor: '#4CAF50' } :
                connectionState === 'connecting' ? { backgroundColor: '#FF9800' } :
                connectionState === 'error' ? { backgroundColor: '#F44336' } :
                { backgroundColor: '#9E9E9E' }
              ]} />
              <TouchableOpacity 
                style={{ marginRight: 8 }}
                onPress={() => setShowOnlineUsers(true)}
              >
                <Users size={20} color={Colors.text.primary} />
                {onlineUsers.length > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    backgroundColor: '#FF3B30',
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      color: 'white',
                      fontSize: 10,
                      fontWeight: '600',
                    }}>{onlineUsers.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ marginRight: 8 }}
                onPress={() => setShowSearch(true)}
              >
                <Search size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      
      <View style={styles.chatContainer}>
        <FlatList
          ref={flatListRef}
          data={flattenedItems}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.messagesList}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
            setIsAtBottom(isNearBottom);
          }}
          scrollEventThrottle={100}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>まだメッセージがありません。会話を始めましょう！</Text>
            </View>
          }
        />
        
        <ChatInput
          value={messageText}
          onChangeText={handleTextChange}
          onSend={handleSendMessage}
          placeholder="メッセージを入力..."
          disabled={false}
          isSending={isSending}
          quotedMessage={quotedMessage}
          onCancelQuote={() => setQuotedMessage(null)}
          typingUsers={typingUsers}
          maxLength={1000}
          showCharacterCount={false}
        />
      </View>
      
      {/* 検索モーダル */}
      <Modal
        visible={showSearch}
        animationType="slide"
        onRequestClose={() => {
          setShowSearch(false);
          clearSearch();
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.searchHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowSearch(false);
                clearSearch();
              }}
            >
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>メッセージ検索</Text>
          </View>
          
          <View style={styles.searchInputContainer}>
            <Search size={20} color={Colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="メッセージを検索..."
              value={searchQuery}
              onChangeText={(text) => id && searchMessages(id, text)}
              autoFocus
            />
          </View>
          
          <FlatList
            data={searchResults}
            renderItem={({ item }) => <MessageItem message={item} />}
            keyExtractor={(item, index) => `search-${item.id}-${index}`}
            contentContainerStyle={styles.searchResults}
            ListEmptyComponent={
              searchQuery ? (
                <Text style={styles.noResultsText}>検索結果が見つかりません</Text>
              ) : (
                <Text style={styles.searchHintText}>キーワードを入力してメッセージを検索</Text>
              )
            }
          />
        </SafeAreaView>
      </Modal>
      
      {/* オンラインユーザーモーダル */}
      <Modal
        visible={showOnlineUsers}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOnlineUsers(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowOnlineUsers(false)}
        >
          <View style={styles.onlineUsersModal}>
            <View style={styles.onlineUsersHeader}>
              <Text style={styles.onlineUsersTitle}>オンラインユーザー</Text>
              <TouchableOpacity
                onPress={() => setShowOnlineUsers(false)}
              >
                <X size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            {onlineUsersForModal.length > 0 ? (
              onlineUsersForModal.map((onlineUser, index) => (
                <View key={index} style={styles.onlineUserItem}>
                  <View style={styles.onlineIndicator} />
                  <Text style={styles.onlineUserName}>
                    {onlineUser.name}{onlineUser.userId === user?.id ? " (あなた)" : ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noOnlineUsersText}>現在オンラインのユーザーはいません</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  searchResults: {
    padding: 16,
  },
  noResultsText: {
    textAlign: 'center',
    color: Colors.text.secondary,
    fontSize: 16,
    marginTop: 40,
  },
  searchHintText: {
    textAlign: 'center',
    color: Colors.text.secondary,
    fontSize: 14,
    marginTop: 40,
  },
  onlineUsersModal: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    minWidth: 250,
    maxHeight: 400,
  },
  onlineUsersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  onlineUsersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  onlineUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginRight: 12,
  },
  onlineUserName: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  noOnlineUsersText: {
    textAlign: 'center',
    color: Colors.text.secondary,
    fontSize: 14,
    paddingVertical: 20,
  },
});