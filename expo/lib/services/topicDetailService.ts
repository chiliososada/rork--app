import { supabase } from '@/lib/supabase';
import { Topic } from '@/types';

/**
 * 独立的话题详情服务
 * 专门用于获取单个话题的详细信息，不依赖任何页面的列表数据
 */
export class TopicDetailService {
  
  /**
   * 根据 ID 获取话题详情
   */
  static async fetchTopicById(topicId: string, userLatitude?: number, userLongitude?: number): Promise<Topic | null> {
    try {
      const { data: topicData, error: topicError } = await supabase
        .from('topics')
        .select(`
          *,
          users!topics_user_id_fkey (
            id,
            nickname,
            avatar_url,
            email
          ),
          comments!comments_topic_id_fkey (count),
          chat_messages!chat_messages_topic_id_fkey (
            user_id,
            created_at
          )
        `)
        .eq('id', topicId)
        .single();

      if (topicError) {
        if (topicError.code === 'PGRST116') {
          // 话题不存在
          return null;
        }
        throw topicError;
      }

      if (!topicData) {
        return null;
      }

      // 计算距离（如果提供了用户位置）
      let distance: number | undefined;
      if (userLatitude !== undefined && userLongitude !== undefined) {
        distance = TopicDetailService.calculateDistance(
          userLatitude,
          userLongitude,
          topicData.latitude,
          topicData.longitude
        );
      }

      // 计算参与者数量
      const uniqueParticipants = new Set(topicData.chat_messages?.map((msg: any) => msg.user_id) || []);
      uniqueParticipants.add(topicData.user_id);

      // 找到最新消息时间
      const lastMessageTime = topicData.chat_messages && topicData.chat_messages.length > 0
        ? topicData.chat_messages
            .map((msg: any) => msg.created_at)
            .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0]
        : undefined;

      // 转换为 Topic 接口格式
      const topic: Topic = {
        id: topicData.id,
        title: topicData.title,
        description: topicData.description || '',
        createdAt: topicData.created_at,
        author: {
          id: topicData.users.id,
          name: topicData.users.nickname,
          nickname: topicData.users.nickname,
          avatar: topicData.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topicData.users.nickname)}&background=random`,
          email: topicData.users.email
        },
        location: {
          latitude: topicData.latitude,
          longitude: topicData.longitude,
          name: topicData.location_name || undefined
        },
        distance,
        commentCount: topicData.comments?.[0]?.count || 0,
        participantCount: uniqueParticipants.size,
        lastMessageTime,
        imageUrl: topicData.image_url || undefined,
        aspectRatio: topicData.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
        isFavorited: false, // 将在后续单独检查
        isLiked: false, // 将在后续单独检查
        likesCount: 0 // 将在后续单独检查
      };

      return topic;
    } catch (error) {
      console.error('Error fetching topic by ID:', error);
      throw error;
    }
  }

  /**
   * 检查用户对话题的收藏状态
   */
  static async checkFavoriteStatus(topicId: string, userId: string): Promise<boolean> {
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
      console.error('Error checking favorite status:', error);
      return false;
    }
  }

  /**
   * 检查用户对话题的点赞状态和总点赞数
   */
  static async checkLikeStatus(topicId: string, userId: string): Promise<{ isLiked: boolean; count: number }> {
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
      console.error('Error checking like status:', error);
      return { isLiked: false, count: 0 };
    }
  }

  /**
   * 获取完整的话题详情（包括用户交互状态）
   */
  static async fetchFullTopicDetail(
    topicId: string, 
    userId: string, 
    userLatitude?: number, 
    userLongitude?: number
  ): Promise<Topic | null> {
    try {
      // 获取基础话题信息
      const topic = await TopicDetailService.fetchTopicById(topicId, userLatitude, userLongitude);
      
      if (!topic) {
        return null;
      }

      // 并行检查收藏和点赞状态，使用 Promise.allSettled 以避免单个请求失败影响整个流程
      const [favoriteResult, likeResult] = await Promise.allSettled([
        TopicDetailService.checkFavoriteStatus(topicId, userId),
        TopicDetailService.checkLikeStatus(topicId, userId)
      ]);

      // 处理收藏状态结果
      const isFavorited = favoriteResult.status === 'fulfilled' ? favoriteResult.value : false;
      if (favoriteResult.status === 'rejected') {
        console.error('Failed to check favorite status:', favoriteResult.reason);
      }

      // 处理点赞状态结果
      const likeStatus = likeResult.status === 'fulfilled' 
        ? likeResult.value 
        : { isLiked: false, count: 0 };
      if (likeResult.status === 'rejected') {
        console.error('Failed to check like status:', likeResult.reason);
      }

      // 更新话题状态
      topic.isFavorited = isFavorited;
      topic.isLiked = likeStatus.isLiked;
      topic.likesCount = likeStatus.count;

      return topic;
    } catch (error) {
      console.error('Error fetching full topic detail:', error);
      throw error;
    }
  }

  /**
   * 检查话题是否存在
   */
  static async topicExists(topicId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('id')
        .eq('id', topicId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking topic existence:', error);
      return false;
    }
  }

  /**
   * 计算两点之间的距离（米）
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // 地球半径（米）
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * 刷新话题详情缓存（如果有实现缓存的话）
   */
  static async refreshTopicDetail(topicId: string): Promise<void> {
    // 这里可以实现缓存刷新逻辑
    // 目前暂时留空，后续如果需要缓存可以添加
  }
}