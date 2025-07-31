import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Send, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePrivateChatStore } from '@/store/private-chat-store';
import { useAuthStore } from '@/store/auth-store';
import AvatarPicker from '@/components/AvatarPicker';
import { PrivateMessage } from '@/types';
import { formatMessageTime } from '@/lib/utils/timeUtils';

export default function PrivateChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const {
    privateMessages,
    currentChatId,
    isLoadingMessages,
    isSendingMessage,
    error,
    fetchPrivateMessages,
    sendPrivateMessage,
    subscribeToPrivateChat,
    unsubscribeFromPrivateChat,
    getPrivateChatById,
    markMessagesAsRead,
    setCurrentChatId,
    clearError,
  } = usePrivateChatStore();

  const [messageText, setMessageText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  
  const chatMessages = privateMessages[id] || [];
  const chat = getPrivateChatById(id);

  useEffect(() => {
    if (id && user?.id) {
      setCurrentChatId(id);
      fetchPrivateMessages(id);
      subscribeToPrivateChat(id, user.id);
      
      // メッセージを既読にする
      markMessagesAsRead(id, user.id);
    }

    return () => {
      if (id) {
        unsubscribeFromPrivateChat(id);
      }
      setCurrentChatId(null);
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (error) {
      Alert.alert('エラー', error);
      clearError();
    }
  }, [error]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user?.id || !id) return;

    const message = messageText.trim();
    setMessageText('');

    try {
      await sendPrivateMessage(id, user.id, message, {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        avatar: user.avatar
      });
      
      // メッセージ送信後に少し下にスクロール
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessageText(message); // 失敗した場合はテキストを復元
    }
  };

  const renderMessage = ({ item }: { item: PrivateMessage }) => {
    const isMyMessage = item.senderId === user?.id;
    
    // 获取发送状态显示文本
    const getStatusText = () => {
      if (!isMyMessage) return '';
      
      switch (item.sendingStatus) {
        case 'sending':
          return '送信中...';
        case 'failed':
          return '送信失敗';
        case 'sent':
        default:
          return formatMessageTime(item.createdAt);
      }
    };
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.otherMessage
      ]}>
        <View style={styles.messageHeader}>
          {!isMyMessage && (
            <AvatarPicker
              currentAvatarUrl={item.sender?.avatar || ''}
              userId={item.senderId}
              size={32}
              editable={false}
            />
          )}
          <View style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            item.sendingStatus === 'sending' && styles.sendingMessageBubble,
            item.sendingStatus === 'failed' && styles.failedMessageBubble
          ]}>
            <Text style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
              item.sendingStatus === 'sending' && styles.sendingMessageText
            ]}>
              {item.message}
            </Text>
          </View>
          {isMyMessage && (
            <AvatarPicker
              currentAvatarUrl={user?.avatar || ''}
              userId={user?.id || ''}
              size={32}
              editable={false}
            />
          )}
        </View>
        <View style={[
          styles.messageTimeContainer,
          isMyMessage ? styles.myMessageTimeContainer : styles.otherMessageTimeContainer
        ]}>
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
            item.sendingStatus === 'failed' && styles.failedMessageTime
          ]}>
            {isMyMessage ? getStatusText() : formatMessageTime(item.createdAt)}
          </Text>
          {item.sendingStatus === 'sending' && isMyMessage && (
            <ActivityIndicator 
              size="small" 
              color={Colors.text.secondary} 
              style={styles.sendingIndicator}
            />
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>メッセージがありません</Text>
      <Text style={styles.emptySubtext}>最初のメッセージを送信してチャットを始めましょう</Text>
    </View>
  );

  if (isLoadingMessages && chatMessages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen 
          options={{
            title: chat?.otherUser?.name || 'プライベートチャット',
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
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Stack.Screen 
        options={{
          title: chat?.otherUser?.name || 'プライベートチャット',
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
        }}
      />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={chatMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="メッセージを入力..."
            multiline
            maxLength={1000}
            placeholderTextColor={Colors.text.secondary}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { opacity: messageText.trim() && !isSendingMessage ? 1 : 0.5 }
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || isSendingMessage}
            activeOpacity={0.7}
          >
            {isSendingMessage ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Send size={20} color="white" />
            )}
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: Colors.text.primary,
  },
  messageTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginHorizontal: 8,
  },
  myMessageTimeContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageTimeContainer: {  
    justifyContent: 'flex-start',
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  otherMessageTime: {
    color: Colors.text.secondary,
    textAlign: 'left',
  },
  failedMessageTime: {
    color: '#FF3B30',
  },
  sendingIndicator: {
    marginLeft: 4,
  },
  sendingMessageBubble: {
    opacity: 0.7,
  },
  failedMessageBubble: {
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  sendingMessageText: {
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});