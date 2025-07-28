import { supabase } from '@/lib/supabase';
import { withDatabaseRetry } from '@/lib/retry';

/**
 * 获取用户参与的所有topic ID列表
 * 包括用户创建的topic和参与的topic
 */
export async function getUserParticipatingTopics(userId: string): Promise<string[]> {
  try {
    const result = await withDatabaseRetry(async () => {
      // 获取用户创建的topics和参与的topics
      const { data, error } = await supabase
        .from('topics')
        .select(`
          id,
          user_id,
          topic_participants!inner(
            user_id,
            is_active
          )
        `)
        .or(`user_id.eq.${userId},topic_participants.user_id.eq.${userId}`)
        .eq('topic_participants.is_active', true);

      if (error) {
        throw error;
      }

      return data;
    });

    if (!result) {
      return [];
    }

    // 去重并返回topic ID列表
    const topicIds = new Set<string>();
    
    result.forEach((topic: any) => {
      // 添加用户创建的topic
      if (topic.user_id === userId) {
        topicIds.add(topic.id);
      }
      
      // 添加用户参与的topic
      if (topic.topic_participants && topic.topic_participants.length > 0) {
        topic.topic_participants.forEach((participant: any) => {
          if (participant.user_id === userId && participant.is_active) {
            topicIds.add(topic.id);
          }
        });
      }
    });

    return Array.from(topicIds);

  } catch (error) {
    console.error('Failed to get user participating topics:', error);
    return [];
  }
}

/**
 * 简化版本：直接查询用户参与的topic IDs
 */
export async function getUserTopicIds(userId: string): Promise<string[]> {
  try {
    const result = await withDatabaseRetry(async () => {
      // 使用UNION查询获取用户创建的和参与的所有topic
      const { data, error } = await supabase.rpc('get_user_topic_ids', {
        user_id_param: userId
      });

      if (error) {
        // 如果RPC函数不存在，则使用备用查询
        if (error.code === '42883') {
          return await getUserParticipatingTopicsBackup(userId);
        }
        throw error;
      }

      return data;
    });

    return result?.map((item: any) => item.topic_id) || [];

  } catch (error) {
    console.warn('Failed to get user topic IDs, using backup method:', error);
    return await getUserParticipatingTopicsBackup(userId);
  }
}

/**
 * 备用方法：分别查询创建的和参与的topic
 */
async function getUserParticipatingTopicsBackup(userId: string): Promise<string[]> {
  try {
    const topicIds = new Set<string>();

    // 查询用户创建的topics
    const { data: createdTopics } = await supabase
      .from('topics')
      .select('id')
      .eq('user_id', userId);

    if (createdTopics) {
      createdTopics.forEach(topic => topicIds.add(topic.id));
    }

    // 查询用户参与的topics
    const { data: participatedTopics } = await supabase
      .from('topic_participants')
      .select('topic_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (participatedTopics) {
      participatedTopics.forEach(participant => topicIds.add(participant.topic_id));
    }

    return Array.from(topicIds);

  } catch (error) {
    console.error('Backup method failed:', error);
    return [];
  }
}