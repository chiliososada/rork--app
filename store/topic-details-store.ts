import { create } from 'zustand';
import { Topic, Comment } from '@/types';
import { supabase } from '@/lib/supabase';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';

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
  
  // 加载状态
  isLoading: boolean;
  isFavoriteLoading: boolean;
  isLikeLoading: boolean;
  
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
  createTopic: (topic: Omit<Topic, 'id' | 'createdAt' | 'commentCount' | 'participantCount'>) => Promise<void>;
  
  // 互动功能（点赞/收藏）
  toggleFavorite: (topicId: string, userId: string) => Promise<void>;
  toggleLike: (topicId: string, userId: string) => Promise<void>;
  
  // 收藏列表管理
  fetchFavoriteTopics: (userId: string) => Promise<void>;
  
  // 状态检查工具方法
  checkFavoriteStatus: (topicIds: string[], userId: string) => Promise<void>;
  checkLikeStatus: (topicIds: string[], userId: string) => Promise<void>;
  
  // 清理方法
  clearCurrentTopic: () => void;
  clearComments: () => void;
}

export const useTopicDetailsStore = create<TopicDetailsState>((set, get) => ({
  currentTopic: null,
  comments: [],
  favoriteTopics: [],
  isLoading: false,
  isFavoriteLoading: false,
  isLikeLoading: false,
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

      // Check favorite status
      let isFavorited = false;
      if (currentUserId) {
        const { data: favoriteData } = await supabase
          .from('topic_favorites')
          .select('id')
          .eq('topic_id', id)
          .eq('user_id', currentUserId)
          .single();
        
        isFavorited = !!favoriteData;
      }

      // Check like status
      let isLiked = false;
      if (currentUserId) {
        const { data: likeData } = await supabase
          .from('topic_likes')
          .select('id')
          .eq('topic_id', id)
          .eq('user_id', currentUserId)
          .single();
        
        isLiked = !!likeData;
      }

      // Get likes count
      const { count: likesCount } = await supabase
        .from('topic_likes')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', id);

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
            image_aspect_ratio: topicData.aspectRatio
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
        throw insertError;
      }

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
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : 'トピックの作成に失敗しました';
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

  checkFavoriteStatus: async (topicIds, userId) => {
    try {
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('topic_favorites')
        .select('topic_id')
        .eq('user_id', userId)
        .in('topic_id', topicIds);

      if (favoritesError) {
        throw favoritesError;
      }

      const favoritedTopicIds = new Set(favoritesData?.map(f => f.topic_id) || []);
      
      // Only update current topic if it's in the list being checked
      set(state => ({
        currentTopic: state.currentTopic && topicIds.includes(state.currentTopic.id) ? {
          ...state.currentTopic,
          isFavorited: favoritedTopicIds.has(state.currentTopic.id)
        } : state.currentTopic
      }));
    } catch (error: any) {
      console.error('Error checking favorite status:', error);
    }
  },

  checkLikeStatus: async (topicIds, userId) => {
    try {
      // Check user's like status
      const { data: likesData, error: likesError } = await supabase
        .from('topic_likes')
        .select('topic_id')
        .eq('user_id', userId)
        .in('topic_id', topicIds);

      if (likesError) {
        throw likesError;
      }

      const likedTopicIds = new Set(likesData?.map(l => l.topic_id) || []);

      // Get likes count for each topic
      const likesCountPromises = topicIds.map(async (topicId) => {
        const { count } = await supabase
          .from('topic_likes')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId);
        return { topicId, count: count || 0 };
      });

      const likesCountResults = await Promise.all(likesCountPromises);
      const likesCountMap = new Map(likesCountResults.map(r => [r.topicId, r.count]));
      
      // Only update current topic if it's in the list being checked
      set(state => ({
        currentTopic: state.currentTopic && topicIds.includes(state.currentTopic.id) ? {
          ...state.currentTopic,
          isLiked: likedTopicIds.has(state.currentTopic.id),
          likesCount: likesCountMap.get(state.currentTopic.id) ?? state.currentTopic.likesCount ?? 0
        } : state.currentTopic
      }));
    } catch (error: any) {
      console.error('Error checking like status:', error);
    }
  },

  clearCurrentTopic: () => {
    set({ currentTopic: null });
  },

  clearComments: () => {
    set({ comments: [] });
  }
}));