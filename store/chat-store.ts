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
              
              return {
                messages: {
                  ...state.messages,
                  [topicId]: [...currentMessages, newMessage]
                }
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
  }
}));