import { create } from 'zustand';
import { Topic } from '@/types';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, TopicInteractionEvent, CommentEvent, MessageEvent, TopicEvent } from '@/lib/event-bus';
import { topicCache, cacheUtils } from '@/lib/topic-cache';
import { fetchNearbyTopics, GeoQueryParams } from '@/lib/geo-queries';
import { supabase } from '@/lib/supabase';

interface HomeTopicsState {
  topics: Topic[];
  filteredTopics: Topic[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  searchQuery: string;
  
  // Cursor-based pagination
  nextCursor?: string;
  
  // 独立したリクエスト管理
  lastRequestTime: number;
  
  fetchNearbyTopics: (latitude: number, longitude: number, refresh?: boolean) => Promise<void>;
  loadMoreTopics: (latitude: number, longitude: number) => Promise<void>;
  searchTopics: (query: string) => void;
  clearSearch: () => void;
  updateTopicInteraction: (topicId: string, updates: Partial<Topic>) => void;
  checkFavoriteStatus: (topicIds: string[], userId: string) => Promise<void>;
  checkLikeStatus: (topicIds: string[], userId: string) => Promise<void>;
}

const TOPICS_PER_PAGE = 10;

export const useHomeTopicsStore = create<HomeTopicsState>((set, get) => {
  // Set up event listeners
  const setupEventListeners = () => {
    // Listen for topic interactions from other pages
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
    
    const unsubscribeTopicCreated = eventBus.on(EVENT_TYPES.TOPIC_CREATED, (data: TopicEvent) => {
      // Add new topic to the beginning of the list
      set(state => {
        const newTopic: Topic = {
          ...data.topic,
          distance: 0, // Will be calculated properly on next fetch
          commentCount: 0,
          participantCount: 1,
          isFavorited: false,
          isLiked: false,
          likesCount: 0
        };
        
        return {
          topics: [newTopic, ...state.topics],
          filteredTopics: state.searchQuery 
            ? state.filteredTopics
            : [newTopic, ...state.filteredTopics]
        };
      });
    });
    
    // Store cleanup functions
    return () => {
      unsubscribeLike();
      unsubscribeUnlike();
      unsubscribeFavorite();
      unsubscribeUnfavorite();
      unsubscribeComment();
      unsubscribeMessage();
      unsubscribeTopicCreated();
    };
  };
  
  // Set up listeners when store is created
  const cleanup = setupEventListeners();
  
  return ({
  topics: [],
  filteredTopics: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  error: null,
  searchQuery: '',
  nextCursor: undefined,
  lastRequestTime: 0,

  fetchNearbyTopics: async (latitude, longitude, refresh = false) => {
    const now = Date.now();
    const { lastRequestTime } = get();
    
    // 1秒以内の重複リクエストを防ぐ
    if (!refresh && now - lastRequestTime < 1000) {
      return;
    }
    
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
      // Use the new geographic query function
      const queryParams: GeoQueryParams = {
        latitude,
        longitude,
        radiusKm: 5, // 5km radius for nearby topics
        limit: 10,
        cursor: refresh ? undefined : get().nextCursor,
        sortBy: 'distance'
      };
      
      await withNetworkRetry(async () => {
        const result = await fetchNearbyTopics(queryParams);
        
        // Cache the topics for faster access later
        result.topics.forEach(topic => {
          if (cacheUtils.shouldCache(topic)) {
            topicCache.set(topic);
          }
        });
        
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
      console.error('Failed to fetch nearby topics:', error);
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : '近くのトピックの取得に失敗しました';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
    }
  },

  loadMoreTopics: async (latitude, longitude) => {
    const { isLoadingMore, hasMore, nextCursor, topics } = get();
    
    if (isLoadingMore || !hasMore || !nextCursor) return;
    
    set({ isLoadingMore: true, error: null });
    
    try {
      // Use cursor-based pagination for loading more
      const queryParams: GeoQueryParams = {
        latitude,
        longitude,
        radiusKm: 5,
        limit: 10,
        cursor: nextCursor,
        sortBy: 'distance'
      };
      
      const result = await fetchNearbyTopics(queryParams);
      
      // Merge with existing topics, avoiding duplicates
      const existingTopicIds = new Set(topics.map(t => t.id));
      const uniqueNewTopics = result.topics.filter(topic => !existingTopicIds.has(topic.id));
      
      // Cache new topics
      uniqueNewTopics.forEach(topic => {
        if (cacheUtils.shouldCache(topic)) {
          topicCache.set(topic);
        }
      });
      
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
      // Check user's like status
      const { data: likesData, error: likesError } = await supabase
        .from('topic_likes')
        .select('topic_id')
        .eq('user_id', userId)
        .in('topic_id', topicIds);

      if (likesError) {
        throw likesError;
      }

      const likedTopicIds = new Set(likesData?.map(l => l.topic_id) || []);

      // Get likes count for each topic
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
  }
  });
});

