import { create } from 'zustand';
import { Topic } from '@/types';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, TopicInteractionEvent, CommentEvent, MessageEvent, TopicEvent } from '@/lib/event-bus';
import { fetchMapTopics, fetchTopicsInBounds, searchMapTopics, GeoQueryParams } from '@/lib/geo-queries';
import { supabase } from '@/lib/supabase';
import { cacheManager } from '@/lib/cache/cache-manager';
import { CACHE_PRESETS } from '@/lib/cache/base-store';
import { getCachedBatchTopicInteractionStatus } from '@/lib/database-optimizers';
import { useSearchSettingsStore } from './search-settings-store';

interface MapTopicsState {
  topics: Topic[];
  filteredTopics: Topic[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  searchQuery: string;
  
  // Search-specific state
  isSearching: boolean;
  searchResults: Topic[];
  searchHasMore: boolean;
  searchNextCursor?: string;
  isSearchMode: boolean; // Whether we're in search mode or normal browsing
  
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
  searchTopics: (query: string) => Promise<void>;
  loadMoreSearchResults: () => Promise<void>;
  clearSearch: () => void;
  updateTopicInteraction: (topicId: string, updates: Partial<Topic>) => void;
  checkInteractionStatus: (topicIds: string[], userId: string) => Promise<void>;
  invalidateCache: (method?: string) => void;
  cleanup: () => void;
}

const TOPICS_PER_PAGE = 10;
const MINIMUM_MAP_TOPICS = 30;
const STORE_KEY = 'map-topics';

// Search debounce timeout for map topics
let mapSearchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

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
  
  // Search-specific state
  isSearching: false,
  searchResults: [],
  searchHasMore: false,
  searchNextCursor: undefined,
  isSearchMode: false,
  
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
    
    // Get search settings from settings store
    const searchSettings = useSearchSettingsStore.getState().settings;
    
    // Get current user ID for privacy filtering
    const { data: { user } } = await supabase.auth.getUser();
    
    const queryParams = {
      latitude,
      longitude,
      radiusKm: searchSettings.radiusKm * 2, // Larger radius for map view
      timeRange: searchSettings.timeRange,
      limit: Math.max(TOPICS_PER_PAGE, MINIMUM_MAP_TOPICS),
      cursor: refresh ? undefined : get().nextCursor,
      sortBy: 'activity' as const,
      currentUserId: user?.id
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
            const topicIds = result.topics.map((t: any) => t.id);
            await get().checkInteractionStatus(topicIds, user.id);
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
              const topicIds = result.topics.map((t: any) => t.id);
              await get().checkInteractionStatus(topicIds, user.id);
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
        await get().checkInteractionStatus(topicIds, user.id);
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
    
    // Get search settings from settings store
    const searchSettings = useSearchSettingsStore.getState().settings;
    
    // Get current user ID for privacy filtering
    const { data: { user } } = await supabase.auth.getUser();
    
    const queryParams = {
      latitude,
      longitude,
      radiusKm: searchSettings.radiusKm * 2, // Larger radius for map view
      timeRange: searchSettings.timeRange,
      limit: TOPICS_PER_PAGE,
      cursor: nextCursor,
      sortBy: 'activity' as const,
      currentUserId: user?.id
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
          const uniqueNewTopics = result.topics.filter((topic: any) => !existingTopicIds.has(topic.id));
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
            const uniqueNewTopics = result.topics.filter((topic: any) => !existingTopicIds.has(topic.id));
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
        await get().checkInteractionStatus(newTopicIds, user.id);
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

  searchTopics: async (query) => {
    const normalizedQuery = query.trim();
    
    // Update search query immediately for UI responsiveness
    set({ searchQuery: query });
    
    // Clear previous debounce timeout
    if (mapSearchDebounceTimeout) {
      clearTimeout(mapSearchDebounceTimeout);
    }
    
    // If empty query, clear search and return to normal browsing
    if (!normalizedQuery) {
      set({
        isSearchMode: false,
        isSearching: false,
        searchResults: [],
        searchHasMore: false,
        searchNextCursor: undefined,
        filteredTopics: get().topics
      });
      return;
    }
    
    // Debounce search requests
    mapSearchDebounceTimeout = setTimeout(async () => {
      const { currentLocation } = get();
      
      if (!currentLocation) {
        console.warn('No current location available for map search');
        return;
      }
      
      set({ 
        isSearching: true, 
        isSearchMode: true,
        error: null 
      });
      
      try {
        // Get search settings
        const searchSettings = useSearchSettingsStore.getState().settings;
        
        // Get current user ID for privacy filtering
        const { data: { user } } = await supabase.auth.getUser();
        
        const searchParams = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radiusKm: searchSettings.radiusKm * 2, // Larger radius for map
          timeRange: searchSettings.timeRange,
          searchQuery: normalizedQuery,
          limit: 30, // More results for map
          currentUserId: user?.id
        };
        
        const result = await withNetworkRetry(async () => {
          return await searchMapTopics(searchParams);
        });
        
        set({
          searchResults: result.topics,
          filteredTopics: result.topics,
          searchHasMore: result.hasMore,
          searchNextCursor: result.nextCursor,
          isSearching: false
        });
        
        // Check user interaction status for search results
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && result.topics.length > 0) {
          const topicIds = result.topics.map(t => t.id);
          await get().checkInteractionStatus(topicIds, user.id);
        }
        
      } catch (error: any) {
        console.error('Failed to search map topics:', error);
        const errorMessage = isNetworkError(error) 
          ? 'ネットワーク接続を確認してください' 
          : '地図検索に失敗しました';
        set({ 
          error: errorMessage, 
          isSearching: false,
          searchResults: [],
          filteredTopics: []
        });
      }
    }, 500); // 500ms debounce
  },
  
