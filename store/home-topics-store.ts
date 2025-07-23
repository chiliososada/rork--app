import { create } from 'zustand';
import { Topic } from '@/types';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, TopicInteractionEvent, CommentEvent, MessageEvent, TopicEvent, PAGE_EVENT_RELEVANCE } from '@/lib/event-bus';
// Removed topicCache import - now using unified caching system
import { fetchNearbyTopics, GeoQueryParams } from '@/lib/geo-queries';
import { supabase } from '@/lib/supabase';
import { cacheManager } from '@/lib/cache/cache-manager';
import { CACHE_PRESETS } from '@/lib/cache/base-store';
import { getCachedBatchTopicInteractionStatus } from '@/lib/database-optimizers';
import { requestDeduplicator } from '@/lib/cache/request-deduplicator';

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
  
  // 缓存和位置管理
  currentLocation?: { latitude: number; longitude: number };
  cacheStats: () => any;
  
  fetchNearbyTopics: (latitude: number, longitude: number, refresh?: boolean) => Promise<void>;
  loadMoreTopics: (latitude: number, longitude: number) => Promise<void>;
  searchTopics: (query: string) => void;
  clearSearch: () => void;
  updateTopicInteraction: (topicId: string, updates: Partial<Topic>) => void;
  checkInteractionStatus: (topicIds: string[], userId: string) => Promise<void>;
  invalidateCache: (method?: string) => void;
}

const TOPICS_PER_PAGE = 10;
const STORE_KEY = 'home-topics';

// 初始化缓存配置
cacheManager.registerConfig(STORE_KEY, {
  ...CACHE_PRESETS.SHORT_TERM,
  ttl: 5 * 60 * 1000, // 5分钟 - 因为附近话题可能经常变化
  locationThreshold: 500, // 500米位置变化失效
  debounceTime: 2000, // 2秒防抖
});

