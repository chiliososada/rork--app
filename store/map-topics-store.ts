import { create } from 'zustand';
import { Topic } from '@/types';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, TopicInteractionEvent, CommentEvent, MessageEvent, TopicEvent } from '@/lib/event-bus';
import { fetchMapTopics, fetchTopicsInBounds, GeoQueryParams } from '@/lib/geo-queries';
import { supabase } from '@/lib/supabase';
import { cacheManager } from '@/lib/cache/cache-manager';
import { CACHE_PRESETS } from '@/lib/cache/base-store';

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
  
  // 缓存和位置管理
  currentLocation?: { latitude: number; longitude: number };
  cacheStats: () => any;
  
  fetchMapTopics: (latitude: number, longitude: number, refresh?: boolean) => Promise<void>;
  fetchTopicsInViewport: (bounds: { north: number; south: number; east: number; west: number }) => Promise<void>;
  loadMoreTopics: (latitude: number, longitude: number) => Promise<void>;
  searchTopics: (query: string) => void;
  clearSearch: () => void;
  updateTopicInteraction: (topicId: string, updates: Partial<Topic>) => void;
  checkFavoriteStatus: (topicIds: string[], userId: string) => Promise<void>;
  checkLikeStatus: (topicIds: string[], userId: string) => Promise<void>;
  invalidateCache: (method?: string) => void;
  cleanup: () => void;
}

const TOPICS_PER_PAGE = 10;
const MINIMUM_MAP_TOPICS = 30;
const STORE_KEY = 'map-topics';

// 初始化缓存配置
cacheManager.registerConfig(STORE_KEY, {
  ...CACHE_PRESETS.MEDIUM_TERM,
  ttl: 10 * 60 * 1000, // 10分钟 - 地图数据相对稳定
  locationThreshold: 1000, // 1公里位置变化失效
  debounceTime: 3000, // 3秒防抖 - 地图移动频繁
});

