import { create } from 'zustand';
import { EnhancedTopic, SmartRecommendation, CategoryConfig, ChallengeActivity, ExploreInteractionType } from '@/types';
import { supabase } from '@/lib/supabase';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, TopicInteractionEvent, CommentEvent, MessageEvent } from '@/lib/event-bus';
import { getCachedBatchTopicInteractionStatus } from '@/lib/database-optimizers';
import { useAuthStore } from './auth-store';

interface ExploreState {
  // 推荐话题列表
  topics: EnhancedTopic[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  
  // 分类相关
  categories: CategoryConfig[];
  selectedCategory: string;
  
  // 智能推荐
  recommendations: SmartRecommendation[];
  isLoadingRecommendations: boolean;
  
  // 挑战活动
  challenges: ChallengeActivity[];
  
  // 分页
  currentPage: number;
  pageSize: number;
  
  // Actions
  fetchCategories: () => Promise<void>;
  fetchRecommendations: () => Promise<void>;
  fetchTopics: (latitude: number, longitude: number, refresh?: boolean) => Promise<void>;
  loadMoreTopics: (latitude: number, longitude: number) => Promise<void>;
  selectCategory: (categoryKey: string) => void;
  trackInteraction: (topicId: string, interactionType: ExploreInteractionType, category?: string) => Promise<void>;
  updateTopicInteraction: (topicId: string, updates: Partial<EnhancedTopic>) => void;
  checkInteractionStatus: (topicIds: string[], userId: string) => Promise<void>;
  cleanup: () => void;
}

const TOPICS_PER_PAGE = 20;

export const useExploreStore = create<ExploreState>((set, get) => {
  // 设置事件监听器
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

  return {
    topics: [],
    isLoading: false,
    isLoadingMore: false,
    hasMore: true,
    error: null,
    
    categories: [],
    selectedCategory: 'recommended',
    
    recommendations: [],
    isLoadingRecommendations: false,
    
    challenges: [],
    
    currentPage: 0,
    pageSize: TOPICS_PER_PAGE,
    
    fetchCategories: async () => {
      try {
        const { data, error } = await supabase
          .from('category_configs')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
          
        if (error) throw error;
        
        const categories = data?.map(cat => ({
          categoryKey: cat.category_key,
          displayName: cat.display_name,
          iconEmoji: cat.icon_emoji,
          colorCode: cat.color_code,
          commercialPriority: cat.commercial_priority,
          isActive: cat.is_active,
          sortOrder: cat.sort_order
        })) || [];
        
        set({ categories });
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    },
    
    fetchRecommendations: async () => {
      set({ isLoadingRecommendations: true });
      
      try {
        const { user } = useAuthStore.getState();
        
        const { data, error } = await supabase
          .rpc('get_featured_recommendations', {
            user_id_param: user?.id,
            limit_count: 5
          });
          
        if (error) throw error;
        
        const recommendations = data?.map((rec: any) => ({
          id: rec.id,
          title: rec.title,
          subtitle: rec.subtitle,
          description: rec.description,
          recommendationType: rec.recommendation_type,
          imageUrl: rec.image_url,
          gradientColors: rec.gradient_colors || ['#667eea', '#764ba2'],
          isSponsored: rec.is_sponsored,
          sponsorName: rec.sponsor_name,
          targetUrl: rec.target_url,
          topicId: rec.topic_id
        })) || [];
        
        // 获取活跃挑战
        const { data: challengeData } = await supabase
          .rpc('get_active_challenges', { limit_count: 3 });
          
        const challenges = challengeData?.map((ch: any) => ({
          id: ch.id,
          title: ch.title,
          description: ch.description,
          participantCount: ch.participant_count,
          targetParticipantCount: ch.target_participant_count,
          deadline: ch.deadline,
          badgeImageUrl: ch.badge_image_url,
          challengeTags: ch.challenge_tags
        })) || [];
        
        set({ recommendations, challenges, isLoadingRecommendations: false });
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
        set({ isLoadingRecommendations: false });
      }
    },
    
    fetchTopics: async (latitude: number, longitude: number, refresh = false) => {
      if (refresh) {
        set({ 
          topics: [], 
          currentPage: 0, 
          hasMore: true,
          error: null 
        });
      }
      
      set({ isLoading: true });
      
      try {
        const { user } = useAuthStore.getState();
        const { selectedCategory, currentPage, pageSize } = get();
        
        // 根据选中的分类调用不同的RPC函数
        const rpcFunction = selectedCategory === 'recommended' 
          ? 'get_recommended_topics_v2'
          : 'get_topics_by_category_v2';
          
        const params = selectedCategory === 'recommended'
          ? {
              user_id_param: user?.id,
              user_lat: latitude,
              user_lng: longitude,
              limit_count: pageSize,
              offset_count: currentPage * pageSize
            }
          : {
              category_param: selectedCategory,
              user_lat: latitude,
              user_lng: longitude,
              user_id_param: user?.id,
              limit_count: pageSize,
              offset_count: currentPage * pageSize
            };
        
        const { data, error } = await withNetworkRetry(async () => {
          return await supabase.rpc(rpcFunction, params);
        });
        
        if (error) throw error;
        
        const topics = data?.filter(topic => topic.id) // 过滤掉没有id的数据
          .map((topic: any) => ({
          id: topic.id,
          title: topic.title,
          description: topic.description,
          createdAt: topic.created_at,
          author: { 
            id: topic.user_id, 
            name: 'Unknown',
            avatar: ''
          },
          location: {
            latitude: topic.latitude,
            longitude: topic.longitude,
            name: topic.location_name
          },
          distance: topic.distance_meters,
          commentCount: topic.comments_count || 0,
          participantCount: 0,
          imageUrl: topic.image_url,
          aspectRatio: topic.image_aspect_ratio,
          tags: topic.tags || [],
          
          // Enhanced fields
          engagementScore: topic.engagement_score,
          isPromoted: topic.is_promoted,
          category: topic.category,
          recommendationReason: topic.recommendation_reason,
          contentType: topic.content_type,
          
          // Interaction fields
          isLiked: false,
          likesCount: topic.likes_count || 0,
          isFavorited: false,
          favoritesCount: topic.favorites_count || 0
        })) || [];
        
        // 获取用户信息
        if (topics.length > 0) {
          const userIds = [...new Set(topics.map((t: EnhancedTopic) => t.author.id))];
          const { data: users } = await supabase
            .from('users')
            .select('id, nickname, avatar_url')
            .in('id', userIds);
            
          if (users) {
            const userMap = new Map(users.map(u => [u.id, u]));
            topics.forEach((topic: EnhancedTopic) => {
              const user = userMap.get(topic.author.id);
              if (user) {
                topic.author.name = user.nickname;
                topic.author.avatar = user.avatar_url || '';
              }
            });
          }
        }
        
        // 去重逻辑：确保没有重复的topics
        set(state => {
          const newTopics = refresh ? topics : [...state.topics, ...topics];
          const uniqueTopics = newTopics.filter((topic, index, self) => 
            index === self.findIndex(t => t.id === topic.id)
          );
          
          return {
            topics: uniqueTopics,
            hasMore: topics.length === pageSize,
            isLoading: false,
            currentPage: refresh ? 1 : state.currentPage + 1
          };
        });
        
        // 检查用户交互状态
        if (user?.id && topics.length > 0) {
          const topicIds = topics.map((t: EnhancedTopic) => t.id);
          await get().checkInteractionStatus(topicIds, user.id);
        }
      } catch (error: any) {
        console.error('Failed to fetch explore topics:', error);
        const errorMessage = isNetworkError(error) 
          ? 'ネットワーク接続を確認してください' 
          : 'トピックの取得に失敗しました';
        set({ error: errorMessage, isLoading: false });
      }
    },
    
    loadMoreTopics: async (latitude: number, longitude: number) => {
      const { isLoadingMore, hasMore, topics: currentTopics } = get();
      
      if (isLoadingMore || !hasMore) return;
      
      set({ isLoadingMore: true });
      
      try {
        // 记录当前数量以验证是否有新数据
        const currentCount = currentTopics.length;
        await get().fetchTopics(latitude, longitude, false);
        
        // 如果数据没有增加，说明没有更多数据了
        const newCount = get().topics.length;
        if (newCount === currentCount) {
          set({ hasMore: false });
        }
      } catch (error) {
        console.error('Error loading more topics:', error);
      } finally {
        set({ isLoadingMore: false });
      }
    },
    
    selectCategory: (categoryKey: string) => {
      const { selectedCategory } = get();
      if (selectedCategory !== categoryKey) {
        set({ 
          selectedCategory: categoryKey,
          topics: [], // 强制清空topics数组
          currentPage: 0,
          hasMore: true,
          isLoading: false,
          error: null
        });
      }
    },
    
    trackInteraction: async (topicId: string, interactionType: ExploreInteractionType, category?: string) => {
      try {
        const { user } = useAuthStore.getState();
        if (!user?.id) return;
        
        const sessionId = `explore_${Date.now()}`;
        
        await supabase.rpc('track_explore_interaction', {
          user_id_param: user.id,
          topic_id_param: topicId,
          interaction_type_param: interactionType,
          category_param: category,
          session_id_param: sessionId
        });
      } catch (error) {
        console.error('Failed to track interaction:', error);
      }
    },
    
    updateTopicInteraction: (topicId: string, updates: Partial<EnhancedTopic>) => {
      set(state => ({
        topics: state.topics.map(topic => 
          topic.id === topicId ? { ...topic, ...updates } : topic
        )
      }));
    },
    
    checkInteractionStatus: async (topicIds: string[], userId: string) => {
      try {
        const interactionStatuses = await getCachedBatchTopicInteractionStatus(topicIds, userId);
        
        const statusMap = new Map(
          interactionStatuses.map(status => [status.topicId, status])
        );
        
        set(state => ({
          topics: state.topics.map(topic => {
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
      } catch (error) {
        console.error('Error checking interaction status:', error);
      }
    },
    
    cleanup: () => {
      // 清理事件监听器
      unsubscribeFunctions.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('[ExploreStore] Error during cleanup:', error);
        }
      });
      
      unsubscribeFunctions.length = 0;
      console.log('[ExploreStore] Cleanup completed');
    }
  };
});