export const useHomeTopicsStore = create<HomeTopicsState>((set, get) => {
  // Optimized event listeners setup with automatic cleanup and filtering
  const setupEventListeners = () => {
    const unsubscribers: Array<() => void> = [];
    
    // Only listen to events relevant to the HOME page
    const homeRelevantEvents = PAGE_EVENT_RELEVANCE.HOME;
    
    // Subscribe to relevant events with debouncing for performance
    if (homeRelevantEvents.has(EVENT_TYPES.TOPIC_LIKED)) {
      const unsubscribe = eventBus.on(EVENT_TYPES.TOPIC_LIKED, (data: TopicInteractionEvent) => {
        get().updateTopicInteraction(data.topicId, { isLiked: true, likesCount: data.count });
      });
      unsubscribers.push(unsubscribe);
    }
    
    if (homeRelevantEvents.has(EVENT_TYPES.TOPIC_UNLIKED)) {
      const unsubscribe = eventBus.on(EVENT_TYPES.TOPIC_UNLIKED, (data: TopicInteractionEvent) => {
        get().updateTopicInteraction(data.topicId, { isLiked: false, likesCount: data.count });
      });
      unsubscribers.push(unsubscribe);
    }
    
    if (homeRelevantEvents.has(EVENT_TYPES.TOPIC_FAVORITED)) {
      const unsubscribe = eventBus.on(EVENT_TYPES.TOPIC_FAVORITED, (data: TopicInteractionEvent) => {
        get().updateTopicInteraction(data.topicId, { isFavorited: true });
      });
      unsubscribers.push(unsubscribe);
    }
    
    if (homeRelevantEvents.has(EVENT_TYPES.TOPIC_UNFAVORITED)) {
      const unsubscribe = eventBus.on(EVENT_TYPES.TOPIC_UNFAVORITED, (data: TopicInteractionEvent) => {
        get().updateTopicInteraction(data.topicId, { isFavorited: false });
      });
      unsubscribers.push(unsubscribe);
    }
    
    if (homeRelevantEvents.has(EVENT_TYPES.TOPIC_COMMENTED)) {
      const unsubscribe = eventBus.on(EVENT_TYPES.TOPIC_COMMENTED, (data: CommentEvent) => {
        get().updateTopicInteraction(data.topicId, { commentCount: data.commentCount });
      });
      unsubscribers.push(unsubscribe);
    }
    
    if (homeRelevantEvents.has(EVENT_TYPES.TOPIC_CREATED)) {
      const unsubscribe = eventBus.on(EVENT_TYPES.TOPIC_CREATED, (data: TopicEvent) => {
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
      unsubscribers.push(unsubscribe);
    }
    
    // Return cleanup function
    return () => {
      unsubscribers.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('[HomeTopicsStore] Error during event cleanup:', error);
        }
      });
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

  fetchNearbyTopics: async (latitude, longitude, refresh = false) => {
    set({ currentLocation: { latitude, longitude } });
    
    if (refresh) {
      // Clear cache and reset pagination for refresh
      cacheManager.invalidateCache(STORE_KEY, 'fetchNearbyTopics');
      set({ 
        hasMore: true,
        topics: [],
        filteredTopics: [],
        nextCursor: undefined
      });
    }
    
    const queryParams: GeoQueryParams = {
      latitude,
      longitude,
      radiusKm: 5, // 5km radius for nearby topics
      limit: 10,
      cursor: refresh ? undefined : get().nextCursor,
      sortBy: 'distance'
    };

    // Use unified caching system
    const deduplicationResult = cacheManager.checkRequestDeduplication<any>(
      STORE_KEY,
      'fetchNearbyTopics',
      queryParams,
      { latitude, longitude }
    );

    try {
      // If we shouldn't make a request, handle cached data or wait for pending request
      if (!deduplicationResult.shouldRequest) {
        if (deduplicationResult.cachedData) {
          const result = deduplicationResult.cachedData;
          
          // Apply cached data to state
          set({ 
            topics: result.topics,
            filteredTopics: result.topics,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
            isLoading: false,
            error: null
          });
          
          // Still check user interactions for cached data
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id && result.topics.length > 0) {
            const topicIds = result.topics.map(t => t.id);
            await get().checkInteractionStatus(topicIds, user.id);
          }
          
          return;
        }
        
        if (deduplicationResult.pendingPromise) {
          // Wait for the pending request
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
              await get().checkInteractionStatus(topicIds, user.id);
            }
          } catch (error) {
            set({ isLoading: false, error: '近くのトピックの取得に失敗しました' });
          }
          
          return;
        }
        
        // In debounce period, don't execute request
        return;
      }

      // Execute new request with caching
      set({ isLoading: true, error: null });
      
      const requestPromise = withNetworkRetry(async () => {
        const result = await fetchNearbyTopics(queryParams);
        
        // Topics are now cached through the unified cache system
        
        return result;
      });
      
      // Register the pending request
      cacheManager.registerPendingRequest(
        STORE_KEY,
        'fetchNearbyTopics',
        queryParams,
        requestPromise
      );
      
      // Wait for request completion
      const result = await requestPromise;
      
      // Cache the result
      cacheManager.cacheResult(
        STORE_KEY,
        'fetchNearbyTopics',
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
      
      // Check user interaction status
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
      console.error('Failed to fetch nearby topics:', error);
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : '近くのトピックの取得に失敗しました';
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
    
    const queryParams: GeoQueryParams = {
      latitude,
      longitude,
      radiusKm: 5,
      limit: 10,
      cursor: nextCursor,
      sortBy: 'distance'
    };

    // Use unified caching for pagination as well
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
          
          // Merge cached data with existing topics
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
        const result = await fetchNearbyTopics(queryParams);
        
        // Topics are cached through the unified cache system
        
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
      
      // Check interaction status for new topics
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

  cacheStats: () => {
    return cacheManager.getCacheStats(STORE_KEY);
  },

  invalidateCache: (method?: string) => {
    cacheManager.invalidateCache(STORE_KEY, method);
  }
  });
});

