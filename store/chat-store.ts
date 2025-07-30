import { create } from 'zustand';
import { Message } from '@/types';
import { supabase } from '@/lib/supabase';
import { encryptMessage, decryptMessage, isEncrypted } from '@/lib/encryption';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withNetworkRetry, withDatabaseRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, MessageEvent } from '@/lib/event-bus';
import { getUserTopicIds } from '@/lib/user-topics';

interface ChatState {
  // メッセージの状態管理
  messages: Record<string, Message[]>; // topicId -> Message[]
  messageIds: Record<string, Set<string>>; // topicId -> Set<messageId> for faster duplicate checking
  currentTopicId: string | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  
  // 入力中インジケーター
  typingUsers: Record<string, Record<string, { name: string; timestamp: number }>>; // topicId -> userId -> typing info
  
  // 未読メッセージカウント
  unreadCounts: Record<string, number>; // topicId -> count
  lastReadTimestamps: Record<string, string>; // topicId -> timestamp
  
  // リアクション機能
  messageReactions: Record<string, Record<string, string[]>>; // messageId -> emoji -> userId[]
  
  // 通知設定
  soundEnabled: boolean;
  
  // 引用返信機能
  quotedMessage: Message | null;
  
  // オンラインユーザー機能
  onlineUsers: Record<string, Record<string, { name: string; timestamp: number }>>; // topicId -> userId -> user info
  
  // 検索機能
  searchQuery: string;
  searchResults: Message[];
  
  // 单一全局连接管理
  globalChannel: import('@supabase/supabase-js').RealtimeChannel | null;
  isGlobalChannelConnected: boolean;
  userParticipatingTopics: Set<string>; // 用户参与的所有topic ID
  currentUserId: string | null;
  
  // メッセージ管理機能
  fetchMessages: (topicId: string) => Promise<void>;
  addMessage: (topicId: string, text: string, userId: string) => Promise<void>;
  clearMessages: (topicId: string) => void;
  clearAllMessages: () => void;
  
  // 全局连接管理
  initializeGlobalConnection: (userId: string) => Promise<void>;
  disconnectGlobalConnection: () => void;
  updateUserTopics: (userId: string) => Promise<void>;
  routeMessage: (message: any) => void;
  
  // 入力中インジケーター機能
  sendTypingIndicator: (topicId: string, userId: string, userName: string) => void;
  stopTypingIndicator: (topicId: string, userId: string) => void;
  getTypingUsers: (topicId: string) => Array<{ userId: string; name: string }>;
  
  // 未読メッセージ機能
  markAsRead: (topicId: string) => void;
  getUnreadCount: (topicId: string) => number;
  refreshUnreadCounts: () => Promise<void>;
  fetchUnreadCountsForTopics: (topicIds: string[], currentUserId: string) => Promise<void>;
  
  // リアクション機能
  addReaction: (messageId: string, emoji: string, userId: string) => void;
  removeReaction: (messageId: string, emoji: string, userId: string) => void;
  getMessageReactions: (messageId: string) => Record<string, string[]>;
  
  // 通知機能
  setSoundEnabled: (enabled: boolean) => void;
  playNotificationSound: () => Promise<void>;
  
  // 引用返信機能
  setQuotedMessage: (message: Message | null) => void;
  
  // オンラインユーザー機能
  updateUserPresence: (topicId: string, userId: string, userName: string) => void;
  removeUserPresence: (topicId: string, userId: string) => void;
  getOnlineUsers: (topicId: string) => Array<{ userId: string; name: string }>;
  
  // 検索機能
  searchMessages: (topicId: string, query: string) => void;
  clearSearch: () => void;
  
  // ユーティリティ
  setCurrentTopic: (topicId: string | null) => void;
  getMessagesForTopic: (topicId: string) => Message[];
  getMessageCount: (topicId: string) => number;
  
