/**
 * 数据库查询优化工具
 * 提供批量查询和缓存优化功能
 */

import { supabase } from './supabase';

export interface TopicInteractionStatus {
  topicId: string;
  isLiked: boolean;
  isFavorited: boolean;
  likesCount: number;
  commentsCount: number;
}

/**
 * 批量获取用户的话题交互状态
 * 优化：使用单个查询替代多个独立查询
 */
export async function getBatchTopicInteractionStatus(
  topicIds: string[], 
  userId: string
): Promise<TopicInteractionStatus[]> {
  if (topicIds.length === 0) {
    return [];
  }

  try {
    // 1. 批量查询用户点赞状态
    const [likesResult, favoritesResult, countsResult] = await Promise.all([
      // 用户点赞状态
      supabase
        .from('topic_likes')
        .select('topic_id')
        .eq('user_id', userId)
        .in('topic_id', topicIds),
      
      // 用户收藏状态
      supabase
        .from('topic_favorites')
        .select('topic_id')
        .eq('user_id', userId)
        .in('topic_id', topicIds),
      
      // 批量查询counts - 使用聚合查询
      supabase
        .rpc('get_topic_interaction_counts', { topic_ids: topicIds })
    ]);

    // 处理错误
    if (likesResult.error) throw likesResult.error;
    if (favoritesResult.error) throw favoritesResult.error;
    if (countsResult.error) {
      console.warn('Failed to get counts via RPC, falling back to individual queries');
      // 如果RPC失败，回退到批量查询
      const fallbackCounts = await getBatchTopicCountsFallback(topicIds);
      return buildInteractionStatus(topicIds, likesResult.data, favoritesResult.data, fallbackCounts);
    }

    // 构建结果
    const likedTopicIds = new Set(likesResult.data?.map(l => l.topic_id) || []);
    const favoritedTopicIds = new Set(favoritesResult.data?.map(f => f.topic_id) || []);
    const countsMap = new Map(
      (countsResult.data || []).map((item: any) => [
        item.topic_id, 
        { likesCount: item.likes_count, commentsCount: item.comments_count }
      ])
    );

    return topicIds.map(topicId => ({
      topicId,
      isLiked: likedTopicIds.has(topicId),
      isFavorited: favoritedTopicIds.has(topicId),
      likesCount: countsMap.get(topicId)?.likesCount || 0,
      commentsCount: countsMap.get(topicId)?.commentsCount || 0
    }));

  } catch (error) {
    console.error('Error in getBatchTopicInteractionStatus:', error);
    
    // 完全回退到原始方法
    return await getFallbackInteractionStatus(topicIds, userId);
  }
}

/**
 * 批量查询counts的回退方案
 * 使用更高效的聚合查询
 */
async function getBatchTopicCountsFallback(topicIds: string[]): Promise<Map<string, { likesCount: number; commentsCount: number }>> {
  try {
    // 使用聚合查询而不是单独查询每个topic
    const [likesCountResult, commentsCountResult] = await Promise.all([
      supabase
        .from('topic_likes')
        .select('topic_id')
        .in('topic_id', topicIds),
      
      supabase
        .from('comments')
        .select('topic_id')
        .in('topic_id', topicIds)
    ]);

    if (likesCountResult.error) throw likesCountResult.error;
    if (commentsCountResult.error) throw commentsCountResult.error;

    // 计算每个topic的counts
    const likesCountMap = new Map<string, number>();
    const commentsCountMap = new Map<string, number>();

    // 统计likes
    (likesCountResult.data || []).forEach(item => {
      const count = likesCountMap.get(item.topic_id) || 0;
      likesCountMap.set(item.topic_id, count + 1);
    });

    // 统计comments
    (commentsCountResult.data || []).forEach(item => {
      const count = commentsCountMap.get(item.topic_id) || 0;
      commentsCountMap.set(item.topic_id, count + 1);
    });

    // 构建结果Map
    const countsMap = new Map<string, { likesCount: number; commentsCount: number }>();
    topicIds.forEach(topicId => {
      countsMap.set(topicId, {
        likesCount: likesCountMap.get(topicId) || 0,
        commentsCount: commentsCountMap.get(topicId) || 0
      });
    });

    return countsMap;
  } catch (error) {
    console.error('Error in getBatchTopicCountsFallback:', error);
    // 返回空的counts
    const emptyCountsMap = new Map<string, { likesCount: number; commentsCount: number }>();
    topicIds.forEach(topicId => {
      emptyCountsMap.set(topicId, { likesCount: 0, commentsCount: 0 });
    });
    return emptyCountsMap;
  }
}

/**
 * 构建交互状态结果
 */
