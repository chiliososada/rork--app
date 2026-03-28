import { useEffect } from 'react';
import { eventBus, EVENT_TYPES, TopicInteractionEvent } from '@/lib/event-bus';

/**
 * Hook for handling topic interaction events across different pages
 * 用于处理跨页面话题交互事件的 Hook
 */
export interface TopicInteractionHandlers {
  onTopicLiked?: (data: TopicInteractionEvent) => void;
  onTopicUnliked?: (data: TopicInteractionEvent) => void;
  onTopicFavorited?: (data: TopicInteractionEvent) => void;
  onTopicUnfavorited?: (data: TopicInteractionEvent) => void;
}

export function useTopicInteraction(handlers: TopicInteractionHandlers) {
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // 监听点赞事件
    if (handlers.onTopicLiked) {
      const unsubscribeLike = eventBus.on(EVENT_TYPES.TOPIC_LIKED, handlers.onTopicLiked);
      unsubscribers.push(unsubscribeLike);
    }

    // 监听取消点赞事件
    if (handlers.onTopicUnliked) {
      const unsubscribeUnlike = eventBus.on(EVENT_TYPES.TOPIC_UNLIKED, handlers.onTopicUnliked);
      unsubscribers.push(unsubscribeUnlike);
    }

    // 监听收藏事件
    if (handlers.onTopicFavorited) {
      const unsubscribeFavorite = eventBus.on(EVENT_TYPES.TOPIC_FAVORITED, handlers.onTopicFavorited);
      unsubscribers.push(unsubscribeFavorite);
    }

    // 监听取消收藏事件
    if (handlers.onTopicUnfavorited) {
      const unsubscribeUnfavorite = eventBus.on(EVENT_TYPES.TOPIC_UNFAVORITED, handlers.onTopicUnfavorited);
      unsubscribers.push(unsubscribeUnfavorite);
    }

    // 清理函数
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [handlers.onTopicLiked, handlers.onTopicUnliked, handlers.onTopicFavorited, handlers.onTopicUnfavorited]);
}

/**
 * 为 store 提供的便捷 Hook，自动更新话题状态
 */
export function useTopicInteractionForStore(updateTopicInteraction: (topicId: string, updates: any) => void) {
  return useTopicInteraction({
    onTopicLiked: (data) => {
      updateTopicInteraction(data.topicId, { 
        isLiked: true, 
        likesCount: data.count 
      });
    },
    onTopicUnliked: (data) => {
      updateTopicInteraction(data.topicId, { 
        isLiked: false, 
        likesCount: data.count 
      });
    },
    onTopicFavorited: (data) => {
      updateTopicInteraction(data.topicId, { 
        isFavorited: true 
      });
    },
    onTopicUnfavorited: (data) => {
      updateTopicInteraction(data.topicId, { 
        isFavorited: false 
      });
    }
  });
}