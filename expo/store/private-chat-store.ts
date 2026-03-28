import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { PrivateChat, PrivateMessage, User } from '@/types';

interface PrivateChatState {
  // プライベートチャット一覧
  privateChats: PrivateChat[];
  
  // メッセージ管理（chatId -> messages）
  privateMessages: Record<string, PrivateMessage[]>;
  
  // 現在のチャットID
  currentChatId: string | null;
  
  // ローディング状態
  isLoading: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  
  // エラー状態
  error: string | null;
  
  // リアルタイム購読管理
  realtimeChannels: Record<string, any>;
  
  // アクション
  fetchPrivateChats: (userId: string) => Promise<void>;
  getOrCreatePrivateChat: (currentUserId: string, otherUserId: string) => Promise<string>;
  fetchPrivateMessages: (chatId: string, limit?: number, offset?: number) => Promise<void>;
  sendPrivateMessage: (chatId: string, senderId: string, message: string, senderInfo?: User) => Promise<void>;
  markMessagesAsRead: (chatId: string, userId: string) => Promise<void>;
  
  // リアルタイム機能
  subscribeToPrivateChat: (chatId: string, userId: string) => void;
  unsubscribeFromPrivateChat: (chatId: string) => void;
  
  // ユーティリティ
  getPrivateChatById: (chatId: string) => PrivateChat | undefined;
  getUnreadCount: (chatId: string) => number;
  clearError: () => void;
  setCurrentChatId: (chatId: string | null) => void;
}

