import { supabase } from '@/lib/supabase';
import { eventBus, EVENT_TYPES, DEBOUNCED_EVENTS } from '@/lib/event-bus';

/**
 * 统一的话题交互服务
 * 处理点赞、收藏等操作，并通过事件总线同步所有页面的状态
 */
export class TopicInteractionService {
  
  /**
   * 切换话题收藏状态
   */
  static async toggleFavorite(topicId: string, userId: string): Promise<boolean> {
    try {
      // 检查当前收藏状态
      const { data: existingFavorite, error: checkError } = await supabase
        .from('topic_favorites')
        .select('id')
        .eq('topic_id', topicId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const isFavorited = !!existingFavorite;
      
      if (isFavorited) {
        // 取消收藏
        const { error: deleteError } = await supabase
          .from('topic_favorites')
          .delete()
          .eq('topic_id', topicId)
          .eq('user_id', userId);

        if (deleteError) throw deleteError;

        // 发送取消收藏事件（收藏操作不需要防抖，立即执行）
        eventBus.emit(EVENT_TYPES.TOPIC_UNFAVORITED, {
          topicId,
          userId,
          timestamp: new Date().toISOString()
        });

        return false;
      } else {
        // 添加收藏
        const { error: insertError } = await supabase
          .from('topic_favorites')
          .insert({
            topic_id: topicId,
            user_id: userId
          });

        if (insertError) throw insertError;

        // 发送收藏事件（收藏操作不需要防抖，立即执行）
        eventBus.emit(EVENT_TYPES.TOPIC_FAVORITED, {
          topicId,
          userId,
          timestamp: new Date().toISOString()
        });

        return true;
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }

  /**
   * 切换话题点赞状态
   */
  static async toggleLike(topicId: string, userId: string): Promise<{ isLiked: boolean; count: number }> {
    try {
      // 检查当前点赞状态
      const { data: existingLike, error: checkError } = await supabase
        .from('topic_likes')
        .select('id')
        .eq('topic_id', topicId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const isLiked = !!existingLike;

      if (isLiked) {
        // 取消点赞
        const { error: deleteError } = await supabase
          .from('topic_likes')
          .delete()
          .eq('topic_id', topicId)
          .eq('user_id', userId);

        if (deleteError) throw deleteError;
      } else {
        // 添加点赞
        const { error: insertError } = await supabase
          .from('topic_likes')
          .insert({
            topic_id: topicId,
            user_id: userId
          });

        if (insertError) throw insertError;
      }

      // 获取更新后的点赞数
      const { count, error: countError } = await supabase
        .from('topic_likes')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', topicId);

      if (countError) throw countError;

      const finalCount = count || 0;
      const finalIsLiked = !isLiked;

      // 发送点赞事件（使用防抖，避免频繁点击造成的大量事件）
      if (finalIsLiked) {
        if (DEBOUNCED_EVENTS.has(EVENT_TYPES.TOPIC_LIKED)) {
          eventBus.emitDebounced(EVENT_TYPES.TOPIC_LIKED, {
            topicId,
            userId,
            count: finalCount,
            timestamp: new Date().toISOString()
          }, 200); // 200ms 防抖延迟
        } else {
          eventBus.emit(EVENT_TYPES.TOPIC_LIKED, {
            topicId,
            userId,
            count: finalCount,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        if (DEBOUNCED_EVENTS.has(EVENT_TYPES.TOPIC_UNLIKED)) {
          eventBus.emitDebounced(EVENT_TYPES.TOPIC_UNLIKED, {
            topicId,
            userId,
            count: finalCount,
            timestamp: new Date().toISOString()
          }, 200); // 200ms 防抖延迟
        } else {
          eventBus.emit(EVENT_TYPES.TOPIC_UNLIKED, {
            topicId,
            userId,
            count: finalCount,
            timestamp: new Date().toISOString()
          });
        }
      }

      return {
        isLiked: finalIsLiked,
        count: finalCount
      };
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  /**
   * 获取话题的收藏状态
   */
  static async getFavoriteStatus(topicId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('topic_favorites')
        .select('id')
        .eq('topic_id', topicId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error getting favorite status:', error);
      return false;
    }
  }

  /**
   * 获取话题的点赞状态和数量
   */
  static async getLikeStatus(topicId: string, userId: string): Promise<{ isLiked: boolean; count: number }> {
    try {
      // 检查用户是否点赞
      const { data: likeData, error: likeError } = await supabase
        .from('topic_likes')
        .select('id')
        .eq('topic_id', topicId)
        .eq('user_id', userId)
        .single();

      if (likeError && likeError.code !== 'PGRST116') {
        throw likeError;
      }

      // 获取总点赞数
      const { count, error: countError } = await supabase
        .from('topic_likes')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', topicId);

      if (countError) throw countError;

      return {
        isLiked: !!likeData,
        count: count || 0
      };
    } catch (error) {
      console.error('Error getting like status:', error);
      return { isLiked: false, count: 0 };
    }
  }

  /**
   * 批量获取多个话题的收藏状态
   */
  static async getBatchFavoriteStatus(topicIds: string[], userId: string): Promise<Map<string, boolean>> {
    try {
      const { data, error } = await supabase
        .from('topic_favorites')
        .select('topic_id')
        .eq('user_id', userId)
        .in('topic_id', topicIds);

      if (error) throw error;

      const favoriteMap = new Map<string, boolean>();
      topicIds.forEach(topicId => {
        favoriteMap.set(topicId, false);
      });

      data?.forEach(item => {
        favoriteMap.set(item.topic_id, true);
      });

      return favoriteMap;
    } catch (error) {
      console.error('Error getting batch favorite status:', error);
      return new Map();
    }
  }

  /**
   * 批量获取多个话题的点赞状态
   */
  static async getBatchLikeStatus(topicIds: string[], userId: string): Promise<Map<string, { isLiked: boolean; count: number }>> {
    try {
      // 获取用户的点赞记录
      const { data: userLikes, error: userLikesError } = await supabase
        .from('topic_likes')
        .select('topic_id')
        .eq('user_id', userId)
        .in('topic_id', topicIds);

      if (userLikesError) throw userLikesError;

      // 获取每个话题的点赞总数
      const likeCounts = await Promise.all(
        topicIds.map(async (topicId) => {
          const { count, error } = await supabase
            .from('topic_likes')
            .select('*', { count: 'exact', head: true })
            .eq('topic_id', topicId);
          
          if (error) {
            console.error(`Error getting like count for topic ${topicId}:`, error);
            return { topicId, count: 0 };
          }
          
          return { topicId, count: count || 0 };
        })
      );

      const likeMap = new Map<string, { isLiked: boolean; count: number }>();
      const userLikedTopicIds = new Set(userLikes?.map(item => item.topic_id) || []);

      likeCounts.forEach(({ topicId, count }) => {
        likeMap.set(topicId, {
          isLiked: userLikedTopicIds.has(topicId),
          count
        });
      });

      return likeMap;
    } catch (error) {
      console.error('Error getting batch like status:', error);
      return new Map();
    }
  }
}