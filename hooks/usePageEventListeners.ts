import { useOptimizedEventListener } from './useOptimizedEventListener';
import { EVENT_TYPES } from '@/lib/event-bus';

/**
 * Home页面专用的事件监听器Hook
 */
export function useHomePageEvents(handlers: {
  onTopicLiked?: (data: any) => void;
  onTopicUnliked?: (data: any) => void;
  onTopicFavorited?: (data: any) => void;
  onTopicUnfavorited?: (data: any) => void;
  onTopicCommented?: (data: any) => void;
  onTopicCreated?: (data: any) => void;
  onTopicUpdated?: (data: any) => void;
  onTopicDeleted?: (data: any) => void;
  onLocationChanged?: (data: any) => void;
}) {
  const eventHandlers = {
    [EVENT_TYPES.TOPIC_LIKED]: handlers.onTopicLiked,
    [EVENT_TYPES.TOPIC_UNLIKED]: handlers.onTopicUnliked,
    [EVENT_TYPES.TOPIC_FAVORITED]: handlers.onTopicFavorited,
    [EVENT_TYPES.TOPIC_UNFAVORITED]: handlers.onTopicUnfavorited,
    [EVENT_TYPES.TOPIC_COMMENTED]: handlers.onTopicCommented,
    [EVENT_TYPES.TOPIC_CREATED]: handlers.onTopicCreated,
    [EVENT_TYPES.TOPIC_UPDATED]: handlers.onTopicUpdated,
    [EVENT_TYPES.TOPIC_DELETED]: handlers.onTopicDeleted,
    [EVENT_TYPES.LOCATION_CHANGED]: handlers.onLocationChanged,
  };

  // Filter out undefined handlers
  const filteredHandlers = Object.entries(eventHandlers)
    .filter(([_, handler]) => handler !== undefined)
    .reduce((acc, [eventType, handler]) => {
      acc[eventType] = handler!;
      return acc;
    }, {} as Record<string, (data: any) => void>);

  useOptimizedEventListener(filteredHandlers, {
    page: 'HOME',
    debug: process.env.NODE_ENV === 'development',
  });
}

/**
 * Explore页面专用的事件监听器Hook
 */
export function useExplorePageEvents(handlers: {
  onTopicLiked?: (data: any) => void;
  onTopicUnliked?: (data: any) => void;
  onTopicFavorited?: (data: any) => void;
  onTopicUnfavorited?: (data: any) => void;
  onTopicCommented?: (data: any) => void;
  onTopicCreated?: (data: any) => void;
  onTopicUpdated?: (data: any) => void;
  onTopicDeleted?: (data: any) => void;
  onMapViewportChanged?: (data: any) => void;
  onLocationChanged?: (data: any) => void;
}) {
  const eventHandlers = {
    [EVENT_TYPES.TOPIC_LIKED]: handlers.onTopicLiked,
    [EVENT_TYPES.TOPIC_UNLIKED]: handlers.onTopicUnliked,
    [EVENT_TYPES.TOPIC_FAVORITED]: handlers.onTopicFavorited,
    [EVENT_TYPES.TOPIC_UNFAVORITED]: handlers.onTopicUnfavorited,
    [EVENT_TYPES.TOPIC_COMMENTED]: handlers.onTopicCommented,
    [EVENT_TYPES.TOPIC_CREATED]: handlers.onTopicCreated,
    [EVENT_TYPES.TOPIC_UPDATED]: handlers.onTopicUpdated,
    [EVENT_TYPES.TOPIC_DELETED]: handlers.onTopicDeleted,
    [EVENT_TYPES.MAP_VIEWPORT_CHANGED]: handlers.onMapViewportChanged,
    [EVENT_TYPES.LOCATION_CHANGED]: handlers.onLocationChanged,
  };

  // Filter out undefined handlers
  const filteredHandlers = Object.entries(eventHandlers)
    .filter(([_, handler]) => handler !== undefined)
    .reduce((acc, [eventType, handler]) => {
      acc[eventType] = handler!;
      return acc;
    }, {} as Record<string, (data: any) => void>);

  useOptimizedEventListener(filteredHandlers, {
    page: 'EXPLORE',
    debug: process.env.NODE_ENV === 'development',
  });
}

/**
 * Chat页面专用的事件监听器Hook
 */
export function useChatPageEvents(handlers: {
  onTopicLiked?: (data: any) => void;
  onTopicUnliked?: (data: any) => void;
  onTopicFavorited?: (data: any) => void;
  onTopicUnfavorited?: (data: any) => void;
  onMessageSent?: (data: any) => void;
  onTopicJoined?: (data: any) => void;
  onTopicUpdated?: (data: any) => void;
  onTopicDeleted?: (data: any) => void;
}) {
  const eventHandlers = {
    [EVENT_TYPES.TOPIC_LIKED]: handlers.onTopicLiked,
    [EVENT_TYPES.TOPIC_UNLIKED]: handlers.onTopicUnliked,
    [EVENT_TYPES.TOPIC_FAVORITED]: handlers.onTopicFavorited,
    [EVENT_TYPES.TOPIC_UNFAVORITED]: handlers.onTopicUnfavorited,
    [EVENT_TYPES.MESSAGE_SENT]: handlers.onMessageSent,
    [EVENT_TYPES.TOPIC_JOINED]: handlers.onTopicJoined,
    [EVENT_TYPES.TOPIC_UPDATED]: handlers.onTopicUpdated,
    [EVENT_TYPES.TOPIC_DELETED]: handlers.onTopicDeleted,
  };

  // Filter out undefined handlers
  const filteredHandlers = Object.entries(eventHandlers)
    .filter(([_, handler]) => handler !== undefined)
    .reduce((acc, [eventType, handler]) => {
      acc[eventType] = handler!;
      return acc;
    }, {} as Record<string, (data: any) => void>);

  useOptimizedEventListener(filteredHandlers, {
    page: 'CHAT',
    debug: process.env.NODE_ENV === 'development',
  });
}

/**
 * Profile页面专用的事件监听器Hook
 */
export function useProfilePageEvents(handlers: {
  onTopicFavorited?: (data: any) => void;
  onTopicUnfavorited?: (data: any) => void;
  onTopicLiked?: (data: any) => void;
  onTopicUnliked?: (data: any) => void;
  onTopicCommented?: (data: any) => void;
  onTopicCreated?: (data: any) => void;
  onTopicDeleted?: (data: any) => void;
}) {
  const eventHandlers = {
    [EVENT_TYPES.TOPIC_FAVORITED]: handlers.onTopicFavorited,
    [EVENT_TYPES.TOPIC_UNFAVORITED]: handlers.onTopicUnfavorited,
    [EVENT_TYPES.TOPIC_LIKED]: handlers.onTopicLiked,
    [EVENT_TYPES.TOPIC_UNLIKED]: handlers.onTopicUnliked,
    [EVENT_TYPES.TOPIC_COMMENTED]: handlers.onTopicCommented,
    [EVENT_TYPES.TOPIC_CREATED]: handlers.onTopicCreated,
    [EVENT_TYPES.TOPIC_DELETED]: handlers.onTopicDeleted,
  };

  // Filter out undefined handlers
  const filteredHandlers = Object.entries(eventHandlers)
    .filter(([_, handler]) => handler !== undefined)
    .reduce((acc, [eventType, handler]) => {
      acc[eventType] = handler!;
      return acc;
    }, {} as Record<string, (data: any) => void>);

  useOptimizedEventListener(filteredHandlers, {
    page: 'PROFILE',
    debug: process.env.NODE_ENV === 'development',
  });
}