  loadMoreSearchResults: async () => {
    const { 
      isSearching, 
      searchHasMore, 
      searchNextCursor, 
      searchResults, 
      searchQuery,
      currentLocation 
    } = get();
    
    if (isSearching || !searchHasMore || !searchNextCursor || !currentLocation || !searchQuery.trim()) {
      return;
    }
    
    set({ isSearching: true, error: null });
    
    try {
      const searchSettings = useSearchSettingsStore.getState().settings;
      
      // Get current user ID for privacy filtering
      const { data: { user } } = await supabase.auth.getUser();
      
      const searchParams = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radiusKm: searchSettings.radiusKm * 2,
        timeRange: searchSettings.timeRange,
        searchQuery: searchQuery.trim(),
        cursor: searchNextCursor,
        limit: 30,
        currentUserId: user?.id
      };
      
      const result = await searchMapTopics(searchParams);
      
      // Merge with existing search results, avoiding duplicates
      const existingIds = new Set(searchResults.map(t => t.id));
      const newTopics = result.topics.filter(topic => !existingIds.has(topic.id));
      const allSearchResults = [...searchResults, ...newTopics];
      
      set({
        searchResults: allSearchResults,
        filteredTopics: allSearchResults,
        searchHasMore: result.hasMore,
        searchNextCursor: result.nextCursor,
        isSearching: false
      });
      
      // Check interaction status for new topics
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && newTopics.length > 0) {
        const newTopicIds = newTopics.map(t => t.id);
        await get().checkInteractionStatus(newTopicIds, user.id);
      }
      
    } catch (error: any) {
      console.error('Failed to load more map search results:', error);
      set({ 
        error: 'さらなる検索結果の取得に失敗しました', 
        isSearching: false 
      });
    }
  },

  clearSearch: () => {
    const { topics } = get();
    
    // Clear any pending search debounce
    if (mapSearchDebounceTimeout) {
      clearTimeout(mapSearchDebounceTimeout);
      mapSearchDebounceTimeout = null;
    }
    
    set({ 
      filteredTopics: topics,
      searchQuery: '',
      isSearchMode: false,
      isSearching: false,
      searchResults: [],
      searchHasMore: false,
      searchNextCursor: undefined
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

  checkInteractionStatus: async (topicIds, userId) => {
    try {
      // Use optimized batch query instead of individual queries
      const interactionStatuses = await getCachedBatchTopicInteractionStatus(topicIds, userId);
      
      const targetTopicIds = new Set(topicIds);
      const statusMap = new Map(
        interactionStatuses.map(status => [status.topicId, status])
      );
      
      set(state => ({
        topics: state.topics.map(topic => {
          if (!targetTopicIds.has(topic.id)) return topic;
          
          const status = statusMap.get(topic.id);
          if (!status) return topic;
          
          return {
            ...topic,
            isLiked: status.isLiked,
            isFavorited: status.isFavorited,
            likesCount: status.likesCount,
            commentCount: status.commentsCount
          };
        }),
        filteredTopics: state.filteredTopics.map(topic => {
          if (!targetTopicIds.has(topic.id)) return topic;
          
          const status = statusMap.get(topic.id);
          if (!status) return topic;
          
          return {
            ...topic,
            isLiked: status.isLiked,
            isFavorited: status.isFavorited,
            likesCount: status.likesCount,
            commentCount: status.commentsCount
          };
        })
      }));
    } catch (error: any) {
      console.error('Error checking interaction status:', error);
    }
  },

  fetchTopicsInViewport: async (bounds) => {
    // Get current user ID for privacy filtering
    const { data: { user } } = await supabase.auth.getUser();
    
    const boundsParams = {
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
      currentUserId: user?.id
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
        const result = await fetchTopicsInBounds(bounds, user?.id);
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
        await get().checkInteractionStatus(topicIds, user.id);
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