import { create } from 'zustand';
import { Topic } from '@/types';
import { supabase } from '@/lib/supabase';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, TopicInteractionEvent, CommentEvent, MessageEvent, TopicEvent } from '@/lib/event-bus';
import { fetchParticipatedTopics, GeoQueryParams } from '@/lib/geo-queries';

interface ChatTopicsState {
  topics: Topic[];
  filteredTopics: Topic[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  searchQuery: string;
  
  // Cursor-based pagination
  nextCursor?: string;
  
  // チャット固有の状態
  userParticipatedTopicIds: Set<string>;
  lastRefreshTime: number;
  
  fetchChatTopics: (userId: string, refresh?: boolean) => Promise<void>;
  loadMoreChatTopics: (userId: string) => Promise<void>;
  searchTopics: (query: string) => void;
  clearSearch: () => void;
  updateTopicInteraction: (topicId: string, updates: Partial<Topic>) => void;
  updateLastMessageTime: (topicId: string, messageTime: string) => void;
  markAsParticipated: (topicId: string) => void;
  checkFavoriteStatus: (topicIds: string[], userId: string) => Promise<void>;
  checkLikeStatus: (topicIds: string[], userId: string) => Promise<void>;
}

const TOPICS_PER_PAGE = 20; // チャットは一度に多め

export const useChatTopicsStore = create<ChatTopicsState>((set, get) => {
  // Set up event listeners
  const unsubscribeLike = eventBus.on(EVENT_TYPES.TOPIC_LIKED, (data: TopicInteractionEvent) => {
    get().updateTopicInteraction(data.topicId, { isLiked: true, likesCount: data.count });
  });
  
  const unsubscribeUnlike = eventBus.on(EVENT_TYPES.TOPIC_UNLIKED, (data: TopicInteractionEvent) => {
    get().updateTopicInteraction(data.topicId, { isLiked: false, likesCount: data.count });
  });
  
  const unsubscribeFavorite = eventBus.on(EVENT_TYPES.TOPIC_FAVORITED, (data: TopicInteractionEvent) => {
    get().updateTopicInteraction(data.topicId, { isFavorited: true });
  });
  
  const unsubscribeUnfavorite = eventBus.on(EVENT_TYPES.TOPIC_UNFAVORITED, (data: TopicInteractionEvent) => {
    get().updateTopicInteraction(data.topicId, { isFavorited: false });
  });
  
  const unsubscribeComment = eventBus.on(EVENT_TYPES.TOPIC_COMMENTED, (data: CommentEvent) => {
    get().updateTopicInteraction(data.topicId, { commentCount: data.commentCount });
  });

  return ({
  topics: [],
  filteredTopics: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  error: null,
  searchQuery: '',
  nextCursor: undefined,
  userParticipatedTopicIds: new Set(),
  lastRefreshTime: 0,

  fetchChatTopics: async (userId, refresh = false) => {
    const now = Date.now();
    set({ isLoading: true, error: null, lastRefreshTime: now });
    
    if (refresh) {
      set({ 
        currentPage: 0, 
        hasMore: true,
        topics: [],
        filteredTopics: [],
        userParticipatedTopicIds: new Set()
      });
    }
    
    try {
      await withNetworkRetry(async () => {
        // まず、ユーザーが参加したトピックを取得（メッセージを送信したトピック）
        const { data: participatedData, error: participatedError } = await supabase
          .from('chat_messages')
          .select('topic_id')
          .eq('user_id', userId);

        if (participatedError) {
          throw participatedError;
        }

        const participatedTopicIds = new Set(participatedData?.map(d => d.topic_id) || []);
        
        // ユーザーが作成したトピックも含める
        const { data: createdTopicsData, error: createdError } = await supabase
          .from('topics')
          .select('id')
          .eq('user_id', userId);

        if (createdError) {
          throw createdError;
        }

        createdTopicsData?.forEach(topic => participatedTopicIds.add(topic.id));
        
        set({ userParticipatedTopicIds: participatedTopicIds });

        // すべてのトピックを取得（参加していないものも表示）
        const { data: topicsData, error: topicsError } = await supabase
          .from('topics')
          .select(`
            *,
            users!topics_user_id_fkey (
              id,
              nickname,
              avatar_url,
              email
            ),
            comments!comments_topic_id_fkey (count),
            chat_messages!chat_messages_topic_id_fkey (
              user_id,
              created_at,
              message
            )
          `)
          .order('created_at', { ascending: false })
          .range(0, TOPICS_PER_PAGE - 1);

        if (topicsError) {
          throw topicsError;
        }

        // Transform data
        const topics: Topic[] = (topicsData || []).map(topic => {
          // Calculate participant count
          const uniqueParticipants = new Set(topic.chat_messages?.map((msg: any) => msg.user_id) || []);
          uniqueParticipants.add(topic.user_id);
          
          // Find the latest message time
          const lastMessageTime = topic.chat_messages && topic.chat_messages.length > 0
            ? topic.chat_messages
                .map((msg: any) => msg.created_at)
                .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0]
            : undefined;
          
          // 最新メッセージのプレビュー（オプション）
          const lastMessage = topic.chat_messages && topic.chat_messages.length > 0
            ? topic.chat_messages
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            : null;
          
          return {
            id: topic.id,
            title: topic.title,
            description: topic.description || '',
            createdAt: topic.created_at,
            author: {
              id: topic.users.id,
              name: topic.users.nickname,
              avatar: topic.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topic.users.nickname)}&background=random`,
              email: topic.users.email
            },
            location: {
              latitude: topic.latitude,
              longitude: topic.longitude,
              name: topic.location_name || undefined
            },
            commentCount: topic.comments?.[0]?.count || 0,
            participantCount: uniqueParticipants.size,
            lastMessageTime,
            imageUrl: topic.image_url || undefined,
            aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
            isFavorited: false,
            isLiked: false,
            likesCount: 0,
            // チャット用追加フィールド
            isParticipated: participatedTopicIds.has(topic.id),
            lastMessagePreview: lastMessage?.message
          };
        });

        // チャットリストは最終メッセージ時間でソート（参加しているものを優先）
        const sortedTopics = topics.sort((a, b) => {
          // まず参加状態で分ける
          if (a.isParticipated && !b.isParticipated) return -1;
          if (!a.isParticipated && b.isParticipated) return 1;
          
          // 両方参加している場合は最終メッセージ時間でソート
          if (a.isParticipated && b.isParticipated) {
            if (a.lastMessageTime && b.lastMessageTime) {
              return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
            }
            if (a.lastMessageTime) return -1;
            if (b.lastMessageTime) return 1;
          }
          
          // どちらも参加していない場合は作成日時でソート
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        set({ 
          topics: sortedTopics,
          filteredTopics: sortedTopics,
          currentPage: 1,
          hasMore: topicsData?.length === TOPICS_PER_PAGE,
          isLoading: false 
        });
        
        // 検索状態を再適用
        const { searchQuery } = get();
        if (searchQuery) {
          get().searchTopics(searchQuery);
        }
      });
    } catch (error: any) {
      console.error('Failed to fetch chat topics:', error);
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : 'チャットルームの取得に失敗しました';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
    }
  },

  loadMoreChatTopics: async (userId) => {
    const { isLoadingMore, hasMore, currentPage, topics, userParticipatedTopicIds } = get();
    
    if (isLoadingMore || !hasMore) return;
    
    set({ isLoadingMore: true, error: null });
    
    try {
      const from = currentPage * TOPICS_PER_PAGE;
      const to = from + TOPICS_PER_PAGE - 1;
      
      // Fetch more topics
      const { data: topicsData, error: topicsError } = await supabase
        .from('topics')
        .select(`
          *,
          users!topics_user_id_fkey (
            id,
            nickname,
            avatar_url,
            email
          ),
          comments!comments_topic_id_fkey (count),
          chat_messages!chat_messages_topic_id_fkey (
            user_id,
            created_at,
            message
          )
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (topicsError) {
        throw topicsError;
      }

      // Transform data
      const newTopics: Topic[] = (topicsData || []).map(topic => {
        const uniqueParticipants = new Set(topic.chat_messages?.map((msg: any) => msg.user_id) || []);
        uniqueParticipants.add(topic.user_id);
        
        const lastMessageTime = topic.chat_messages && topic.chat_messages.length > 0
          ? topic.chat_messages
              .map((msg: any) => msg.created_at)
              .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0]
          : undefined;
        
        const lastMessage = topic.chat_messages && topic.chat_messages.length > 0
          ? topic.chat_messages
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          : null;
        
        return {
          id: topic.id,
          title: topic.title,
          description: topic.description || '',
          createdAt: topic.created_at,
          author: {
            id: topic.users.id,
            name: topic.users.nickname,
            avatar: topic.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topic.users.nickname)}&background=random`,
            email: topic.users.email
          },
          location: {
            latitude: topic.latitude,
            longitude: topic.longitude,
            name: topic.location_name || undefined
          },
          commentCount: topic.comments?.[0]?.count || 0,
          participantCount: uniqueParticipants.size,
          lastMessageTime,
          imageUrl: topic.image_url || undefined,
          aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
          isFavorited: false,
          isLiked: false,
          likesCount: 0,
          isParticipated: userParticipatedTopicIds.has(topic.id),
          lastMessagePreview: lastMessage?.message
        };
      });

      // 重複を避けて結合
      const existingTopicIds = new Set(topics.map(t => t.id));
      const uniqueNewTopics = newTopics.filter(topic => !existingTopicIds.has(topic.id));
      
      const allTopics = [...topics, ...uniqueNewTopics];
      // 同じソートロジックを適用
      const sortedTopics = allTopics.sort((a, b) => {
        if (a.isParticipated && !b.isParticipated) return -1;
        if (!a.isParticipated && b.isParticipated) return 1;
        
        if (a.isParticipated && b.isParticipated) {
          if (a.lastMessageTime && b.lastMessageTime) {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          }
          if (a.lastMessageTime) return -1;
          if (b.lastMessageTime) return 1;
        }
        
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      set({ 
        topics: sortedTopics,
        filteredTopics: sortedTopics,
        currentPage: currentPage + 1,
        hasMore: topicsData?.length === TOPICS_PER_PAGE,
        isLoadingMore: false 
      });
      
      // 検索状態を再適用
      const { searchQuery } = get();
      if (searchQuery) {
        get().searchTopics(searchQuery);
      }
    } catch (error: any) {
      set({ 
        error: "さらなるチャットルームの取得に失敗しました", 
        isLoadingMore: false 
      });
    }
  },

  searchTopics: (query) => {
    const { topics } = get();
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      set({ 
        filteredTopics: topics,
        searchQuery: query 
      });
      return;
    }
    
    const filtered = topics.filter(topic => {
      const titleMatch = topic.title.toLowerCase().includes(normalizedQuery);
      const descriptionMatch = topic.description.toLowerCase().includes(normalizedQuery);
      const authorMatch = topic.author.name.toLowerCase().includes(normalizedQuery);
      const locationMatch = topic.location.name?.toLowerCase().includes(normalizedQuery) || false;
      
      return titleMatch || descriptionMatch || authorMatch || locationMatch;
    });
    
    set({ 
      filteredTopics: filtered,
      searchQuery: query 
    });
  },

  clearSearch: () => {
    const { topics } = get();
    set({ 
      filteredTopics: topics,
      searchQuery: '' 
    });
  },

  updateTopicInteraction: (topicId, updates) => {
    set(state => ({
      topics: state.topics.map(topic => 
        topic.id === topicId ? { ...topic, ...updates } : topic
      ),
      filteredTopics: state.filteredTopics.map(topic => 
        topic.id === topicId ? { ...topic, ...updates } : topic
      )
    }));
  },

  updateLastMessageTime: (topicId, messageTime) => {
    set(state => {
      const updatedTopics = state.topics.map(topic => 
        topic.id === topicId 
          ? { ...topic, lastMessageTime: messageTime, participantCount: topic.participantCount + 1 }
          : topic
      );
      
      // 再ソート
      const sortedTopics = updatedTopics.sort((a, b) => {
        if (a.isParticipated && !b.isParticipated) return -1;
        if (!a.isParticipated && b.isParticipated) return 1;
        
        if (a.isParticipated && b.isParticipated) {
          if (a.lastMessageTime && b.lastMessageTime) {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          }
          if (a.lastMessageTime) return -1;
          if (b.lastMessageTime) return 1;
        }
        
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      return {
        topics: sortedTopics,
        filteredTopics: state.searchQuery 
          ? state.filteredTopics.map(topic => 
              topic.id === topicId 
                ? { ...topic, lastMessageTime: messageTime, participantCount: topic.participantCount + 1 }
                : topic
            )
          : sortedTopics
      };
    });
  },

  markAsParticipated: (topicId) => {
    set(state => {
      const newParticipatedIds = new Set(state.userParticipatedTopicIds);
      newParticipatedIds.add(topicId);
      
      const updatedTopics = state.topics.map(topic => 
        topic.id === topicId ? { ...topic, isParticipated: true } : topic
      );
      
      // 再ソート
      const sortedTopics = updatedTopics.sort((a, b) => {
        if (a.isParticipated && !b.isParticipated) return -1;
        if (!a.isParticipated && b.isParticipated) return 1;
        
        if (a.isParticipated && b.isParticipated) {
          if (a.lastMessageTime && b.lastMessageTime) {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          }
          if (a.lastMessageTime) return -1;
          if (b.lastMessageTime) return 1;
        }
        
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      return {
        userParticipatedTopicIds: newParticipatedIds,
        topics: sortedTopics,
        filteredTopics: state.searchQuery 
          ? state.filteredTopics.map(topic => 
              topic.id === topicId ? { ...topic, isParticipated: true } : topic
            )
          : sortedTopics
      };
    });
    
    // Also emit event for other stores
    eventBus.emit(EVENT_TYPES.MESSAGE_SENT, { 
      topicId, 
      userId: '', // This would be passed from the caller
      messageTime,
      participantCount: get().topics.find(t => t.id === topicId)?.participantCount
    } as MessageEvent);
  }
  });
});