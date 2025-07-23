import { create } from 'zustand';
import { Topic } from '@/types';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, TopicInteractionEvent, CommentEvent, MessageEvent, TopicEvent } from '@/lib/event-bus';
import { fetchMapTopics, fetchTopicsInBounds, GeoQueryParams } from '@/lib/geo-queries';
import { supabase } from '@/lib/supabase';

interface MapTopicsState {
  topics: Topic[];
  filteredTopics: Topic[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  searchQuery: string;
  
  // Cursor-based pagination
  nextCursor?: string;
  
  // Map-specific state
  currentBounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  
  // 独立したリクエスト管理
  lastRequestTime: number;
  pendingRequest: Promise<void> | null;
  
  fetchMapTopics: (latitude: number, longitude: number, refresh?: boolean) => Promise<void>;
  fetchTopicsInViewport: (bounds: { north: number; south: number; east: number; west: number }) => Promise<void>;
  loadMoreTopics: (latitude: number, longitude: number) => Promise<void>;
  searchTopics: (query: string) => void;
  clearSearch: () => void;
  updateTopicInteraction: (topicId: string, updates: Partial<Topic>) => void;
  checkFavoriteStatus: (topicIds: string[], userId: string) => Promise<void>;
  checkLikeStatus: (topicIds: string[], userId: string) => Promise<void>;
}

const TOPICS_PER_PAGE = 10;
const MINIMUM_MAP_TOPICS = 30;

export const useMapTopicsStore = create<MapTopicsState>((set, get) => {
  // Set up event listeners (same as home store)
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
  
  const unsubscribeMessage = eventBus.on(EVENT_TYPES.MESSAGE_SENT, (data: MessageEvent) => {
    get().updateTopicInteraction(data.topicId, { 
      lastMessageTime: data.messageTime,
      participantCount: data.participantCount 
    });
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
  currentBounds: undefined,
  lastRequestTime: 0,
  pendingRequest: null,

  fetchMapTopics: async (latitude, longitude, refresh = false) => {
    const now = Date.now();
    const { lastRequestTime, pendingRequest } = get();
    
    // 既存のリクエストが進行中の場合は待つ
    if (pendingRequest) {
      await pendingRequest;
      return;
    }
    
    // 1秒以内の重複リクエストを防ぐ
    if (!refresh && now - lastRequestTime < 1000) {
      return;
    }
    
    const request = async () => {
      set({ isLoading: true, error: null, lastRequestTime: now });
      
      if (refresh) {
        set({ 
          hasMore: true,
          topics: [],
          filteredTopics: [],
          nextCursor: undefined
        });
      }
      
      try {
        // Use the new geographic query function for map topics
        const queryParams = {
          latitude,
          longitude,
          radiusKm: 10, // Larger radius for map view
          limit: Math.max(TOPICS_PER_PAGE, MINIMUM_MAP_TOPICS),
          cursor: refresh ? undefined : get().nextCursor,
          sortBy: 'activity' as const
        };
        
        await withNetworkRetry(async () => {
          const result = await fetchMapTopics(queryParams);
          
          set({ 
            topics: result.topics,
            filteredTopics: result.topics,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
            isLoading: false 
          });
          
          // Check favorite and like status
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id && result.topics.length > 0) {
            const topicIds = result.topics.map(t => t.id);
            await get().checkFavoriteStatus(topicIds, user.id);
            await get().checkLikeStatus(topicIds, user.id);
          }
          
          // 検索状態を再適用
          const { searchQuery } = get();
          if (searchQuery) {
            get().searchTopics(searchQuery);
          }
        });
      } catch (error: any) {
        console.error('Failed to fetch map topics:', error);
        const errorMessage = isNetworkError(error) 
          ? 'ネットワーク接続を確認してください' 
          : '地図のトピックの取得に失敗しました';
        set({ 
          error: errorMessage, 
          isLoading: false 
        });
      } finally {
        set({ pendingRequest: null });
      }
    };
    
    const promise = request();
    set({ pendingRequest: promise });
    await promise;
  },

  loadMoreTopics: async (latitude, longitude) => {
    const { isLoadingMore, hasMore, nextCursor, topics } = get();
    
    if (isLoadingMore || !hasMore || !nextCursor) return;
    
    set({ isLoadingMore: true, error: null });
    
    try {
      // Use cursor-based pagination for loading more map topics
      const queryParams = {
        latitude,
        longitude,
        radiusKm: 10,
        limit: TOPICS_PER_PAGE,
        cursor: nextCursor,
        sortBy: 'activity' as const
      };
      
      const result = await fetchMapTopics(queryParams);
      
      // Merge with existing topics, avoiding duplicates
      const existingTopicIds = new Set(topics.map(t => t.id));
      const uniqueNewTopics = result.topics.filter(topic => !existingTopicIds.has(topic.id));
      
      const allTopics = [...topics, ...uniqueNewTopics];
      
      set({ 
        topics: allTopics,
        filteredTopics: allTopics,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
        isLoadingMore: false 
      });
      
      // Check favorite and like status for new topics
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && uniqueNewTopics.length > 0) {
        const newTopicIds = uniqueNewTopics.map(t => t.id);
        await get().checkFavoriteStatus(newTopicIds, user.id);
        await get().checkLikeStatus(newTopicIds, user.id);
      }
      
      // 検索状態を再適用
      const { searchQuery } = get();
      if (searchQuery) {
        get().searchTopics(searchQuery);
      }
    } catch (error: any) {
      set({ 
        error: "さらなるトピックの取得に失敗しました", 
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

  checkFavoriteStatus: async (topicIds, userId) => {
    try {
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('topic_favorites')
        .select('topic_id')
        .eq('user_id', userId)
        .in('topic_id', topicIds);

      if (favoritesError) {
        throw favoritesError;
      }

      const favoritedTopicIds = new Set(favoritesData?.map(f => f.topic_id) || []);
      const targetTopicIds = new Set(topicIds);
      
      set(state => ({
        topics: state.topics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isFavorited: favoritedTopicIds.has(topic.id)
          } : topic
        ),
        filteredTopics: state.filteredTopics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isFavorited: favoritedTopicIds.has(topic.id)
          } : topic
        )
      }));
    } catch (error: any) {
      console.error('Error checking favorite status:', error);
    }
  },

  checkLikeStatus: async (topicIds, userId) => {
    try {
      const { data: likesData, error: likesError } = await supabase
        .from('topic_likes')
        .select('topic_id')
        .eq('user_id', userId)
        .in('topic_id', topicIds);

      if (likesError) {
        throw likesError;
      }

      const likedTopicIds = new Set(likesData?.map(l => l.topic_id) || []);

      const likesCountPromises = topicIds.map(async (topicId) => {
        const { count } = await supabase
          .from('topic_likes')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId);
        return { topicId, count: count || 0 };
      });

      const likesCountResults = await Promise.all(likesCountPromises);
      const likesCountMap = new Map(likesCountResults.map(r => [r.topicId, r.count]));

      const targetTopicIds = new Set(topicIds);
      
      set(state => ({
        topics: state.topics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isLiked: likedTopicIds.has(topic.id),
            likesCount: likesCountMap.get(topic.id) ?? topic.likesCount ?? 0
          } : topic
        ),
        filteredTopics: state.filteredTopics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isLiked: likedTopicIds.has(topic.id),
            likesCount: likesCountMap.get(topic.id) ?? topic.likesCount ?? 0
          } : topic
        )
      }));
    } catch (error: any) {
      console.error('Error checking like status:', error);
    }
  },

  fetchTopicsInViewport: async (bounds) => {
    const { isLoading, pendingRequest } = get();
    
    // Skip if already loading
    if (isLoading || pendingRequest) {
      return;
    }
    
    const request = async () => {
      set({ isLoading: true, error: null });
      
      try {
        const result = await fetchTopicsInBounds(bounds);
        
        set({ 
          topics: result.topics,
          filteredTopics: result.topics,
          hasMore: result.hasMore,
          currentBounds: bounds,
          isLoading: false 
        });
        
        // Check favorite and like status
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && result.topics.length > 0) {
          const topicIds = result.topics.map(t => t.id);
          await get().checkFavoriteStatus(topicIds, user.id);
          await get().checkLikeStatus(topicIds, user.id);
        }
        
        // Apply current search if exists
        const { searchQuery } = get();
        if (searchQuery) {
          get().searchTopics(searchQuery);
        }
      } catch (error: any) {
        console.error('Failed to fetch topics in viewport:', error);
        set({ 
          error: 'ビューポート内のトピックの取得に失敗しました', 
          isLoading: false 
        });
      } finally {
        set({ pendingRequest: null });
      }
    };
    
    const promise = request();
    set({ pendingRequest: promise });
    await promise;
  }
  });
});