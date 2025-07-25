import { create } from 'zustand';
import { Topic, Comment } from '@/types';
import { supabase } from '@/lib/supabase';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { getCachedBatchTopicInteractionStatus } from '@/lib/database-optimizers';

/**
 * 专门处理话题详情的 Store
 * 不再维护页面级别的统一数据，只处理单个话题的详细信息
 */
interface TopicDetailsState {
  // 当前话题详情
  currentTopic: Topic | null;
  
  // 当前话题的评论
  comments: Comment[];
  
  // 用户收藏的话题列表
  favoriteTopics: Topic[];
  
  // 用户发布的话题列表
  userTopics: Topic[];
  
  // 用户点赞的话题列表
  likedTopics: Topic[];
  
  // 加载状态
  isLoading: boolean;
  isFavoriteLoading: boolean;
  isLikeLoading: boolean;
  isUserTopicsLoading: boolean;
  isLikedTopicsLoading: boolean;
  
  // 错误状态
  error: string | null;
  
  // Profile统计更新通知
  profileStatsVersion: number;
  
  // 话题详情相关方法
  fetchTopicById: (id: string) => Promise<void>;
  
  // 评论相关方法
  fetchComments: (topicId: string) => Promise<void>;
  addComment: (topicId: string, text: string, userId: string) => Promise<void>;
  likeComment: (commentId: string, userId: string) => Promise<void>;
  
  // 话题创建
  createTopic: (topic: Omit<Topic, 'id' | 'createdAt' | 'commentCount' | 'participantCount'>) => Promise<Topic>;
  
  // 互动功能（点赞/收藏）
  toggleFavorite: (topicId: string, userId: string) => Promise<void>;
  toggleLike: (topicId: string, userId: string) => Promise<void>;
  
  // 收藏列表管理
  fetchFavoriteTopics: (userId: string) => Promise<void>;
  
  // 用户投稿管理
  fetchUserTopics: (userId: string) => Promise<void>;
  
  // 用户点赞管理
  fetchLikedTopics: (userId: string) => Promise<void>;
  
  // 话题删除
  deleteTopic: (topicId: string, userId: string) => Promise<void>;
  
  // 状态检查工具方法
  checkInteractionStatus: (topicIds: string[], userId: string) => Promise<void>;
  
  // 清理方法
  clearCurrentTopic: () => void;
  clearComments: () => void;
  cleanup: () => void;
}