function buildInteractionStatus(
  topicIds: string[],
  likesData: any[],
  favoritesData: any[],
  countsMap: Map<string, { likesCount: number; commentsCount: number }>
): TopicInteractionStatus[] {
  const likedTopicIds = new Set(likesData?.map(l => l.topic_id) || []);
  const favoritedTopicIds = new Set(favoritesData?.map(f => f.topic_id) || []);

  return topicIds.map(topicId => ({
    topicId,
    isLiked: likedTopicIds.has(topicId),
    isFavorited: favoritedTopicIds.has(topicId),
    likesCount: countsMap.get(topicId)?.likesCount || 0,
    commentsCount: countsMap.get(topicId)?.commentsCount || 0
  }));
}

/**
 * 完全回退方案 - 保持与原始实现相同的行为
 */
async function getFallbackInteractionStatus(
  topicIds: string[], 
  userId: string
): Promise<TopicInteractionStatus[]> {
  try {
    // 用户点赞状态
    const { data: likesData } = await supabase
      .from('topic_likes')
      .select('topic_id')
      .eq('user_id', userId)
      .in('topic_id', topicIds);

    // 用户收藏状态  
    const { data: favoritesData } = await supabase
      .from('topic_favorites')
      .select('topic_id')
      .eq('user_id', userId)
      .in('topic_id', topicIds);

    const likedTopicIds = new Set(likesData?.map(l => l.topic_id) || []);
    const favoritedTopicIds = new Set(favoritesData?.map(f => f.topic_id) || []);

    // 为每个topic单独查询counts（保持原始行为）
    const likesCountPromises = topicIds.map(async (topicId) => {
      const { count } = await supabase
        .from('topic_likes')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', topicId);
      return { topicId, count: count || 0 };
    });

    const commentsCountPromises = topicIds.map(async (topicId) => {
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', topicId);
      return { topicId, count: count || 0 };
    });

    const [likesCountResults, commentsCountResults] = await Promise.all([
      Promise.all(likesCountPromises),
      Promise.all(commentsCountPromises)
    ]);

    const likesCountMap = new Map(likesCountResults.map(r => [r.topicId, r.count]));
    const commentsCountMap = new Map(commentsCountResults.map(r => [r.topicId, r.count]));

    return topicIds.map(topicId => ({
      topicId,
      isLiked: likedTopicIds.has(topicId),
      isFavorited: favoritedTopicIds.has(topicId),
      likesCount: likesCountMap.get(topicId) || 0,
      commentsCount: commentsCountMap.get(topicId) || 0
    }));

  } catch (error) {
    console.error('Error in getFallbackInteractionStatus:', error);
    // 返回默认值
    return topicIds.map(topicId => ({
      topicId,
      isLiked: false,
      isFavorited: false,
      likesCount: 0,
      commentsCount: 0
    }));
  }
}

/**
 * 缓存优化的交互状态查询
 * 提供内存缓存来减少重复查询
 */
class InteractionStatusCache {
  private cache = new Map<string, { data: TopicInteractionStatus; timestamp: number }>();
  private readonly TTL = 2 * 60 * 1000; // 2分钟缓存

  private generateKey(topicId: string, userId: string): string {
    return `${topicId}:${userId}`;
  }

  get(topicId: string, userId: string): TopicInteractionStatus | null {
    const key = this.generateKey(topicId, userId);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  set(status: TopicInteractionStatus, userId: string): void {
    const key = this.generateKey(status.topicId, userId);
    this.cache.set(key, {
      data: status,
      timestamp: Date.now()
    });
  }

  invalidate(topicId: string, userId?: string): void {
    if (userId) {
      const key = this.generateKey(topicId, userId);
      this.cache.delete(key);
    } else {
      // 清除该topic的所有缓存
      for (const [key] of this.cache) {
        if (key.startsWith(`${topicId}:`)) {
          this.cache.delete(key);
        }
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const interactionStatusCache = new InteractionStatusCache();

/**
 * 带缓存的批量交互状态查询
 */
export async function getCachedBatchTopicInteractionStatus(
  topicIds: string[], 
  userId: string
): Promise<TopicInteractionStatus[]> {
  const results: TopicInteractionStatus[] = [];
  const uncachedTopicIds: string[] = [];

  // 检查缓存
  for (const topicId of topicIds) {
    const cached = interactionStatusCache.get(topicId, userId);
    if (cached) {
      results.push(cached);
    } else {
      uncachedTopicIds.push(topicId);
    }
  }

  // 批量查询未缓存的数据
  if (uncachedTopicIds.length > 0) {
    const uncachedResults = await getBatchTopicInteractionStatus(uncachedTopicIds, userId);
    
    // 缓存结果
    uncachedResults.forEach(status => {
      interactionStatusCache.set(status, userId);
    });
    
    results.push(...uncachedResults);
  }

  // 按原始顺序返回结果
  return topicIds.map(topicId => 
    results.find(r => r.topicId === topicId) || {
      topicId,
      isLiked: false,
      isFavorited: false,
      likesCount: 0,
      commentsCount: 0
    }
  );
}