export const useMapTopicsStore = create<MapTopicsState>((set, get) => {
  // Set up event listeners with proper cleanup tracking
  const unsubscribeFunctions: Array<() => void> = [];
  
  const unsubscribeLike = eventBus.on(EVENT_TYPES.TOPIC_LIKED, (data: TopicInteractionEvent) => {
    get().updateTopicInteraction(data.topicId, { isLiked: true, likesCount: data.count });
  });
  unsubscribeFunctions.push(unsubscribeLike);
  
  const unsubscribeUnlike = eventBus.on(EVENT_TYPES.TOPIC_UNLIKED, (data: TopicInteractionEvent) => {
    get().updateTopicInteraction(data.topicId, { isLiked: false, likesCount: data.count });
  });
  unsubscribeFunctions.push(unsubscribeUnlike);
  
  const unsubscribeFavorite = eventBus.on(EVENT_TYPES.TOPIC_FAVORITED, (data: TopicInteractionEvent) => {
    get().updateTopicInteraction(data.topicId, { isFavorited: true });
  });
  unsubscribeFunctions.push(unsubscribeFavorite);
  
  const unsubscribeUnfavorite = eventBus.on(EVENT_TYPES.TOPIC_UNFAVORITED, (data: TopicInteractionEvent) => {
    get().updateTopicInteraction(data.topicId, { isFavorited: false });
  });
  unsubscribeFunctions.push(unsubscribeUnfavorite);
  
  const unsubscribeComment = eventBus.on(EVENT_TYPES.TOPIC_COMMENTED, (data: CommentEvent) => {
    get().updateTopicInteraction(data.topicId, { commentCount: data.commentCount });
  });
  unsubscribeFunctions.push(unsubscribeComment);
  
  const unsubscribeMessage = eventBus.on(EVENT_TYPES.MESSAGE_SENT, (data: MessageEvent) => {
    get().updateTopicInteraction(data.topicId, { 
      lastMessageTime: data.messageTime,
      participantCount: data.participantCount 
    });
  });
  unsubscribeFunctions.push(unsubscribeMessage);

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

  fetchMapTopics: async (latitude, longitude, refresh = false) => {
    set({ currentLocation: { latitude, longitude } });
    
    if (refresh) {
      // Clear cache and reset pagination for refresh
      cacheManager.invalidateCache(STORE_KEY, 'fetchMapTopics');
      set({ 
        hasMore: true,
        topics: [],
        filteredTopics: [],
        nextCursor: undefined
      });
    }
    
    const queryParams = {
      latitude,
      longitude,
      radiusKm: 10, // Larger radius for map view
      limit: Math.max(TOPICS_PER_PAGE, MINIMUM_MAP_TOPICS),
      cursor: refresh ? undefined : get().nextCursor,
      sortBy: 'activity' as const
    };

    // Use unified caching system
    const deduplicationResult = cacheManager.checkRequestDeduplication<any>(
      STORE_KEY,
      'fetchMapTopics',
      queryParams,
      { latitude, longitude }
    );

    try {
      // Handle cached data or pending requests
      if (!deduplicationResult.shouldRequest) {
        if (deduplicationResult.cachedData) {
          const result = deduplicationResult.cachedData;
          
          set({ 
            topics: result.topics,
            filteredTopics: result.topics,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
            isLoading: false,
            error: null
          });
          
          // Check user interactions for cached data
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id && result.topics.length > 0) {
            const topicIds = result.topics.map(t => t.id);
            await get().checkFavoriteStatus(topicIds, user.id);
            await get().checkLikeStatus(topicIds, user.id);
          }
          
          return;
        }
        
        if (deduplicationResult.pendingPromise) {
          set({ isLoading: true, error: null });
          
          try {
            const result = await deduplicationResult.pendingPromise;
            
            set({ 
              topics: result.topics,
              filteredTopics: result.topics,
              hasMore: result.hasMore,
              nextCursor: result.nextCursor,
              isLoading: false 
            });
            
            // Check user interactions
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id && result.topics.length > 0) {
              const topicIds = result.topics.map(t => t.id);
              await get().checkFavoriteStatus(topicIds, user.id);
              await get().checkLikeStatus(topicIds, user.id);
            }
          } catch (error) {
            set({ isLoading: false, error: '地図のトピックの取得に失敗しました' });
          }
          
          return;
        }
        
        // In debounce period, don't execute request
        return;
      }

      // Execute new request with caching
      set({ isLoading: true, error: null });
      
      const requestPromise = withNetworkRetry(async () => {
        const result = await fetchMapTopics(queryParams);
        return result;
      });
      
      // Register the pending request
      cacheManager.registerPendingRequest(
        STORE_KEY,
        'fetchMapTopics',
        queryParams,
        requestPromise
      );
      
      // Wait for request completion
      const result = await requestPromise;
      
      // Cache the result
      cacheManager.cacheResult(
        STORE_KEY,
        'fetchMapTopics',
        queryParams,
        result,
        { latitude, longitude }
      );
      
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
      
      // Re-apply search state
      const { searchQuery } = get();
      if (searchQuery) {
        get().searchTopics(searchQuery);
      }
      
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
      // Cleanup
      deduplicationResult.cleanup();
    }
  },

  loadMoreTopics: async (latitude, longitude) => {
    const { isLoadingMore, hasMore, nextCursor, topics } = get();
    
    if (isLoadingMore || !hasMore || !nextCursor) return;
    
    const queryParams = {
      latitude,
      longitude,
      radiusKm: 10,
      limit: TOPICS_PER_PAGE,
      cursor: nextCursor,
      sortBy: 'activity' as const
    };

    // Use unified caching for pagination
    const deduplicationResult = cacheManager.checkRequestDeduplication<any>(
      STORE_KEY,
      'loadMoreTopics',
      queryParams,
      { latitude, longitude }
    );

    try {
      if (!deduplicationResult.shouldRequest) {
        if (deduplicationResult.cachedData) {
          const result = deduplicationResult.cachedData;
          const existingTopicIds = new Set(topics.map(t => t.id));
          const uniqueNewTopics = result.topics.filter(topic => !existingTopicIds.has(topic.id));
          const allTopics = [...topics, ...uniqueNewTopics];
          
          set({ 
            topics: allTopics,
            filteredTopics: allTopics,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
            isLoadingMore: false,
            error: null
          });
          
          return;
        }
        
        if (deduplicationResult.pendingPromise) {
          set({ isLoadingMore: true, error: null });
          
          try {
            const result = await deduplicationResult.pendingPromise;
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
          } catch (error) {
            set({ isLoadingMore: false, error: 'さらなるトピックの取得に失敗しました' });
          }
          
          return;
        }
        
        return;
      }

      set({ isLoadingMore: true, error: null });
      
      const requestPromise = (async () => {
        const result = await fetchMapTopics(queryParams);
        return result;
      })();
      
      // Register pending request
      cacheManager.registerPendingRequest(
        STORE_KEY,
        'loadMoreTopics',
        queryParams,
        requestPromise
      );
      
      const result = await requestPromise;
      
      // Cache result
      cacheManager.cacheResult(
        STORE_KEY,
        'loadMoreTopics',
        queryParams,
        result,
        { latitude, longitude }
      );
      
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
      
      // Re-apply search state
      const { searchQuery } = get();
      if (searchQuery) {
        get().searchTopics(searchQuery);
      }
      
    } catch (error: any) {
      set({ 
        error: "さらなるトピックの取得に失敗しました", 
        isLoadingMore: false 
      });
    } finally {
      deduplicationResult.cleanup();
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
    const boundsParams = {
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west
    };

    // Use unified caching for viewport queries
    const deduplicationResult = cacheManager.checkRequestDeduplication<any>(
      STORE_KEY,
      'fetchTopicsInViewport',
      boundsParams
    );

    try {
      if (!deduplicationResult.shouldRequest) {
        if (deduplicationResult.cachedData) {
          const result = deduplicationResult.cachedData;
          
          set({ 
            topics: result.topics,
            filteredTopics: result.topics,
            hasMore: result.hasMore,
            currentBounds: bounds,
            isLoading: false,
            error: null
          });
          
          return;
        }
        
        if (deduplicationResult.pendingPromise) {
          set({ isLoading: true, error: null });
          
          try {
            const result = await deduplicationResult.pendingPromise;
            
            set({ 
              topics: result.topics,
              filteredTopics: result.topics,
              hasMore: result.hasMore,
              currentBounds: bounds,
              isLoading: false 
            });
          } catch (error) {
            set({ isLoading: false, error: 'ビューポート内のトピックの取得に失敗しました' });
          }
          
          return;
        }
        
        return;
      }

      set({ isLoading: true, error: null });
      
      const requestPromise = (async () => {
        const result = await fetchTopicsInBounds(bounds);
        return result;
      })();
      
      // Register pending request
      cacheManager.registerPendingRequest(
        STORE_KEY,
        'fetchTopicsInViewport',
        boundsParams,
        requestPromise
      );
      
      const result = await requestPromise;
      
      // Cache result
      cacheManager.cacheResult(
        STORE_KEY,
        'fetchTopicsInViewport',
        boundsParams,
        result
      );
      
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
      deduplicationResult.cleanup();
    }
  },

  cacheStats: () => {
    return cacheManager.getCacheStats(STORE_KEY);
  },

  invalidateCache: (method?: string) => {
    cacheManager.invalidateCache(STORE_KEY, method);
  },

  cleanup: () => {
    // 清理事件监听器
    unsubscribeFunctions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('[MapTopicsStore] Error during cleanup:', error);
      }
    });
    
    // 清空unsubscribe函数数组
    unsubscribeFunctions.length = 0;
    
    console.log('[MapTopicsStore] Cleanup completed');
  }
  });
});