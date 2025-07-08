import { create } from 'zustand';
import { Message } from '@/types';
import { supabase } from '@/lib/supabase';
import { encryptMessage, decryptMessage, isEncrypted } from '@/lib/encryption';

interface ChatState {
  // メッセージの状態管理
  messages: Record<string, Message[]>; // topicId -> Message[]
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
  
  // Realtime チャンネルの管理
  realtimeChannels: Record<string, any>; // topicId -> Channel
  
  // メッセージ管理機能
  fetchMessages: (topicId: string) => Promise<void>;
  addMessage: (topicId: string, text: string, userId: string) => Promise<void>;
  clearMessages: (topicId: string) => void;
  clearAllMessages: () => void;
  
  // Realtime サブスクリプション管理
  subscribeToTopic: (topicId: string) => void;
  unsubscribeFromTopic: (topicId: string) => void;
  unsubscribeFromAllTopics: () => void;
  
  // 入力中インジケーター機能
  sendTypingIndicator: (topicId: string, userId: string, userName: string) => void;
  stopTypingIndicator: (topicId: string, userId: string) => void;
  getTypingUsers: (topicId: string) => Array<{ userId: string; name: string }>;
  
  // 未読メッセージ機能
  markAsRead: (topicId: string) => void;
  getUnreadCount: (topicId: string) => number;
  
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
}

