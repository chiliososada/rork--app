import { create } from 'zustand';
import { Topic } from '@/types';
import { supabase } from '@/lib/supabase';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, TopicInteractionEvent, CommentEvent, MessageEvent, TopicEvent } from '@/lib/event-bus';
import { fetchParticipatedTopics, GeoQueryParams } from '@/lib/geo-queries';
import { cacheManager } from '@/lib/cache/cache-manager';
import { CACHE_PRESETS } from '@/lib/cache/base-store';
import { getCachedBatchTopicInteractionStatus } from '@/lib/database-optimizers';

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
  
  // 缓存管理
  cacheStats: () => any;
  
  fetchChatTopics: (userId: string, refresh?: boolean) => Promise<void>;
  loadMoreChatTopics: (userId: string) => Promise<void>;
  searchTopics: (query: string) => void;
  clearSearch: () => void;
  updateTopicInteraction: (topicId: string, updates: Partial<Topic>) => void;
  updateLastMessageTime: (topicId: string, messageTime: string) => void;
  markAsParticipated: (topicId: string) => void;
  checkInteractionStatus: (topicIds: string[], userId: string) => Promise<void>;
  joinTopic: (topicId: string, userId: string) => Promise<void>;
  leaveTopic: (topicId: string, userId: string) => Promise<void>;
  checkParticipationStatus: (topicIds: string[], userId: string) => Promise<void>;
  invalidateCache: (method?: string) => void;
  cleanup: () => void;
}

const TOPICS_PER_PAGE = 20; // チャットは一度に多め
const STORE_KEY = 'chat-topics';

// 初始化缓存配置
cacheManager.registerConfig(STORE_KEY, {
  ...CACHE_PRESETS.USER_DATA,
  ttl: 5 * 60 * 1000, // 5分钟 - 聊天数据需要频繁更新
  debounceTime: 1000, // 1秒防抖
});

