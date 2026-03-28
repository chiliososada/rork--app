import { create } from 'zustand';
import { Message } from '@/types';
import { supabase } from '@/lib/supabase';
import { encryptMessage, decryptMessage, isEncrypted, upgradeEncryption } from '@/lib/secure-encryption';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withNetworkRetry, withDatabaseRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, MessageEvent } from '@/lib/event-bus';
import { getUserTopicIds } from '@/lib/user-topics';
import { realtimeConnectionManager, ConnectionStatus } from '@/lib/realtime-connection-manager';

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
  
  // 接続管理（新しいシステム）
  connectionStatus: ConnectionStatus;
  connectionStats: any;
  currentUserId: string | null;
  
  // 廃止予定（後方互換性のために保持）
  globalChannel: import('@supabase/supabase-js').RealtimeChannel | null;
  isGlobalChannelConnected: boolean;
  userParticipatingTopics: Set<string>;
  
  // メッセージ管理機能
  fetchMessages: (topicId: string) => Promise<void>;
  addMessage: (topicId: string, text: string, userId: string) => Promise<void>;
  clearMessages: (topicId: string) => void;
  clearAllMessages: () => void;
  
  // 接続管理（新しいシステム）
  initializeConnection: (userId: string) => Promise<void>;
  disconnectConnection: () => Promise<void>;
  forceReconnect: () => Promise<void>;
  updateUserTopics: (userId: string) => Promise<void>;
  
  // メッセージルーティング
  handleRealtimeMessage: (message: any) => void;
  routeMessage: (message: any) => Promise<void>;
  
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
  getConnectionStatus: () => ConnectionStatus;
  getConnectionDebugInfo: () => any;
}