export const useChatStore = create<ChatState>((set, get) => ({
  // 初期状態
  messages: {},
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
  realtimeChannels: {},

  // メッセージを取得
  fetchMessages: async (topicId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // Supabaseからメッセージを取得
      const { data: messagesData, error: messagesError } = await supabase
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

      if (messagesError) {
        throw messagesError;
      }

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

      // 該当トピックのメッセージを更新
      set(state => ({
        messages: {
          ...state.messages,
          [topicId]: messages
        },
        isLoading: false
      }));

    } catch (error: any) {
      console.error('メッセージの取得に失敗:', error);
      set({ 
        error: "メッセージの取得に失敗しました", 
        isLoading: false 
      });
    }
  },

  // メッセージを送信
  addMessage: async (topicId: string, text: string, userId: string) => {
    set({ isSending: true, error: null });
    
    try {
      // メッセージを暗号化
      const encryptedText = encryptMessage(text);
      
      // Supabaseにメッセージを挿入
      const { data: insertedMessage, error: insertError } = await supabase
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

      if (insertError) {
        throw insertError;
      }

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
        const currentMessages = state.messages[topicId] || [];
        // 重複チェック
        const alreadyExists = currentMessages.some(msg => msg.id === insertedMessage.id);
        if (alreadyExists) {
          return { ...state, isSending: false };
        }
        
        return {
          messages: {
            ...state.messages,
            [topicId]: [...currentMessages, newMessage]
          },
          isSending: false
        };
      });

    } catch (error: any) {
      console.error('メッセージの送信に失敗:', error);
      set({ 
        error: "メッセージの送信に失敗しました", 
        isSending: false 
      });
      throw error;
    }
  },

  // 特定トピックのメッセージをクリア
  clearMessages: (topicId: string) => {
    set(state => {
      const newMessages = { ...state.messages };
      delete newMessages[topicId];
      return { messages: newMessages };
    });
  },

  // 全てのメッセージをクリア
  clearAllMessages: () => {
    set({ messages: {} });
  },

  // Realtimeサブスクリプション開始
  subscribeToTopic: (topicId: string) => {
    const { realtimeChannels } = get();
    
    // 既存のサブスクリプションがある場合は無視
    if (realtimeChannels[topicId]) {
      return;
    }

    // 新しいRealtimeチャンネルを作成
    const channel = supabase
      .channel(`chat_messages:topic_${topicId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `topic_id=eq.${topicId}`,
        },
        async (payload) => {
          try {
            // 自分が送信したメッセージは既にローカルステートにあるのでスキップ
            const { messages } = get();
            const existingMessages = messages[topicId] || [];
            const messageExists = existingMessages.some(msg => msg.id === payload.new.id);
            
            if (messageExists) {
              return;
            }

            // ユーザー情報を取得
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('*')
              .eq('id', payload.new.user_id)
              .single();

            if (userError || !userData) {
              console.error('ユーザー情報の取得に失敗:', userError);
              return;
            }

            // メッセージを復号化
            let decryptedText: string;
            try {
              decryptedText = isEncrypted(payload.new.message) 
                ? decryptMessage(payload.new.message) 
                : payload.new.message;
            } catch (error) {
              console.warn('メッセージの復号化に失敗:', error);
              decryptedText = payload.new.message;
            }

            // 新しいメッセージをローカルステートに追加
            const newMessage: Message = {
              id: payload.new.id,
              text: decryptedText,
              createdAt: payload.new.created_at,
              author: {
                id: userData.id,
                name: userData.nickname,
                avatar: userData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.nickname)}&background=random`,
                email: userData.email
              },
              topicId: payload.new.topic_id
            };

            set(state => {
              const currentMessages = state.messages[topicId] || [];
              // 再度重複チェック（レースコンディション対策）
              const alreadyExists = currentMessages.some(msg => msg.id === payload.new.id);
              if (alreadyExists) {
                return state;
              }
              
              // 通知音を再生（バックグラウンドで）
              get().playNotificationSound();
              
              // 未読カウントを更新（現在のトピックでない場合）
              const newUnreadCounts = { ...state.unreadCounts };
              if (state.currentTopicId !== topicId) {
                newUnreadCounts[topicId] = (newUnreadCounts[topicId] || 0) + 1;
              }
              
              return {
                messages: {
                  ...state.messages,
                  [topicId]: [...currentMessages, newMessage]
                },
                unreadCounts: newUnreadCounts
              };
            });

          } catch (error) {
            console.error('Realtimeメッセージ処理エラー:', error);
          }
        }
      )
      .on('broadcast', { event: 'message' }, (payload) => {
        console.log('受信した広播メッセージ:', payload);
        
        // 広播メッセージを処理
        if (payload.payload && payload.payload.type === 'chat_message') {
          const broadcastMessage = payload.payload;
          
          // 新しいメッセージをローカルステートに追加
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
            const currentMessages = state.messages[topicId] || [];
            // 重複チェック
            const alreadyExists = currentMessages.some(msg => msg.id === newMessage.id);
            if (alreadyExists) {
              return state;
            }
            
            return {
              messages: {
                ...state.messages,
                [topicId]: [...currentMessages, newMessage]
              }
            };
          });
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, userName, timestamp } = payload.payload;
        
        set(state => {
          const newTypingUsers = { ...state.typingUsers };
          if (!newTypingUsers[topicId]) {
            newTypingUsers[topicId] = {};
          }
          newTypingUsers[topicId][userId] = { name: userName, timestamp };
          return { typingUsers: newTypingUsers };
        });
      })
      .on('broadcast', { event: 'stop_typing' }, (payload) => {
        const { userId } = payload.payload;
        
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
      })
      .on('presence', { event: 'sync' }, () => {
        // プレゼンス状態の同期
        const presenceState = channel.presenceState();
        const newOnlineUsers: Record<string, { name: string; timestamp: number }> = {};
        
        Object.values(presenceState).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.userId && presence.userName) {
              newOnlineUsers[presence.userId] = {
                name: presence.userName,
                timestamp: Date.now()
              };
            }
          });
        });
        
        set(state => ({
          onlineUsers: {
            ...state.onlineUsers,
            [topicId]: newOnlineUsers
          }
        }));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // 新しいユーザーが参加
        newPresences.forEach((presence: any) => {
          if (presence.userId && presence.userName) {
            get().updateUserPresence(topicId, presence.userId, presence.userName);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // ユーザーが退出
        leftPresences.forEach((presence: any) => {
          if (presence.userId) {
            get().removeUserPresence(topicId, presence.userId);
          }
        });
      })
      .subscribe();

    // チャンネルを保存
    set(state => ({
      realtimeChannels: {
        ...state.realtimeChannels,
        [topicId]: channel
      }
    }));
  },

  // 特定トピックのサブスクリプション解除
  unsubscribeFromTopic: (topicId: string) => {
    const { realtimeChannels } = get();
    const channel = realtimeChannels[topicId];
    
    if (channel) {
      supabase.removeChannel(channel);
      
      set(state => {
        const newChannels = { ...state.realtimeChannels };
        delete newChannels[topicId];
        return { realtimeChannels: newChannels };
      });
    }
  },

  // 全てのサブスクリプション解除
  unsubscribeFromAllTopics: () => {
    const { realtimeChannels } = get();
    
    Object.values(realtimeChannels).forEach(channel => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    });
    
    set({ realtimeChannels: {} });
  },

  // 現在のトピックを設定
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
    const { realtimeChannels } = get();
    const channel = realtimeChannels[topicId];
    
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId,
          userName,
          timestamp: Date.now()
        }
      });
    }
  },

  // 入力中インジケーターを停止
  stopTypingIndicator: (topicId: string, userId: string) => {
    const { realtimeChannels } = get();
    const channel = realtimeChannels[topicId];
    
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'stop_typing',
        payload: {
          userId
        }
      });
    }
    
    // ローカル状態からも削除
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
    const { lastReadTimestamps, unreadCounts } = get();
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
  }
}));