export const useTopicDetailsStore = create<TopicDetailsState>((set, get) => ({
  currentTopic: null,
  comments: [],
  favoriteTopics: [],
  userTopics: [],
  likedTopics: [],
  isLoading: false,
  isFavoriteLoading: false,
  isLikeLoading: false,
  isUserTopicsLoading: false,
  isLikedTopicsLoading: false,
  error: null,
  profileStatsVersion: 0,

  fetchTopicById: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch topic from Supabase with comment count and message count
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
        .eq('id', id)
        .single();

      if (topicError) {
        if (topicError.code === 'PGRST116') {
          set({ 
            error: "トピックが見つかりません", 
            isLoading: false 
          });
          return;
        }
        throw topicError;
      }

      if (!topicData) {
        set({ 
          error: "トピックが見つかりません", 
          isLoading: false 
        });
        return;
      }

      // Check interaction status using optimized batch query
      let isFavorited = false;
      let isLiked = false;
      let likesCount = 0;
      
      if (currentUserId) {
        const interactionStatuses = await getCachedBatchTopicInteractionStatus([id], currentUserId);
        const status = interactionStatuses[0];
        if (status) {
          isFavorited = status.isFavorited;
          isLiked = status.isLiked;
          likesCount = status.likesCount;
        }
      } else {
        // Get just the likes count for anonymous users
        const { count } = await supabase
          .from('topic_likes')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', id);
        likesCount = count || 0;
      }

      // Calculate participant count from unique users who have sent messages
      const uniqueParticipants = new Set(topicData.chat_messages?.map((msg: any) => msg.user_id) || []);
      // Always include the topic author
      uniqueParticipants.add(topicData.user_id);
      
      // Find the latest message time
      const lastMessageTime = topicData.chat_messages && topicData.chat_messages.length > 0
        ? topicData.chat_messages
            .map((msg: any) => msg.created_at)
            .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0]
        : undefined;
      
      // Transform to our Topic interface
      const topic: Topic = {
        id: topicData.id,
        title: topicData.title,
        description: topicData.description || '',
        createdAt: topicData.created_at,
        author: {
          id: topicData.users.id,
          name: topicData.users.nickname,
          avatar: topicData.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topicData.users.nickname)}&background=random`,
          email: topicData.users.email
        },
        location: {
          latitude: topicData.latitude,
          longitude: topicData.longitude,
          name: topicData.location_name || undefined
        },
        commentCount: topicData.comments?.[0]?.count || 0,
        participantCount: uniqueParticipants.size,
        lastMessageTime,
        imageUrl: topicData.image_url || undefined,
        aspectRatio: topicData.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
        originalWidth: topicData.original_width || undefined,
        originalHeight: topicData.original_height || undefined,
        tags: (() => {
          try {
            if (!topicData.tags) return undefined;
            
            // Handle already parsed arrays (JSONB from database)
            if (Array.isArray(topicData.tags)) {
              return topicData.tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
            }
            
            // Handle string format (shouldn't happen with JSONB but safeguard)
            if (typeof topicData.tags === 'string') {
              const tagsStr = topicData.tags.trim();
              if (!tagsStr) return undefined;
              
              const parsed = JSON.parse(tagsStr);
              if (Array.isArray(parsed)) {
                return parsed.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
              }
            }
            
            return undefined;
          } catch (parseError: any) {
            console.warn('[TopicDetailsStore] Error parsing tags for topic', topicData.id, ':', parseError.message, 'Raw tags:', topicData.tags);
            return undefined;
          }
        })(),
        isFavorited,
        isLiked,
        likesCount: likesCount || 0
      };
      
      set({ 
        currentTopic: topic,
        isLoading: false 
      });
    } catch (error: any) {
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : 'トピックの取得に失敗しました';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
    }
  },

  fetchComments: async (topicId) => {
    set({ isLoading: true, error: null });
    
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch comments from Supabase
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          *,
          users!comments_user_id_fkey (
            id,
            nickname,
            avatar_url,
            email
          ),
          comment_likes!left (
            user_id
          )
        `)
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });

      if (commentsError) {
        throw commentsError;
      }

      // Transform data to match our Comment interface
      const comments: Comment[] = (commentsData || []).map(comment => ({
        id: comment.id,
        text: comment.content,
        createdAt: comment.created_at,
        author: {
          id: comment.users.id,
          name: comment.users.nickname,
          avatar: comment.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.users.nickname)}&background=random`,
          email: comment.users.email
        },
        likes: comment.likes_count || 0,
        topicId,
        isLikedByUser: currentUserId ? comment.comment_likes?.some((like: any) => like.user_id === currentUserId) : false
      }));
      
      set(state => ({ 
        comments,
        // Update current topic comment count if it matches
        currentTopic: state.currentTopic?.id === topicId ? {
          ...state.currentTopic,
          commentCount: comments.length
        } : state.currentTopic,
        isLoading: false 
      }));
    } catch (error: any) {
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : 'コメントの取得に失敗しました';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
    }
  },

  addComment: async (topicId, text, userId) => {
    set({ isLoading: true, error: null });
    
    try {
      // Insert comment into Supabase
      const { data: insertedComment, error: insertError } = await supabase
        .from('comments')
        .insert([
          {
            topic_id: topicId,
            user_id: userId,
            content: text,
            likes_count: 0
          }
        ])
        .select(`
          *,
          users!comments_user_id_fkey (
            id,
            nickname,
            avatar_url,
            email
          )
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      // Transform to our Comment interface
      const newComment: Comment = {
        id: insertedComment.id,
        text: insertedComment.content,
        createdAt: insertedComment.created_at,
        author: {
          id: insertedComment.users.id,
          name: insertedComment.users.nickname,
          avatar: insertedComment.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(insertedComment.users.nickname)}&background=random`,
          email: insertedComment.users.email
        },
        likes: insertedComment.likes_count || 0,
        topicId,
        isLikedByUser: false
      };
      
      set(state => ({ 
        comments: [...state.comments, newComment],
        // Update current topic comment count if it's the same topic
        currentTopic: state.currentTopic?.id === topicId ? {
          ...state.currentTopic,
          commentCount: state.comments.length + 1
        } : state.currentTopic,
        isLoading: false 
      }));
    } catch (error: any) {
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : 'コメントの投稿に失敗しました';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error; // Re-throw so the UI can handle it
    }
  },

  likeComment: async (commentId, userId) => {
    try {
      // Get current comment to check like status
      const { comments } = get();
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      const isCurrentlyLiked = comment.isLikedByUser || false;

      if (isCurrentlyLiked) {
        // Unlike: Remove like record
        const { error: deleteError } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);

        if (deleteError) {
          throw deleteError;
        }

        // Update likes count
        const newLikesCount = Math.max(0, comment.likes - 1);
        const { error: updateError } = await supabase
          .from('comments')
          .update({ likes_count: newLikesCount })
          .eq('id', commentId);

        if (updateError) {
          throw updateError;
        }

        // Update local state
        set(state => ({
          comments: state.comments.map(c =>
            c.id === commentId ? { ...c, likes: newLikesCount, isLikedByUser: false } : c
          ),
          // 触发Profile页面统计更新
          profileStatsVersion: state.profileStatsVersion + 1
        }));
      } else {
        // Like: Add like record
        const { error: insertError } = await supabase
          .from('comment_likes')
          .insert([{
            comment_id: commentId,
            user_id: userId
          }]);

        if (insertError) {
          throw insertError;
        }

        // Update likes count
        const newLikesCount = comment.likes + 1;
        const { error: updateError } = await supabase
          .from('comments')
          .update({ likes_count: newLikesCount })
          .eq('id', commentId);

        if (updateError) {
          throw updateError;
        }

        // Update local state
        set(state => ({
          comments: state.comments.map(c =>
            c.id === commentId ? { ...c, likes: newLikesCount, isLikedByUser: true } : c
          ),
          // 触发Profile页面统计更新
          profileStatsVersion: state.profileStatsVersion + 1
        }));
      }
    } catch (error: any) {
      set({ 
        error: "いいねの更新に失敗しました" 
      });
    }
  },

  createTopic: async (topicData) => {
    set({ isLoading: true, error: null });
    
    try {
      console.log('[TopicDetailsStore] Starting topic creation with data:', {
        title: topicData.title,
        description: topicData.description?.substring(0, 50) + '...',
        userId: topicData.author.id,
        location: topicData.location,
        tags: topicData.tags,
        hasImage: !!topicData.imageUrl
      });
      // Insert topic into Supabase
      const { data: insertedTopic, error: insertError } = await supabase
        .from('topics')
        .insert([
          {
            title: topicData.title,
            description: topicData.description,
            user_id: topicData.author.id,
            latitude: topicData.location.latitude,
            longitude: topicData.location.longitude,
            location_name: topicData.location.name,
            image_url: topicData.imageUrl,
            image_aspect_ratio: topicData.aspectRatio,
            original_width: topicData.originalWidth,
            original_height: topicData.originalHeight,
            tags: topicData.tags ? JSON.stringify(topicData.tags) : '[]'
          }
        ])
        .select(`
          *,
          users!topics_user_id_fkey (
            id,
            nickname,
            avatar_url,
            email
          )
        `)
        .single();

      if (insertError) {
        console.error('[TopicDetailsStore] Insert error details:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        throw insertError;
      }

      if (!insertedTopic) {
        console.error('[TopicDetailsStore] No data returned from insert');
        throw new Error('話題の作成に失敗しました：データが返されませんでした');
      }

      console.log('[TopicDetailsStore] Topic created successfully:', insertedTopic.id);

      // Transform to our Topic interface
      const newTopic: Topic = {
        id: insertedTopic.id,
        title: insertedTopic.title,
        description: insertedTopic.description || '',
        createdAt: insertedTopic.created_at,
        author: {
          id: insertedTopic.users.id,
          name: insertedTopic.users.nickname,
          avatar: insertedTopic.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(insertedTopic.users.nickname)}&background=random`,
          email: insertedTopic.users.email
        },
        location: {
          latitude: insertedTopic.latitude,
          longitude: insertedTopic.longitude,
          name: insertedTopic.location_name || undefined
        },
        commentCount: 0,
        participantCount: 1,
        lastMessageTime: undefined,
        imageUrl: insertedTopic.image_url || undefined,
        aspectRatio: insertedTopic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
        originalWidth: insertedTopic.original_width || undefined,
        originalHeight: insertedTopic.original_height || undefined,
        tags: (() => {
          try {
            if (!insertedTopic.tags) return undefined;
            
            // Handle already parsed arrays (JSONB from database)
            if (Array.isArray(insertedTopic.tags)) {
              return insertedTopic.tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
            }
            
            // Handle string format (shouldn't happen with JSONB but safeguard)
            if (typeof insertedTopic.tags === 'string') {
              const tagsStr = insertedTopic.tags.trim();
              if (!tagsStr) return undefined;
              
              const parsed = JSON.parse(tagsStr);
              if (Array.isArray(parsed)) {
                return parsed.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
              }
            }
            
            return undefined;
          } catch (parseError: any) {
            console.warn('[TopicDetailsStore] Error parsing tags for topic', insertedTopic.id, ':', parseError.message, 'Raw tags:', insertedTopic.tags);
            return undefined;
          }
        })(),
        isFavorited: false,
        isLiked: false,
        likesCount: 0
      };
      
      set({ 
        currentTopic: newTopic,
        isLoading: false 
      });

      return newTopic;
    } catch (error: any) {
      console.error('[TopicDetailsStore] Create topic error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        stack: error.stack
      });
      
      let errorMessage = 'トピックの作成に失敗しました';
      
      if (isNetworkError(error)) {
        errorMessage = 'ネットワーク接続を確認してください';
      } else if (error.code === '42703') {
        // Column does not exist error - likely tags column not added
        errorMessage = 'データベースの設定を確認してください。標籤機能のSQL文を実行する必要があります。';
        console.error('[TopicDetailsStore] Database schema error - tags column might not exist');
      } else if (error.message) {
        errorMessage += ': ' + error.message;
      }
      
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error; // Re-throw so the UI can handle it
    }
  },

  toggleFavorite: async (topicId, userId) => {
    set({ isFavoriteLoading: true });
    
    try {
      // Check if topic is already favorited
      const { data: existingFavorite, error: checkError } = await supabase
        .from('topic_favorites')
        .select('id')
        .eq('topic_id', topicId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingFavorite) {
        // Remove favorite
        const { error: deleteError } = await supabase
          .from('topic_favorites')
          .delete()
          .eq('topic_id', topicId)
          .eq('user_id', userId);

        if (deleteError) {
          throw deleteError;
        }

        // Update local state - remove from favorites and update isFavorited
        set(state => ({
          favoriteTopics: state.favoriteTopics.filter(t => t.id !== topicId),
          currentTopic: state.currentTopic?.id === topicId ? 
            { ...state.currentTopic, isFavorited: false, favoritesCount: Math.max(0, (state.currentTopic.favoritesCount || 0) - 1) } : 
            state.currentTopic
        }));
      } else {
        // Add favorite
        const { error: insertError } = await supabase
          .from('topic_favorites')
          .insert([
            {
              topic_id: topicId,
              user_id: userId
            }
          ]);

        if (insertError) {
          throw insertError;
        }

        // Get the topic to add to favorites if it's not the current topic
        let favoriteTopicData: Topic | null = null;
        if (get().currentTopic?.id === topicId) {
          favoriteTopicData = { ...get().currentTopic!, isFavorited: true };
        } else {
          // Fetch topic data for favorites list
          const { data: topicData, error: topicError } = await supabase
            .from('topics')
            .select(`
              *,
              users!topics_user_id_fkey (
                id,
                nickname,
                avatar_url,
                email
              )
            `)
            .eq('id', topicId)
            .single();

          if (!topicError && topicData) {
            favoriteTopicData = {
              id: topicData.id,
              title: topicData.title,
              description: topicData.description || '',
              createdAt: topicData.created_at,
              author: {
                id: topicData.users.id,
                name: topicData.users.nickname,
                avatar: topicData.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topicData.users.nickname)}&background=random`,
                email: topicData.users.email
              },
              location: {
                latitude: topicData.latitude,
                longitude: topicData.longitude,
                name: topicData.location_name || undefined
              },
              commentCount: 0, // Will be updated if needed
              participantCount: 1,
              imageUrl: topicData.image_url || undefined,
              aspectRatio: topicData.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
              isFavorited: true,
              isLiked: false,
              likesCount: 0
            };
          }
        }

        // Update local state - add to favorites and update isFavorited
        set(state => ({
          favoriteTopics: favoriteTopicData ? [favoriteTopicData, ...state.favoriteTopics] : state.favoriteTopics,
          currentTopic: state.currentTopic?.id === topicId ? 
            { ...state.currentTopic, isFavorited: true, favoritesCount: (state.currentTopic.favoritesCount || 0) + 1 } : 
            state.currentTopic
        }));
      }
    } catch (error: any) {
      set({ 
        error: "お気に入りの更新に失敗しました" 
      });
    } finally {
      set({ isFavoriteLoading: false });
    }
  },

  toggleLike: async (topicId, userId) => {
    set({ isLikeLoading: true });
    
    try {
      // Check if topic is already liked
      const { data: existingLike, error: checkError } = await supabase
        .from('topic_likes')
        .select('id')
        .eq('topic_id', topicId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingLike) {
        // Unlike: Remove like record
        const { error: deleteError } = await supabase
          .from('topic_likes')
          .delete()
          .eq('topic_id', topicId)
          .eq('user_id', userId);

        if (deleteError) {
          throw deleteError;
        }

        // Update local state - remove like
        set(state => ({
          currentTopic: state.currentTopic?.id === topicId ? 
            { ...state.currentTopic, isLiked: false, likesCount: Math.max(0, (state.currentTopic.likesCount || 0) - 1) } : 
            state.currentTopic,
          // 触发Profile页面统计更新
          profileStatsVersion: state.profileStatsVersion + 1
        }));
      } else {
        // Like: Add like record
        const { error: insertError } = await supabase
          .from('topic_likes')
          .insert([
            {
              topic_id: topicId,
              user_id: userId
            }
          ]);

        if (insertError) {
          throw insertError;
        }

        // Update local state - add like
        set(state => ({
          currentTopic: state.currentTopic?.id === topicId ? 
            { ...state.currentTopic, isLiked: true, likesCount: (state.currentTopic.likesCount || 0) + 1 } : 
            state.currentTopic,
          // 触发Profile页面统计更新
          profileStatsVersion: state.profileStatsVersion + 1
        }));
      }
    } catch (error: any) {
      set({ 
        error: "いいねの更新に失敗しました" 
      });
    } finally {
      set({ isLikeLoading: false });
    }
  },

  fetchFavoriteTopics: async (userId) => {
    set({ isFavoriteLoading: true, error: null });
    
    try {
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('topic_favorites')
        .select(`
          *,
          topics!topic_favorites_topic_id_fkey (
            *,
            users!topics_user_id_fkey (
              id,
              nickname,
              avatar_url,
              email
            ),
            comments!comments_topic_id_fkey (count)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (favoritesError) {
        throw favoritesError;
      }

      // Transform data to Topic array
      const favoriteTopics: Topic[] = (favoritesData || []).map(favorite => {
        const topic = favorite.topics;
        return {
          id: topic.id,
          title: topic.title,
          description: topic.description || '',
          createdAt: topic.created_at,
          author: {
            id: topic.users.id,
            name: topic.users.nickname,
            avatar: topic.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topic.users.nickname)}&background=random`,
            email: topic.users.email
          },
          location: {
            latitude: topic.latitude,
            longitude: topic.longitude,
            name: topic.location_name || undefined
          },
          commentCount: topic.comments?.[0]?.count || 0,
          participantCount: 1, // Will be calculated if needed
          imageUrl: topic.image_url || undefined,
          aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
          isFavorited: true,
          isLiked: false,
          likesCount: 0
        };
      });

      set({ 
        favoriteTopics,
        isFavoriteLoading: false 
      });
    } catch (error: any) {
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : 'お気に入りの取得に失敗しました';
      set({ 
        error: errorMessage, 
        isFavoriteLoading: false 
      });
    }
  },

  checkInteractionStatus: async (topicIds, userId) => {
    try {
      // Use optimized batch query
      const interactionStatuses = await getCachedBatchTopicInteractionStatus(topicIds, userId);
      const statusMap = new Map(
        interactionStatuses.map(status => [status.topicId, status])
      );
      
      // Only update current topic if it's in the list being checked
      set(state => ({
        currentTopic: state.currentTopic && topicIds.includes(state.currentTopic.id) ? {
          ...state.currentTopic,
          isFavorited: statusMap.get(state.currentTopic.id)?.isFavorited ?? state.currentTopic.isFavorited,
          isLiked: statusMap.get(state.currentTopic.id)?.isLiked ?? state.currentTopic.isLiked,
          likesCount: statusMap.get(state.currentTopic.id)?.likesCount ?? state.currentTopic.likesCount ?? 0,
          commentCount: statusMap.get(state.currentTopic.id)?.commentsCount ?? state.currentTopic.commentCount
        } : state.currentTopic,
        
        // Also update favorite topics list if needed
        favoriteTopics: state.favoriteTopics.map(topic => {
          if (!topicIds.includes(topic.id)) return topic;
          const status = statusMap.get(topic.id);
          if (!status) return topic;
          
          return {
            ...topic,
            isFavorited: status.isFavorited,
            isLiked: status.isLiked,
            likesCount: status.likesCount,
            commentCount: status.commentsCount
          };
        }),
        
        // Also update user topics list if needed
        userTopics: state.userTopics.map(topic => {
          if (!topicIds.includes(topic.id)) return topic;
          const status = statusMap.get(topic.id);
          if (!status) return topic;
          
          return {
            ...topic,
            isFavorited: status.isFavorited,
            isLiked: status.isLiked,
            likesCount: status.likesCount,
            commentCount: status.commentsCount
          };
        }),
        
        // Also update liked topics list if needed
        likedTopics: state.likedTopics.map(topic => {
          if (!topicIds.includes(topic.id)) return topic;
          const status = statusMap.get(topic.id);
          if (!status) return topic;
          
          return {
            ...topic,
            isFavorited: status.isFavorited,
            isLiked: status.isLiked,
            likesCount: status.likesCount,
            commentCount: status.commentsCount
          };
        })
      }));
    } catch (error: any) {
      console.error('Error checking interaction status:', error);
    }
  },

  clearCurrentTopic: () => {
    set({ currentTopic: null });
  },

  clearComments: () => {
    set({ comments: [] });
  },

  fetchUserTopics: async (userId) => {
    set({ isUserTopicsLoading: true, error: null });
    
    try {
      const { data: userTopicsData, error: userTopicsError } = await supabase
        .from('topics')
        .select(`
          *,
          users!topics_user_id_fkey (
            id,
            nickname,
            avatar_url,
            email
          ),
          comments!comments_topic_id_fkey (count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (userTopicsError) {
        throw userTopicsError;
      }

      // Transform data to Topic array
      const userTopics: Topic[] = (userTopicsData || []).map(topic => ({
        id: topic.id,
        title: topic.title,
        description: topic.description || '',
        createdAt: topic.created_at,
        author: {
          id: topic.users.id,
          name: topic.users.nickname,
          avatar: topic.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topic.users.nickname)}&background=random`,
          email: topic.users.email
        },
        location: {
          latitude: topic.latitude,
          longitude: topic.longitude,
          name: topic.location_name || undefined
        },
        commentCount: topic.comments?.[0]?.count || 0,
        participantCount: 1, // Will be calculated if needed
        imageUrl: topic.image_url || undefined,
        aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
        isFavorited: false, // Will be updated by interaction status check
        isLiked: false,
        likesCount: 0
      }));

      set({ 
        userTopics,
        isUserTopicsLoading: false 
      });
      
      // Check interaction status for user's own topics if needed
      if (userTopics.length > 0) {
        const topicIds = userTopics.map(t => t.id);
        await get().checkInteractionStatus(topicIds, userId);
      }
    } catch (error: any) {
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : '投稿の取得に失敗しました';
      set({ 
        error: errorMessage, 
        isUserTopicsLoading: false 
      });
    }
  },

  fetchLikedTopics: async (userId) => {
    set({ isLikedTopicsLoading: true, error: null });
    
    try {
      const { data: likedTopicsData, error: likedTopicsError } = await supabase
        .from('topic_likes')
        .select(`
          created_at,
          topics!topic_likes_topic_id_fkey (
            *,
            users!topics_user_id_fkey (
              id,
              nickname,
              avatar_url,
              email
            ),
            comments!comments_topic_id_fkey (count)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (likedTopicsError) {
        throw likedTopicsError;
      }

      // Transform data to Topic array
      const likedTopics: Topic[] = (likedTopicsData || []).map((likeRecord: any) => {
        const topic = likeRecord.topics;
        return {
          id: topic.id,
          title: topic.title,
          description: topic.description || '',
          createdAt: topic.created_at,
          author: {
            id: topic.users.id,
            name: topic.users.nickname,
            avatar: topic.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topic.users.nickname)}&background=random`,
            email: topic.users.email
          },
          location: {
            latitude: topic.latitude,
            longitude: topic.longitude,
            name: topic.location_name || undefined
          },
          commentCount: topic.comments?.[0]?.count || 0,
          participantCount: 1, // Will be calculated if needed
          imageUrl: topic.image_url || undefined,
          aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
          isFavorited: false, // Will be updated by interaction status check
          isLiked: true, // These are liked topics
          likesCount: 0 // Will be updated by interaction status check
        };
      });

      set({ 
        likedTopics,
        isLikedTopicsLoading: false 
      });
      
      // Check interaction status for liked topics
      if (likedTopics.length > 0) {
        const topicIds = likedTopics.map(t => t.id);
        await get().checkInteractionStatus(topicIds, userId);
      }
    } catch (error: any) {
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : 'いいねした投稿の取得に失敗しました';
      set({ 
        error: errorMessage, 
        isLikedTopicsLoading: false 
      });
    }
  },

  deleteTopic: async (topicId, userId) => {
    try {
      // 执行级联删除操作
      // 1. 删除评论的点赞
      const { error: commentLikesError } = await supabase
        .rpc('delete_comment_likes_by_topic', { topic_id: topicId });
      
      if (commentLikesError) {
        console.warn('Failed to delete comment likes:', commentLikesError);
      }
      
      // 2. 删除评论
      const { error: commentsError } = await supabase
        .from('comments')
        .delete()
        .eq('topic_id', topicId);
        
      if (commentsError) {
        console.warn('Failed to delete comments:', commentsError);
      }
      
      // 3. 删除话题点赞
      const { error: topicLikesError } = await supabase
        .from('topic_likes')
        .delete()
        .eq('topic_id', topicId);
        
      if (topicLikesError) {
        console.warn('Failed to delete topic likes:', topicLikesError);
      }
      
      // 4. 删除话题收藏
      const { error: favoritesError } = await supabase
        .from('topic_favorites')
        .delete()
        .eq('topic_id', topicId);
        
      if (favoritesError) {
        console.warn('Failed to delete favorites:', favoritesError);
      }
      
      // 5. 删除聊天消息
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('topic_id', topicId);
        
      if (messagesError) {
        console.warn('Failed to delete chat messages:', messagesError);
      }
      
      // 6. 最后删除话题本身（添加用户权限验证）
      const { error: topicError } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId)
        .eq('user_id', userId); // 确保只能删除自己的话题
        
      if (topicError) {
        throw topicError;
      }
      
      // 从本地状态中移除已删除的话题
      set(state => ({
        userTopics: state.userTopics.filter(topic => topic.id !== topicId),
        favoriteTopics: state.favoriteTopics.filter(topic => topic.id !== topicId),
        likedTopics: state.likedTopics.filter(topic => topic.id !== topicId),
        // 如果当前查看的是被删除的话题，清空它
        currentTopic: state.currentTopic?.id === topicId ? null : state.currentTopic,
        comments: state.currentTopic?.id === topicId ? [] : state.comments,
        // 增加 profileStatsVersion 触发 Profile 页面统计刷新
        profileStatsVersion: state.profileStatsVersion + 1
      }));
      
    } catch (error: any) {
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : '投稿の削除に失敗しました';
      set({ error: errorMessage });
      throw error; // Re-throw so the UI can handle it
    }
  },

  cleanup: () => {
    // Clear all topic-specific data
    set({ 
      currentTopic: null,
      comments: [],
      favoriteTopics: [],
      userTopics: [],
      likedTopics: [],
      error: null
    });
    console.log('[TopicDetailsStore] Cleanup completed');
  }
}));