// 辅助函数：安全地添加消息到状态中，避免重复
const addMessageToState = (state: ChatState, topicId: string, newMessage: Message): ChatState => {
  console.log('🔧 addMessageToState 実行開始:', {
    topicId,
    messageId: newMessage.id,
    messageText: newMessage.text,
    existingMessagesCount: state.messages[topicId]?.length || 0
  });

  // 初始化该话题的消息数组和ID集合（如果不存在）
  if (!state.messages[topicId]) {
    console.log('📝 新しい話題用のメッセージ配列を初期化:', topicId);
    state.messages[topicId] = [];
  }
  if (!state.messageIds[topicId]) {
    console.log('🆔 新しい話題用のメッセージIDセットを初期化:', topicId);
    state.messageIds[topicId] = new Set();
  }
  
  // 检查消息是否已存在
  if (state.messageIds[topicId].has(newMessage.id)) {
    console.log(`⚠️ 消息 ${newMessage.id} 已存在，跳过添加`);
    return state;
  }
  
  // 添加消息
  const updatedMessages = [...state.messages[topicId], newMessage];
  const updatedMessageIds = new Set(state.messageIds[topicId]);
  updatedMessageIds.add(newMessage.id);
  
  console.log('✅ メッセージ追加完了:', {
    topicId,
    messageId: newMessage.id,
    newMessagesCount: updatedMessages.length,
    newMessageIdsCount: updatedMessageIds.size
  });
  
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
  
  // 接続管理の初期状態
  connectionStatus: 'disconnected',
  connectionStats: null,
  currentUserId: null,
  
  // 後方互換性
  globalChannel: null,
  isGlobalChannelConnected: false,
  userParticipatingTopics: new Set(),

  // メッセージを取得
  fetchMessages: async (topicId: string) => {
    set({ isLoading: true, error: null });

    // リアルタイム接続に現在の話題IDを追加
    try {
      await realtimeConnectionManager.addCurrentTopicId(topicId);
      
      // 参加トピックセットにも追加
      set(state => ({
        userParticipatingTopics: new Set([...state.userParticipatingTopics, topicId])
      }));
      
      console.log('🔗 話題IDを参加セットに追加:', topicId);
    } catch (error) {
      console.warn('話題IDの追加に失敗:', error);
    }
    
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
        let shouldUpgradeEncryption = false;
        
        try {
          decryptedText = isEncrypted(message.message) 
            ? decryptMessage(message.message) 
            : message.message;
            
          // 检查是否是旧版本加密，需要升级
          if (isEncrypted(message.message) && 
              (message.message.startsWith('ENC_') || message.message.startsWith('ENC2_'))) {
            shouldUpgradeEncryption = true;
          }
        } catch (error) {
          console.error('メッセージの復号化に失敗:', error);
          decryptedText = message.message;
        }
        
        // 异步升级旧版本加密（不阻塞UI）
        if (shouldUpgradeEncryption) {
          setTimeout(async () => {
            try {
              const upgradedMessage = upgradeEncryption(message.message);
              await supabase
                .from('chat_messages')
                .update({ message: upgradedMessage })
                .eq('id', message.id);
              console.log('已升级消息加密:', message.id);
            } catch (error) {
              console.error('升级消息加密失败:', error);
            }
          }, 100);
        }
        
        return {
          id: message.id,
          text: decryptedText,
          createdAt: message.created_at,
          author: {
            id: message.users.id,
            name: message.users.nickname,
            nickname: message.users.nickname,
            avatar: message.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.users.nickname)}&background=random`,
            email: message.users.email
          },
          topicId: message.topic_id,
          type: 'topic' as const
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
    console.log('📤 メッセージ送信開始:', { topicId, text, userId });
    set({ isSending: true, error: null });
    
    try {
      const insertedMessage = await withDatabaseRetry(async () => {
        // メッセージを暗号化
        const encryptedText = encryptMessage(text);
        console.log('🔐 メッセージ暗号化完了:', { originalText: text, encryptedText });
        
        // Supabaseにメッセージを挿入
        console.log('💾 データベースへの挿入を開始...');
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
          console.error('❌ データベース挿入エラー:', error);
          throw error;
        }
        
        console.log('✅ データベース挿入成功:', { 
          messageId: data.id, 
          insertedAt: data.created_at,
          topicId: data.topic_id 
        });
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
          nickname: insertedMessage.users.nickname,
          avatar: insertedMessage.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(insertedMessage.users.nickname)}&background=random`,
          email: insertedMessage.users.email
        },
        topicId: insertedMessage.topic_id,
        type: 'topic' as const
      };

      console.log('🏠 ローカル状態にメッセージを追加:', {
        messageId: newMessage.id,
        text: newMessage.text,
        topicId: topicId,
        authorName: newMessage.author.name
      });

      set(state => {
        console.log('📊 送信前のローカル状態:', {
          currentMessages: state.messages[topicId]?.length || 0,
          messageIds: state.messageIds[topicId]?.size || 0
        });

        const updatedState = addMessageToState(state, topicId, newMessage);
        
        console.log('📊 送信後のローカル状態:', {
          newMessages: updatedState.messages[topicId]?.length || 0,
          newMessageIds: updatedState.messageIds[topicId]?.size || 0
        });

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

  // 新しい接続システムを初期化
  initializeConnection: async (userId: string) => {
    try {
      console.log('🌐 リアルタイム接続を初期化中...', { userId });
      set({ currentUserId: userId });
      
      // ステータスリスナーを設定
      realtimeConnectionManager.addStatusListener((status) => {
        console.log('🔄 接続ステータス更新:', status);
        set({ 
          connectionStatus: status,
          // 後方互換性のために既存フィールドも更新
          isGlobalChannelConnected: status === 'connected'
        });
        
        // 降級モードの場合はユーザーに通知
        if (realtimeConnectionManager.isFallbackMode()) {
          console.log('⚠️ 降級モードで動作中 - メッセージは5秒ごとに更新されます');
        }
      });
      
      // メッセージリスナーを設定
      realtimeConnectionManager.addMessageListener((message) => {
        get().handleRealtimeMessage(message);
      });
      
      // 接続を初期化（エラーをthrowしないので、try-catchは不要）
      await realtimeConnectionManager.initialize(userId);
      
      // 統計情報を更新
      const stats = realtimeConnectionManager.getStats();
      set({ connectionStats: stats });
      
      // 接続状態を確認
      const currentStatus = realtimeConnectionManager.getStatus();
      if (currentStatus === 'connected') {
        console.log('✅ リアルタイム接続が確立されました');
      } else if (realtimeConnectionManager.isFallbackMode()) {
        console.log('📡 降級モードで動作中 - メッセージは轮询で取得されます');
      } else {
        console.log('⚠️ リアルタイム接続の確立に失敗しましたが、再接続を試行中です');
      }
      
    } catch (error) {
      // このブロックは基本的に実行されない（initializeがエラーをthrowしないため）
      console.error('予期せぬエラー:', error);
      set({ 
        connectionStatus: 'error',
        isGlobalChannelConnected: false
      });
    }
  },

  // 接続を切断
  disconnectConnection: async () => {
    try {
      await realtimeConnectionManager.disconnectAll();
      set({ 
        connectionStatus: 'disconnected',
        connectionStats: null,
        // 後方互換性
        globalChannel: null,
        isGlobalChannelConnected: false,
        userParticipatingTopics: new Set()
      });
      console.log('リアルタイム接続を切断しました');
    } catch (error) {
      console.error('接続切断に失敗:', error);
    }
  },
  
  // 強制再接続
  forceReconnect: async () => {
    try {
      await realtimeConnectionManager.forceReconnect();
      set({ connectionStats: realtimeConnectionManager.getStats() });
    } catch (error) {
      console.error('強制再接続に失敗:', error);
    }
  },

  // ユーザーの参加トピックを更新
  updateUserTopics: async (userId: string) => {
    try {
      // 新しい接続管理システムを使用
      await realtimeConnectionManager.updateTopics(userId);
      
      // 後方互換性のために古い形式も更新
      const topics = await getUserTopicIds(userId);
      const topicsSet = new Set(topics);
      set({ userParticipatingTopics: topicsSet });
      
      // 統計情報を更新
      set({ connectionStats: realtimeConnectionManager.getStats() });
      
    } catch (error) {
      console.error('トピック更新に失敗:', error);
    }
  },

  // リアルタイムメッセージを処理
  handleRealtimeMessage: async (payload: any) => {
    try {
      const message = payload.new || payload;
      get().routeMessage(message);
    } catch (error) {
      console.error('リアルタイムメッセージ処理エラー:', error);
    }
  },
  
  // メッセージルーティング（内部用）
  routeMessage: async (message: { id: string; topic_id: string; user_id: string; message: string; created_at: string }) => {
    try {
      const topicId = message.topic_id;
      const { userParticipatingTopics, messages } = get();
      
      console.log('🔄 リアルタイムメッセージをルーティング中:', {
        messageId: message.id,
        topicId: topicId,
        userId: message.user_id,
        participatingTopics: Array.from(userParticipatingTopics),
        hasTopicInSet: userParticipatingTopics.has(topicId)
      });
      
      // 参加トピック検査を緩和：現在表示中なら処理を続行
      if (!userParticipatingTopics.has(topicId)) {
        console.log('⚠️ 参加トピックセットにないが、処理を続行:', topicId);
        // return を削除して処理を続行
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

      // 消息解密与升级
      let decryptedText: string;
      let shouldUpgradeEncryption = false;
      
      try {
        decryptedText = isEncrypted(message.message) 
          ? decryptMessage(message.message) 
          : message.message;
          
        // 检查是否是旧版本加密，需要升级
        if (isEncrypted(message.message) && 
            (message.message.startsWith('ENC_') || message.message.startsWith('ENC2_'))) {
          shouldUpgradeEncryption = true;
        }
      } catch (error) {
        console.error('メッセージの復号化に失敗:', error);
        decryptedText = message.message;
      }
      
      // 异步升级旧版本加密（不阻塞实时消息）
      if (shouldUpgradeEncryption) {
        setTimeout(async () => {
          try {
            const upgradedMessage = upgradeEncryption(message.message);
            await supabase
              .from('chat_messages')
              .update({ message: upgradedMessage })
              .eq('id', message.id);
            console.log('实时消息已升级加密:', message.id);
          } catch (error) {
            console.error('升级实时消息加密失败:', error);
          }
        }, 100);
      }

      // 创建新消息对象
      const newMessage: Message = {
        id: message.id,
        text: decryptedText,
        createdAt: message.created_at,
        author: {
          id: userData.id,
          name: userData.nickname,
          nickname: userData.nickname,
          avatar: userData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.nickname)}&background=random`,
          email: userData.email
        },
        topicId: message.topic_id,
        type: 'topic' as const
      };

      console.log('➕ リアルタイムメッセージを状態に追加:', {
        messageId: newMessage.id,
        text: newMessage.text,
        author: newMessage.author.name,
        topicId: topicId
      });

      // 添加到状态
      set(state => {
        console.log('📊 現在の状態:', {
          currentTopicMessages: state.messages[topicId]?.length || 0,
          messageIds: state.messageIds[topicId]?.size || 0
        });

        const updatedState = addMessageToState(state, topicId, newMessage);
        
        if (updatedState === state) {
          console.log('⚠️ 状態が更新されませんでした（重複メッセージの可能性）');
          return state;
        }

        console.log('✅ 状態が正常に更新されました:', {
          newTopicMessages: updatedState.messages[topicId]?.length || 0,
          newMessageIds: updatedState.messageIds[topicId]?.size || 0
        });
        
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
    try {
      // リアルタイム接続状態をチェック
      if (!realtimeConnectionManager.isConnected()) {
        console.log('📴 リアルタイム接続が利用できません。入力中インジケーターをスキップします。');
        return;
      }

      const success = realtimeConnectionManager.sendMessage(topicId, 'typing', {
        userId,
        userName,
        timestamp: Date.now()
      });
      
      if (!success) {
        console.warn('入力中インジケーター送信に失敗');
      }
    } catch (error) {
      console.error('入力中インジケーター送信エラー:', error);
    }
  },

  // 入力中インジケーターを停止
  stopTypingIndicator: (topicId: string, userId: string) => {
    try {
      // リアルタイム接続状態をチェック
      if (!realtimeConnectionManager.isConnected()) {
        console.log('📴 リアルタイム接続が利用できません。入力停止インジケーターをスキップします。');
        // ローカル状態は更新する
      } else {
        const success = realtimeConnectionManager.sendMessage(topicId, 'stop_typing', {
          userId
        });
        
        if (!success) {
          console.warn('入力停止インジケーター送信に失敗');
        }
      }
      
      // ローカル状態も削除（接続状態に関係なく実行）
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
    } catch (error) {
      console.error('入力停止インジケーター送信エラー:', error);
    }
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
    const success = realtimeConnectionManager.sendMessage(topicId, 'user_presence', {
      userId,
      userName,
      action: 'join'
    });
    
    if (!success) {
      console.warn('プレゼンス更新送信に失敗');
    }
    
    // ローカル状態更新
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

  // 接続状態管理
  isConnected: () => {
    return realtimeConnectionManager.isConnected();
  },

  getConnectionStatus: () => {
    return realtimeConnectionManager.getStatus();
  },
  
  // デバッグ情報を取得
  getConnectionDebugInfo: () => {
    return realtimeConnectionManager.getDebugInfo();
  }
}));