export const usePrivateChatStore = create<PrivateChatState>((set, get) => ({
  privateChats: [],
  privateMessages: {},
  currentChatId: null,
  isLoading: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  error: null,
  realtimeChannels: {},

  fetchPrivateChats: async (userId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase.rpc('get_private_chats_for_user', {
        user_id_param: userId
      });

      if (error) throw error;

      const chats: PrivateChat[] = data?.map((chat: any) => ({
        id: chat.chat_id,
        participant1Id: userId < chat.other_user_id ? userId : chat.other_user_id,
        participant2Id: userId < chat.other_user_id ? chat.other_user_id : userId,
        createdAt: new Date().toISOString(), // APIから取得する場合は適切な値を設定
        updatedAt: new Date().toISOString(),
        lastMessageAt: chat.last_message_at,
        otherUser: {
          id: chat.other_user_id,
          name: chat.other_user_name,
          avatar: chat.other_user_avatar || '',
        },
        lastMessage: chat.last_message,
        unreadCount: chat.unread_count,
        isSender: chat.is_sender,
      })) || [];

      set({ privateChats: chats });
    } catch (error) {
      console.error('Error fetching private chats:', error);
      set({ error: 'プライベートチャットの取得に失敗しました' });
    } finally {
      set({ isLoading: false });
    }
  },

  getOrCreatePrivateChat: async (currentUserId: string, otherUserId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_private_chat', {
        user1_id: currentUserId,
        user2_id: otherUserId
      });

      if (error) throw error;
      return data as string;
    } catch (error) {
      console.error('Error creating private chat:', error);
      throw error;
    }
  },

  fetchPrivateMessages: async (chatId: string, limit = 50, offset = 0) => {
    set({ isLoadingMessages: true, error: null });
    
    try {
      const { data, error } = await supabase.rpc('get_private_messages', {
        chat_id_param: chatId,
        limit_count: limit,
        offset_count: offset
      });

      if (error) throw error;

      const messages: PrivateMessage[] = data?.map((msg: any) => ({
        id: msg.message_id,
        chatId: chatId,
        senderId: msg.sender_id,
        message: msg.message,
        createdAt: msg.created_at,
        isRead: msg.is_read,
        sender: {
          id: msg.sender_id,
          name: msg.sender_name,
          avatar: msg.sender_avatar || '',
        },
      })) || [];

      // メッセージを時系列順に並び替え（古い順）
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      set(state => ({
        privateMessages: {
          ...state.privateMessages,
          [chatId]: offset === 0 ? messages : [...messages, ...(state.privateMessages[chatId] || [])]
        }
      }));
    } catch (error) {
      console.error('Error fetching private messages:', error);
      set({ error: 'メッセージの取得に失敗しました' });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  sendPrivateMessage: async (chatId: string, senderId: string, message: string, senderInfo?: User) => {
    set({ isSendingMessage: true, error: null });
    
    // 生成临时ID用于乐观更新
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trimmedMessage = message.trim();
    
    // 乐观更新：立即添加消息到本地状态
    const optimisticMessage: PrivateMessage = {
      id: tempId,
      chatId,
      senderId,
      message: trimmedMessage,
      createdAt: new Date().toISOString(),
      isRead: true,
      sendingStatus: 'sending',
      tempId,
      sender: senderInfo || {
        id: senderId,
        name: '送信中...', // 暂时显示，实时订阅会更新
        nickname: '送信中...',
        avatar: '',
      },
    };
    
    // 立即添加到本地状态
    set(state => ({
      privateMessages: {
        ...state.privateMessages,
        [chatId]: [...(state.privateMessages[chatId] || []), optimisticMessage]
      }
    }));
    
    try {
      const { data, error } = await supabase.rpc('send_private_message', {
        chat_id_param: chatId,
        sender_id_param: senderId,
        message_param: trimmedMessage
      });

      if (error) throw error;

      // 更新消息状态为已发送
      set(state => ({
        privateMessages: {
          ...state.privateMessages,
          [chatId]: state.privateMessages[chatId]?.map(msg =>
            msg.tempId === tempId 
              ? { ...msg, sendingStatus: 'sent' }
              : msg
          ) || []
        }
      }));
      
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error sending private message:', error);
      
      // 更新消息状态为发送失败
      set(state => ({
        privateMessages: {
          ...state.privateMessages,
          [chatId]: state.privateMessages[chatId]?.map(msg =>
            msg.tempId === tempId 
              ? { ...msg, sendingStatus: 'failed' }
              : msg
          ) || []
        },
        error: 'メッセージの送信に失敗しました'
      }));
    } finally {
      set({ isSendingMessage: false });
    }
  },

  markMessagesAsRead: async (chatId: string, userId: string) => {
    try {
      const { error } = await supabase.rpc('mark_private_messages_as_read', {
        chat_id_param: chatId,
        user_id_param: userId
      });

      if (error) throw error;

      // ローカル状態を更新
      set(state => ({
        privateMessages: {
          ...state.privateMessages,
          [chatId]: state.privateMessages[chatId]?.map(msg => 
            msg.senderId !== userId ? { ...msg, isRead: true } : msg
          ) || []
        },
        privateChats: state.privateChats.map(chat =>
          chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
        )
      }));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  },

  subscribeToPrivateChat: (chatId: string, userId: string) => {
    const { realtimeChannels } = get();
    
    // 既に購読している場合はスキップ
    if (realtimeChannels[chatId]) return;

    const channel = supabase
      .channel(`private_chat_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          set(state => {
            const currentMessages = state.privateMessages[chatId] || [];
            
            // 检查消息是否已存在（避免重复添加）
            const messageExists = currentMessages.some(msg => msg.id === newMessage.id);
            if (messageExists) {
              return state; // 消息已存在，不做任何操作
            }
            
            // 检查是否有相同内容的临时消息需要替换
            const tempMessageIndex = currentMessages.findIndex(msg => 
              msg.tempId && 
              msg.senderId === newMessage.sender_id &&
              msg.message === newMessage.message &&
              msg.sendingStatus === 'sent'
            );
            
            // 获取发送者信息并添加消息
            supabase
              .from('users')
              .select('id, nickname, avatar_url')
              .eq('id', newMessage.sender_id)
              .single()
              .then(({ data: user }) => {
                const message: PrivateMessage = {
                  id: newMessage.id,
                  chatId: newMessage.chat_id,
                  senderId: newMessage.sender_id,
                  message: newMessage.message,
                  createdAt: newMessage.created_at,
                  isRead: newMessage.is_read,
                  sendingStatus: 'sent',
                  sender: {
                    id: newMessage.sender_id,
                    name: user?.nickname || 'Unknown',
                    nickname: user?.nickname || 'Unknown',
                    avatar: user?.avatar_url || '',
                  },
                };

                set(prevState => {
                  const prevMessages = prevState.privateMessages[chatId] || [];
                  
                  // 如果找到了临时消息，替换它
                  if (tempMessageIndex >= 0) {
                    const updatedMessages = [...prevMessages];
                    updatedMessages[tempMessageIndex] = message;
                    return {
                      privateMessages: {
                        ...prevState.privateMessages,
                        [chatId]: updatedMessages
                      }
                    };
                  } else {
                    // 否则直接添加新消息
                    return {
                      privateMessages: {
                        ...prevState.privateMessages,
                        [chatId]: [...prevMessages, message]
                      }
                    };
                  }
                });
              });
            
            // 返回当前状态，实际更新在上面的异步回调中进行
            return state;
          });
        }
      )
      .subscribe();

    set(state => ({
      realtimeChannels: {
        ...state.realtimeChannels,
        [chatId]: channel
      }
    }));
  },

  unsubscribeFromPrivateChat: (chatId: string) => {
    const { realtimeChannels } = get();
    const channel = realtimeChannels[chatId];
    
    if (channel) {
      supabase.removeChannel(channel);
      
      set(state => {
        const newChannels = { ...state.realtimeChannels };
        delete newChannels[chatId];
        return { realtimeChannels: newChannels };
      });
    }
  },

  getPrivateChatById: (chatId: string) => {
    return get().privateChats.find(chat => chat.id === chatId);
  },

  getUnreadCount: (chatId: string) => {
    const chat = get().getPrivateChatById(chatId);
    return chat?.unreadCount || 0;
  },

  clearError: () => {
    set({ error: null });
  },

  setCurrentChatId: (chatId: string | null) => {
    set({ currentChatId: chatId });
  },
}));