  // 连接状态管理
  isConnected: () => boolean;
  getConnectionStatus: () => 'connected' | 'connecting' | 'disconnected';
}

// 辅助函数：安全地添加消息到状态中，避免重复
const addMessageToState = (state: ChatState, topicId: string, newMessage: Message): ChatState => {
  // 初始化该话题的消息数组和ID集合（如果不存在）
  if (!state.messages[topicId]) {
    state.messages[topicId] = [];
  }
  if (!state.messageIds[topicId]) {
    state.messageIds[topicId] = new Set();
  }
  
  // 检查消息是否已存在
  if (state.messageIds[topicId].has(newMessage.id)) {
    console.log(`消息 ${newMessage.id} 已存在，跳过添加`);
    return state;
  }
  
  // 添加消息
  const updatedMessages = [...state.messages[topicId], newMessage];
  const updatedMessageIds = new Set(state.messageIds[topicId]);
  updatedMessageIds.add(newMessage.id);
  
  return {
    ...state,
    messages: {
      ...state.messages,
      [topicId]: updatedMessages
    },
    messageIds: {
      ...state.messageIds,
      [topicId]: updatedMessageIds
    }
  };
};

export const useChatStore = create<ChatState>((set, get) => ({
  // 初期状態
  messages: {},
  messageIds: {},
  currentTopicId: null,
  isLoading: false,
  isSending: false,
  error: null,
  typingUsers: {},
  unreadCounts: {},
  lastReadTimestamps: {},
  messageReactions: {},
  soundEnabled: true,
  quotedMessage: null,
  onlineUsers: {},
  searchQuery: '',
  searchResults: [],
  
  // 单一全局连接的初始状态
  globalChannel: null,
  isGlobalChannelConnected: false,
  userParticipatingTopics: new Set(),
  currentUserId: null,

  // メッセージを取得
  fetchMessages: async (topicId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // Supabaseからメッセージを取得
      const messagesData = await withNetworkRetry(async () => {
        const { data, error } = await supabase
          .from('chat_messages')
          .select(`
            *,
            users!chat_messages_user_id_fkey (
              id,
              nickname,
              avatar_url,
              email
            )
          `)
          .eq('topic_id', topicId)
          .order('created_at', { ascending: true });

        if (error) {
          throw error;
        }
        
        return data;
      });

      // メッセージを復号化してローカル形式に変換
      const messages: Message[] = (messagesData || []).map(message => {
        let decryptedText: string;
        try {
          decryptedText = isEncrypted(message.message) 
            ? decryptMessage(message.message) 
            : message.message;
        } catch (error) {
          console.warn('メッセージの復号化に失敗:', error);
          decryptedText = message.message;
        }
        
        return {
          id: message.id,
          text: decryptedText,
          createdAt: message.created_at,
          author: {
            id: message.users.id,
            name: message.users.nickname,
            avatar: message.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.users.nickname)}&background=random`,
            email: message.users.email
          },
          topicId: message.topic_id
        };
      });

      // 该话题的消息ID集合
      const messageIdSet = new Set(messages.map(msg => msg.id));
      
      // 更新该话题的消息和ID集合
      set(state => ({
        messages: {
          ...state.messages,
          [topicId]: messages
        },
        messageIds: {
          ...state.messageIds,
          [topicId]: messageIdSet
        },
        isLoading: false
      }));

    } catch (error: any) {
      console.error('メッセージの取得に失敗:', error);
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : "メッセージの取得に失敗しました";
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
    }
  },

  // メッセージを送信
  addMessage: async (topicId: string, text: string, userId: string) => {
    set({ isSending: true, error: null });
    
    try {
      const insertedMessage = await withDatabaseRetry(async () => {
        // メッセージを暗号化
        const encryptedText = encryptMessage(text);
        
        // Supabaseにメッセージを挿入
        const { data, error } = await supabase
          .from('chat_messages')
          .insert([
            {
              topic_id: topicId,
              user_id: userId,
              message: encryptedText
            }
          ])
          .select(`
            *,
            users!chat_messages_user_id_fkey (
              id,
              nickname,
              avatar_url,
              email
            )
          `)
          .single();

        if (error) {
          throw error;
        }
        
        return data;
      });

      // 送信成功後、ローカルステートに追加（復号化済み）
      const newMessage: Message = {
        id: insertedMessage.id,
        text: text, // 暗号化前のテキストを使用
        createdAt: insertedMessage.created_at,
        author: {
          id: insertedMessage.users.id,
          name: insertedMessage.users.nickname,
          avatar: insertedMessage.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(insertedMessage.users.nickname)}&background=random`,
          email: insertedMessage.users.email
        },
        topicId: insertedMessage.topic_id
      };

      set(state => {
        const updatedState = addMessageToState(state, topicId, newMessage);
        return {
          ...updatedState,
          isSending: false
        };
      });
      
      // Emit event for other stores to update topic info
      eventBus.emit(EVENT_TYPES.MESSAGE_SENT, { 
        topicId, 
        userId,
        messageTime: newMessage.createdAt
      } as MessageEvent);

    } catch (error: any) {
      console.error('メッセージの送信に失敗:', error);
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : "メッセージの送信に失敗しました";
      set({ 
        error: errorMessage, 
        isSending: false 
      });
      throw error;
    }
  },

  // 特定トピックのメッセージをクリア
  clearMessages: (topicId: string) => {
    set(state => {
      const newMessages = { ...state.messages };
      const newMessageIds = { ...state.messageIds };
      delete newMessages[topicId];
      delete newMessageIds[topicId];
      return { 
        messages: newMessages,
        messageIds: newMessageIds 
      };
    });
  },

  // 全てのメッセージをクリア
  clearAllMessages: () => {
    set({ 
      messages: {},
      messageIds: {}
    });
  },

  // 初始化全局连接
  initializeGlobalConnection: async (userId: string) => {
    const { globalChannel, isGlobalChannelConnected } = get();
    
    // 如果已经连接，先断开
    if (globalChannel && isGlobalChannelConnected) {
      get().disconnectGlobalConnection();
    }
    
    try {
      // 更新当前用户ID
      set({ currentUserId: userId });
      
      // 获取用户参与的所有topic
      await get().updateUserTopics(userId);
      
      const { userParticipatingTopics } = get();
      const topicArray = Array.from(userParticipatingTopics);
      
      if (topicArray.length === 0) {
        console.log('用户暂无参与的topic，跳过连接初始化');
        return;
      }
      
      console.log(`初始化全局连接，监听 ${topicArray.length} 个topics`);
      
      // 创建全局channel
      const channel = supabase
        .channel('global_user_chat')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `topic_id=in.(${topicArray.join(',')})`
          },
          async (payload) => {
            try {
              get().routeMessage(payload.new);
            } catch (error) {
              // 静默处理消息路由错误
            }
          }
        )
        .on('broadcast', { event: 'message' }, (payload) => {
          
          if (payload.payload && payload.payload.type === 'chat_message') {
            const broadcastMessage = payload.payload;
            const topicId = broadcastMessage.topic_id;
            
            if (topicId && userParticipatingTopics.has(topicId)) {
              const newMessage: Message = {
                id: broadcastMessage.id || `broadcast-${Date.now()}`,
                text: broadcastMessage.text || broadcastMessage.message,
                createdAt: broadcastMessage.created_at || new Date().toISOString(),
                author: {
                  id: broadcastMessage.user_id || 'broadcast-user',
                  name: broadcastMessage.user_name || '管理者',
                  avatar: broadcastMessage.avatar || 'https://ui-avatars.com/api/?name=Admin&background=blue',
                  email: broadcastMessage.email || 'admin@example.com'
                },
                topicId: topicId
              };

              set(state => {
                return addMessageToState(state, topicId, newMessage);
              });
            }
          }
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          const { topicId, userId, userName, timestamp } = payload.payload;
          
          if (topicId && userParticipatingTopics.has(topicId)) {
            set(state => {
              const newTypingUsers = { ...state.typingUsers };
              if (!newTypingUsers[topicId]) {
                newTypingUsers[topicId] = {};
              }
              newTypingUsers[topicId][userId] = { name: userName, timestamp };
              return { typingUsers: newTypingUsers };
            });
          }
        })
        .on('broadcast', { event: 'stop_typing' }, (payload) => {
          const { topicId, userId } = payload.payload;
          
          if (topicId && userParticipatingTopics.has(topicId)) {
            set(state => {
              const newTypingUsers = { ...state.typingUsers };
              if (newTypingUsers[topicId] && newTypingUsers[topicId][userId]) {
                delete newTypingUsers[topicId][userId];
                if (Object.keys(newTypingUsers[topicId]).length === 0) {
                  delete newTypingUsers[topicId];
                }
              }
              return { typingUsers: newTypingUsers };
            });
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            set({ 
              globalChannel: channel,
              isGlobalChannelConnected: true 
            });
            console.log('全局聊天连接已建立');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // 静默处理连接错误，不显示给用户
            set({ isGlobalChannelConnected: false });
            
            // 3秒后静默重试连接
            setTimeout(() => {
              get().initializeGlobalConnection(userId);
            }, 3000);
          } else if (status === 'CLOSED') {
            set({ 
              globalChannel: null,
              isGlobalChannelConnected: false 
            });
          }
        });
        
      // 保存channel引用
      set({ globalChannel: channel });
      
    } catch (error) {
      // 静默处理初始化失败，不影响用户体验
      set({ 
        globalChannel: null,
        isGlobalChannelConnected: false 
      });
    }
  },

  // 断开全局连接
  disconnectGlobalConnection: () => {
    const { globalChannel } = get();
    
    if (globalChannel) {
      supabase.removeChannel(globalChannel);
      set({ 
        globalChannel: null,
        isGlobalChannelConnected: false,
        userParticipatingTopics: new Set()
      });
    }
  },

  // 更新用户参与的topics
  updateUserTopics: async (userId: string) => {
    try {
      const topics = await getUserTopicIds(userId);
      const topicsSet = new Set(topics);
      
      // 用户topics已更新
      
      set({ userParticipatingTopics: topicsSet });
      
      // 如果全局连接已存在且topics发生变化，需要重新连接
      const { globalChannel, isGlobalChannelConnected } = get();
      if (globalChannel && isGlobalChannelConnected) {
        await get().initializeGlobalConnection(userId);
      }
      
    } catch (error) {
      // 静默处理更新topics失败
    }
  },

  // 消息路由分发
  routeMessage: async (message: { id: string; topic_id: string; user_id: string; message: string; created_at: string }) => {
    try {
      const topicId = message.topic_id;
      const { userParticipatingTopics, messages } = get();
      
      // 检查是否是用户参与的topic
      if (!userParticipatingTopics.has(topicId)) {
        return;
      }
      
      // 检查消息是否已存在
      const existingMessages = messages[topicId] || [];
      const messageExists = existingMessages.some(msg => msg.id === message.id);
      
      if (messageExists) {
        return;
      }

      // 获取用户信息
      const userData = await withNetworkRetry(async () => {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', message.user_id)
          .single();

        if (error || !data) {
          throw error || new Error('ユーザー情報が見つかりません');
        }
        
        return data;
      }).catch((error) => {
        console.error('ユーザー情報の取得に失敗:', error);
        return null;
      });

      if (!userData) {
        return;
      }

      // 消息解密
      let decryptedText: string;
      try {
        decryptedText = isEncrypted(message.message) 
          ? decryptMessage(message.message) 
          : message.message;
      } catch (error) {
        console.warn('メッセージの復号化に失敗:', error);
        decryptedText = message.message;
      }

      // 创建新消息对象
      const newMessage: Message = {
        id: message.id,
        text: decryptedText,
        createdAt: message.created_at,
        author: {
          id: userData.id,
          name: userData.nickname,
          avatar: userData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.nickname)}&background=random`,
          email: userData.email
        },
        topicId: message.topic_id
      };

      // 添加到状态
      set(state => {
        const updatedState = addMessageToState(state, topicId, newMessage);
        
        if (updatedState === state) {
          return state;
        }
        
        // 播放通知声音（如果不是当前topic）
        if (state.currentTopicId !== topicId) {
          get().playNotificationSound();
        }
        
        // 更新未读计数
        const newUnreadCounts = { ...state.unreadCounts };
        if (state.currentTopicId !== topicId) {
          newUnreadCounts[topicId] = (newUnreadCounts[topicId] || 0) + 1;
        }
        
        return {
          ...updatedState,
          unreadCounts: newUnreadCounts
        };
      });

    } catch (error) {
      // 静默处理消息路由错误，不影响用户体验
    }
  },

  // 现在のトピックを设定
  setCurrentTopic: (topicId: string | null) => {
    set({ currentTopicId: topicId });
  },

  // 特定トピックのメッセージを取得
  getMessagesForTopic: (topicId: string) => {
    const { messages } = get();
    return messages[topicId] || [];
  },

  // 特定トピックのメッセージ数を取得
  getMessageCount: (topicId: string) => {
    const { messages } = get();
    return (messages[topicId] || []).length;
  },

  // 入力中インジケーターを送信
  sendTypingIndicator: (topicId: string, userId: string, userName: string) => {
    const { globalChannel, userParticipatingTopics } = get();
    
    if (globalChannel && userParticipatingTopics.has(topicId)) {
      globalChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          topicId,
          userId,
          userName,
          timestamp: Date.now()
        }
      });
    }
  },

  // 入力中インジケーターを停止
  stopTypingIndicator: (topicId: string, userId: string) => {
    const { globalChannel, userParticipatingTopics } = get();
    
    if (globalChannel && userParticipatingTopics.has(topicId)) {
      globalChannel.send({
        type: 'broadcast',
        event: 'stop_typing',
        payload: {
          topicId,
          userId
        }
      });
    }
    
    // 本地状态也删除
    set(state => {
      const newTypingUsers = { ...state.typingUsers };
      if (newTypingUsers[topicId]) {
        delete newTypingUsers[topicId][userId];
        if (Object.keys(newTypingUsers[topicId]).length === 0) {
          delete newTypingUsers[topicId];
        }
      }
      return { typingUsers: newTypingUsers };
    });
  },

  // 入力中のユーザー一覧を取得
  getTypingUsers: (topicId: string) => {
    const { typingUsers } = get();
    const topicTyping = typingUsers[topicId] || {};
    const now = Date.now();
    
    // 5秒以上古い入力状態を削除
    return Object.entries(topicTyping)
      .filter(([_, info]) => now - info.timestamp < 5000)
      .map(([userId, info]) => ({ userId, name: info.name }));
  },

  // メッセージを既読にマーク
  markAsRead: (topicId: string) => {
    const { lastReadTimestamps } = get();
    const currentTimestamp = lastReadTimestamps[topicId];
    const currentTime = new Date().toISOString();
    
    // 1秒以内の重複呼び出しを防ぐ
    if (currentTimestamp) {
      const lastTime = new Date(currentTimestamp).getTime();
      const now = new Date(currentTime).getTime();
      if (now - lastTime < 1000) {
        return; // 1秒以内は無視
      }
    }
    
    set(state => ({
      lastReadTimestamps: {
        ...state.lastReadTimestamps,
        [topicId]: currentTime
      },
      unreadCounts: {
        ...state.unreadCounts,
        [topicId]: 0
      }
    }));
    
    // AsyncStorageに永続化（オプション、非同期で実行）
    AsyncStorage.setItem(`lastRead_${topicId}`, currentTime).catch(error => {
      console.warn('Failed to persist last read time:', error);
    });
  },

  // 未読数を取得
  getUnreadCount: (topicId: string) => {
    const { unreadCounts } = get();
    return unreadCounts[topicId] || 0;
  },

  // リアクションを追加
  addReaction: (messageId: string, emoji: string, userId: string) => {
    set(state => {
      const newReactions = { ...state.messageReactions };
      if (!newReactions[messageId]) {
        newReactions[messageId] = {};
      }
      if (!newReactions[messageId][emoji]) {
        newReactions[messageId][emoji] = [];
      }
      if (!newReactions[messageId][emoji].includes(userId)) {
        newReactions[messageId][emoji].push(userId);
      }
      return { messageReactions: newReactions };
    });
  },

  // リアクションを削除
  removeReaction: (messageId: string, emoji: string, userId: string) => {
    set(state => {
      const newReactions = { ...state.messageReactions };
      if (newReactions[messageId] && newReactions[messageId][emoji]) {
        newReactions[messageId][emoji] = newReactions[messageId][emoji].filter(id => id !== userId);
        if (newReactions[messageId][emoji].length === 0) {
          delete newReactions[messageId][emoji];
        }
        if (Object.keys(newReactions[messageId]).length === 0) {
          delete newReactions[messageId];
        }
      }
      return { messageReactions: newReactions };
    });
  },

  // メッセージのリアクションを取得
  getMessageReactions: (messageId: string) => {
    const { messageReactions } = get();
    return messageReactions[messageId] || {};
  },

  // サウンド設定を変更
  setSoundEnabled: (enabled: boolean) => {
    set({ soundEnabled: enabled });
  },

  // 通知音を再生
  playNotificationSound: async () => {
    const { soundEnabled } = get();
    if (!soundEnabled) return;
    
    try {
      // Web環境では音声APIを使用、ネイティブでは後で実装
      if (typeof window !== 'undefined' && window.AudioContext) {
        // 簡単なビープ音を生成
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
      }
    } catch (error) {
      console.warn('通知音の再生に失敗:', error);
    }
  },

  // 引用メッセージを設定
  setQuotedMessage: (message: Message | null) => {
    set({ quotedMessage: message });
  },

  // ユーザーのプレゼンス状態を更新
  updateUserPresence: (topicId: string, userId: string, userName: string) => {
    const { globalChannel, userParticipatingTopics } = get();
    
    if (globalChannel && userParticipatingTopics.has(topicId)) {
      // Note: Supabase presence is topic-specific, so we might need a different approach
      // For now, just update local state
    }
    
    // ローカル状态更新
    set(state => {
      const newOnlineUsers = { ...state.onlineUsers };
      if (!newOnlineUsers[topicId]) {
        newOnlineUsers[topicId] = {};
      }
      newOnlineUsers[topicId][userId] = { name: userName, timestamp: Date.now() };
      return { onlineUsers: newOnlineUsers };
    });
  },

  // ユーザーのプレゼンス状態を削除
  removeUserPresence: (topicId: string, userId: string) => {
    set(state => {
      const newOnlineUsers = { ...state.onlineUsers };
      if (newOnlineUsers[topicId] && newOnlineUsers[topicId][userId]) {
        delete newOnlineUsers[topicId][userId];
        if (Object.keys(newOnlineUsers[topicId]).length === 0) {
          delete newOnlineUsers[topicId];
        }
      }
      return { onlineUsers: newOnlineUsers };
    });
  },

  // オンラインユーザー一覧を取得
  getOnlineUsers: (topicId: string) => {
    const { onlineUsers } = get();
    const topicUsers = onlineUsers[topicId] || {};
    const now = Date.now();
    
    // 30秒以上古いプレゼンス情報を除外
    return Object.entries(topicUsers)
      .filter(([_, info]) => now - info.timestamp < 30000)
      .map(([userId, info]) => ({ userId, name: info.name }));
  },

  // メッセージを検索
  searchMessages: (topicId: string, query: string) => {
    const { messages } = get();
    const topicMessages = messages[topicId] || [];
    
    if (!query.trim()) {
      set({ searchQuery: '', searchResults: [] });
      return;
    }
    
    const results = topicMessages.filter(message =>
      message.text.toLowerCase().includes(query.toLowerCase()) ||
      message.author.name.toLowerCase().includes(query.toLowerCase())
    );
    
    set({ searchQuery: query, searchResults: results });
  },

  // 検索をクリア
  clearSearch: () => {
    set({ searchQuery: '', searchResults: [] });
  },

  // 未読数を再取得
  refreshUnreadCounts: async () => {
    const { messages, lastReadTimestamps } = get();
    const newUnreadCounts: Record<string, number> = {};
    
    // 各トピックの未読数を再計算
    for (const topicId in messages) {
      const topicMessages = messages[topicId] || [];
      const lastReadTime = lastReadTimestamps[topicId];
      
      if (lastReadTime) {
        newUnreadCounts[topicId] = topicMessages.filter(
          msg => new Date(msg.createdAt) > new Date(lastReadTime)
        ).length;
      } else {
        newUnreadCounts[topicId] = topicMessages.length;
      }
    }
    
    set({ unreadCounts: newUnreadCounts });
  },
  
  // 複数のトピックの未読数を取得
  fetchUnreadCountsForTopics: async (topicIds: string[], currentUserId: string) => {
    try {
      const { lastReadTimestamps } = get();
      const newUnreadCounts: Record<string, number> = {};
      
      // 各トピックの最新メッセージ時刻と未読数を取得
      for (const topicId of topicIds) {
        // 最後に読んだタイムスタンプを取得（永続化されたものもチェック）
        let lastReadTime = lastReadTimestamps[topicId];
        
        // 永続化されたタイムスタンプをチェック
        if (!lastReadTime) {
          try {
            const stored = await AsyncStorage.getItem(`lastRead_${topicId}`);
            if (stored) {
              lastReadTime = stored;
              // メモリにも保存
              set(state => ({
                lastReadTimestamps: {
                  ...state.lastReadTimestamps,
                  [topicId]: stored
                }
              }));
            }
          } catch (error) {
            console.warn('Failed to load persisted last read time:', error);
          }
        }
        
        // それでもなければ1年前を設定
        if (!lastReadTime) {
          lastReadTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        }
        
        // 未読メッセージ数を取得
        const result = await withDatabaseRetry(async () => {
          const { count, error } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('topic_id', topicId)
            .gt('created_at', lastReadTime)
            .neq('user_id', currentUserId); // 自分のメッセージは除外
          
          if (error) {
            throw error;
          }
          
          return count;
        }).catch((error) => {
          console.warn(`Failed to fetch unread count for topic ${topicId}:`, error);
          return null;
        });
        
        if (result !== null) {
          newUnreadCounts[topicId] = result;
        }
      }
      
      // 既存の未読数とマージ
      set(state => ({
        unreadCounts: {
          ...state.unreadCounts,
          ...newUnreadCounts
        }
      }));
      
    } catch (error) {
      console.error('Failed to fetch unread counts:', error);
    }
  },

  // 连接状态管理
  isConnected: () => {
    const { isGlobalChannelConnected } = get();
    return isGlobalChannelConnected;
  },

  getConnectionStatus: () => {
    const { globalChannel, isGlobalChannelConnected } = get();
    
    if (!globalChannel) {
      return 'disconnected';
    } else if (isGlobalChannelConnected) {
      return 'connected';
    } else {
      return 'connecting';
    }
  }
}));