export const useChatTopicsStore = create<ChatTopicsState>((set, get) => {
  // Set up event listeners with cleanup tracking
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
    if (refresh) {
      // Clear cache and reset pagination for refresh
      cacheManager.invalidateCache(STORE_KEY, 'fetchChatTopics');
      set({ 
        hasMore: true,
        topics: [],
        filteredTopics: [],
        userParticipatedTopicIds: new Set(),
        nextCursor: undefined
      });
    }
    
    const queryParams = {
      userId,
      limit: TOPICS_PER_PAGE,
      cursor: refresh ? undefined : get().nextCursor
    };

    // Use unified caching system
    const deduplicationResult = cacheManager.checkRequestDeduplication<any>(
      STORE_KEY,
      'fetchChatTopics',
      queryParams
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
            userParticipatedTopicIds: result.userParticipatedTopicIds,
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
              nextCursor: result.nextCursor,
              userParticipatedTopicIds: result.userParticipatedTopicIds,
              isLoading: false 
            });
          } catch (error) {
            set({ isLoading: false, error: 'チャットルームの取得に失敗しました' });
          }
          
          return;
        }
        
        return;
      }

      // Execute new request with caching
      set({ isLoading: true, error: null, lastRefreshTime: Date.now() });
    
      const requestPromise = withNetworkRetry(async () => {
        // 使用RPC函数获取用户的聊天话题
        const offset = refresh ? 0 : (get().nextCursor ? parseInt(get().nextCursor!) : 0);
        
        const { data: topicsData, error: topicsError } = await supabase
          .rpc('get_user_chat_topics', {
            user_id_param: userId,
            limit_count: TOPICS_PER_PAGE,
            offset_count: offset
          });

        if (topicsError) {
          throw topicsError;
        }

        // 获取总数以判断是否有更多数据
        const { data: totalCount, error: countError } = await supabase
          .rpc('get_user_chat_topics_count', {
            user_id_param: userId
          });

        if (countError) {
          console.error('Failed to get topics count:', countError);
        }

        // 构建参与话题ID集合
        const participatedTopicIds = new Set<string>();
        (topicsData || []).forEach((topic: any) => {
          if (topic.is_creator || topic.is_participant) {
            participatedTopicIds.add(topic.id);
          }
        });
        
        set({ userParticipatedTopicIds: participatedTopicIds });

        // Transform data
        const topics: Topic[] = (topicsData || []).map((topic: any) => {
          return {
            id: topic.id,
            title: topic.title,
            description: topic.description || '',
            createdAt: topic.created_at,
            author: {
              id: topic.user_id,
              name: topic.user_nickname,
              avatar: topic.user_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topic.user_nickname)}&background=random`,
              email: topic.user_email
            },
            location: {
              latitude: topic.latitude,
              longitude: topic.longitude,
              name: topic.location_name || undefined
            },
            commentCount: Number(topic.comment_count) || 0,
            participantCount: Number(topic.participant_count) || 1,
            lastMessageTime: topic.last_message_time || undefined,
            imageUrl: topic.image_url || undefined,
            aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
            isFavorited: false,
            isLiked: false,
            likesCount: 0,
            // チャット用追加フィールド
            isParticipated: topic.is_creator || topic.is_participant,
            lastMessagePreview: topic.last_message_preview,
            joinedAt: topic.joined_at
          };
        });

        const hasMore = totalCount ? (offset + topics.length) < totalCount : false;
        const nextOffset = offset + TOPICS_PER_PAGE;
        
        const result = {
          topics: topics,
          hasMore: hasMore,
          nextCursor: hasMore ? `${nextOffset}` : undefined,
          userParticipatedTopicIds: participatedTopicIds
        };
        
        return result;
      });
      
      // Register the pending request
      cacheManager.registerPendingRequest(
        STORE_KEY,
        'fetchChatTopics',
        queryParams,
        requestPromise
      );
      
      // Wait for request completion
      const result = await requestPromise;
      
      // Cache the result
      cacheManager.cacheResult(
        STORE_KEY,
        'fetchChatTopics',
        queryParams,
        result
      );
      
      set({ 
        topics: result.topics,
        filteredTopics: result.topics,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
        userParticipatedTopicIds: result.userParticipatedTopicIds,
        isLoading: false 
      });
      
      // Re-apply search state
      const { searchQuery } = get();
      if (searchQuery) {
        get().searchTopics(searchQuery);
      }
    } catch (error: any) {
      console.error('Failed to fetch chat topics:', error);
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : 'チャットルームの取得に失敗しました';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
    } finally {
      // Cleanup
      deduplicationResult.cleanup();
    }
  },

  loadMoreChatTopics: async (userId) => {
    const { isLoadingMore, hasMore, nextCursor, topics, userParticipatedTopicIds } = get();
    
    if (isLoadingMore || !hasMore || !nextCursor) return;
    
    const queryParams = {
      userId,
      limit: TOPICS_PER_PAGE,
      cursor: nextCursor
    };

    // Use unified caching for pagination
    const deduplicationResult = cacheManager.checkRequestDeduplication<any>(
      STORE_KEY,
      'loadMoreChatTopics',
      queryParams
    );

    try {
      if (!deduplicationResult.shouldRequest) {
        if (deduplicationResult.cachedData) {
          const result = deduplicationResult.cachedData;
          const existingTopicIds = new Set(topics.map(t => t.id));
          const uniqueNewTopics = result.topics.filter((topic: any) => !existingTopicIds.has(topic.id));
          const allTopics = [...topics, ...uniqueNewTopics];
          
          // 参与状態を更新（データベースで既にソート済み）
          const updatedParticipatedIds = new Set(get().userParticipatedTopicIds);
          uniqueNewTopics.forEach((topic: any) => {
            if (topic.isParticipated) {
              updatedParticipatedIds.add(topic.id);
            }
          });
          
          set({ 
            topics: allTopics,
            filteredTopics: allTopics,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
            userParticipatedTopicIds: updatedParticipatedIds,
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
            
            // 参与状態を更新（データベースで既にソート済み）
            const updatedParticipatedIds = new Set(get().userParticipatedTopicIds);
            uniqueNewTopics.forEach((topic: any) => {
              if (topic.isParticipated) {
                updatedParticipatedIds.add(topic.id);
              }
            });
            
            set({ 
              topics: allTopics,
              filteredTopics: allTopics,
              hasMore: result.hasMore,
              nextCursor: result.nextCursor,
              userParticipatedTopicIds: updatedParticipatedIds,
              isLoadingMore: false 
            });
          } catch (error) {
            set({ isLoadingMore: false, error: 'さらなるチャットルームの取得に失敗しました' });
          }
          
          return;
        }
        
        return;
      }

      set({ isLoadingMore: true, error: null });
      
      // For simplicity, use offset-based pagination for now
      const currentOffset = parseInt(nextCursor);
      const from = currentOffset;
      const to = from + TOPICS_PER_PAGE - 1;
      
      const requestPromise = (async () => {
        // 使用RPC函数获取用户的聊天话题
        const { data: topicsData, error: topicsError } = await supabase
          .rpc('get_user_chat_topics', {
            user_id_param: userId,
            limit_count: TOPICS_PER_PAGE,
            offset_count: currentOffset
          });

        if (topicsError) {
          throw topicsError;
        }

        // 获取总数以判断是否有更多数据
        const { data: totalCount, error: countError } = await supabase
          .rpc('get_user_chat_topics_count', {
            user_id_param: userId
          });

        if (countError) {
          console.error('Failed to get topics count:', countError);
        }

        // Transform data
        const newTopics: Topic[] = (topicsData || []).map((topic: any) => {
          return {
            id: topic.id,
            title: topic.title,
            description: topic.description || '',
            createdAt: topic.created_at,
            author: {
              id: topic.user_id,
              name: topic.user_nickname,
              avatar: topic.user_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topic.user_nickname)}&background=random`,
              email: topic.user_email
            },
            location: {
              latitude: topic.latitude,
              longitude: topic.longitude,
              name: topic.location_name || undefined
            },
            commentCount: Number(topic.comment_count) || 0,
            participantCount: Number(topic.participant_count) || 1,
            lastMessageTime: topic.last_message_time || undefined,
            imageUrl: topic.image_url || undefined,
            aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
            isFavorited: false,
            isLiked: false,
            likesCount: 0,
            isParticipated: topic.is_creator || topic.is_participant,
            lastMessagePreview: topic.last_message_preview,
            joinedAt: topic.joined_at
          };
        });

        const hasMore = totalCount ? (currentOffset + newTopics.length) < totalCount : false;
        
        return {
          topics: newTopics,
          hasMore: hasMore,
          nextCursor: hasMore ? `${currentOffset + TOPICS_PER_PAGE}` : undefined
        };
      })();
      
      // Register pending request
      cacheManager.registerPendingRequest(
        STORE_KEY,
        'loadMoreChatTopics',
        queryParams,
        requestPromise
      );
      
      const result = await requestPromise;
      
      // Cache result
      cacheManager.cacheResult(
        STORE_KEY,
        'loadMoreChatTopics',
        queryParams,
        result
      );
      
      // 重複を避けて結合（データベースで既にソート済み）
      const existingTopicIds = new Set(topics.map(t => t.id));
      const uniqueNewTopics = result.topics.filter(topic => !existingTopicIds.has(topic.id));
      
      const allTopics = [...topics, ...uniqueNewTopics];
      
      // 参与状態を更新
      const updatedParticipatedIds = new Set(get().userParticipatedTopicIds);
      uniqueNewTopics.forEach((topic: any) => {
        if (topic.isParticipated) {
          updatedParticipatedIds.add(topic.id);
        }
      });
      
      set({ 
        topics: allTopics,
        filteredTopics: allTopics,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
        userParticipatedTopicIds: updatedParticipatedIds,
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

  updateLastMessageTime: (topicId, messageTime) => {
    set(state => {
      const updatedTopics = state.topics.map(topic => 
        topic.id === topicId 
          ? { ...topic, lastMessageTime: messageTime }
          : topic
      );
      
      // 新しいメッセージがあるトピックを最上部に移動
      const targetTopicIndex = updatedTopics.findIndex(t => t.id === topicId);
      if (targetTopicIndex > 0) {
        const targetTopic = updatedTopics[targetTopicIndex];
        updatedTopics.splice(targetTopicIndex, 1);
        updatedTopics.unshift(targetTopic);
      }
      
      return {
        topics: updatedTopics,
        filteredTopics: state.searchQuery 
          ? state.filteredTopics.map(topic => 
              topic.id === topicId 
                ? { ...topic, lastMessageTime: messageTime }
                : topic
            )
          : updatedTopics
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
      
      return {
        userParticipatedTopicIds: newParticipatedIds,
        topics: updatedTopics,
        filteredTopics: state.searchQuery 
          ? state.filteredTopics.map(topic => 
              topic.id === topicId ? { ...topic, isParticipated: true } : topic
            )
          : updatedTopics
      };
    });
    
    // Also emit event for other stores
    eventBus.emit(EVENT_TYPES.MESSAGE_SENT, { 
      topicId, 
      userId: '', // This would be passed from the caller
      messageTime: new Date().toISOString(),
      participantCount: get().topics.find(t => t.id === topicId)?.participantCount
    } as MessageEvent);
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

  joinTopic: async (topicId, userId) => {
    try {
      // 插入或更新参与记录
      const { error } = await supabase
        .from('topic_participants')
        .upsert(
          { topic_id: topicId, user_id: userId, is_active: true },
          { onConflict: 'topic_id,user_id' }
        );

      if (error) {
        throw error;
      }

      // 更新本地状態（次回のリフレッシュで正しい順序になる）
      set(state => {
        const newParticipatedIds = new Set(state.userParticipatedTopicIds);
        newParticipatedIds.add(topicId);
        
        const updatedTopics = state.topics.map(topic => 
          topic.id === topicId ? { ...topic, isParticipated: true } : topic
        );
        
        return {
          userParticipatedTopicIds: newParticipatedIds,
          topics: updatedTopics,
          filteredTopics: state.searchQuery 
            ? state.filteredTopics.map(topic => 
                topic.id === topicId ? { ...topic, isParticipated: true } : topic
              )
            : updatedTopics
        };
      });
    } catch (error: any) {
      console.error('Failed to join topic:', error);
      throw error;
    }
  },

  leaveTopic: async (topicId, userId) => {
    try {
      // 将is_active设为false而不是删除记录
      const { error } = await supabase
        .from('topic_participants')
        .update({ is_active: false })
        .eq('topic_id', topicId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // 更新本地状态：从列表中移除话题（除非是创建者）
      set(state => {
        const newParticipatedIds = new Set(state.userParticipatedTopicIds);
        newParticipatedIds.delete(topicId);
        
        // 如果用户不是创建者，则从列表中移除
        const topicToUpdate = state.topics.find(t => t.id === topicId);
        const isCreator = topicToUpdate?.author.id === userId;
        
        let updatedTopics: Topic[];
        if (isCreator) {
          // 创建者只更新状态，不移除
          updatedTopics = state.topics.map(topic => 
            topic.id === topicId ? { ...topic, isParticipated: false } : topic
          );
        } else {
          // 非创建者，从列表中移除
          updatedTopics = state.topics.filter(topic => topic.id !== topicId);
        }
        
        return {
          userParticipatedTopicIds: newParticipatedIds,
          topics: updatedTopics,
          filteredTopics: state.searchQuery 
            ? state.filteredTopics.filter(topic => isCreator || topic.id !== topicId)
            : updatedTopics
        };
      });
    } catch (error: any) {
      console.error('Failed to leave topic:', error);
      throw error;
    }
  },

  checkParticipationStatus: async (topicIds, userId) => {
    try {
      // 使用RPC函数批量检查参与状态
      const { data: participationStatuses, error } = await supabase
        .rpc('check_user_participation', {
          user_id_param: userId,
          topic_ids: topicIds
        });

      if (error) {
        console.error('Error checking participation status:', error);
        return;
      }

      const statusMap = new Map(
        participationStatuses?.map((status: any) => [status.topic_id, status.is_participant]) || []
      );
      
      set(state => ({
        topics: state.topics.map(topic => {
          if (!topicIds.includes(topic.id)) return topic;
          
          const isParticipated = Boolean(statusMap.get(topic.id)) || false;
          return { ...topic, isParticipated };
        }),
        filteredTopics: state.filteredTopics.map(topic => {
          if (!topicIds.includes(topic.id)) return topic;
          
          const isParticipated = Boolean(statusMap.get(topic.id)) || false;
          return { ...topic, isParticipated };
        })
      }));
    } catch (error: any) {
      console.error('Error checking participation status:', error);
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
        console.error('[ChatTopicsStore] Error during cleanup:', error);
      }
    });
    
    // 清空unsubscribe函数数组
    unsubscribeFunctions.length = 0;
    
    console.log('[ChatTopicsStore] Cleanup completed');
  }
  });
});