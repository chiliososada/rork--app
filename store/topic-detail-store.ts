import { create } from 'zustand';
import { Topic, Comment } from '@/types';
import { supabase } from '@/lib/supabase';
import { withNetworkRetry, isNetworkError } from '@/lib/retry';
import { eventBus, EVENT_TYPES, TopicInteractionEvent, CommentEvent } from '@/lib/event-bus';
// Using unified caching system instead of separate topic cache

interface TopicDetailState {
  currentTopic: Topic | null;
  comments: Comment[];
  isLoading: boolean;
  isLoadingComments: boolean;
  error: string | null;
  
  // トピック管理
  fetchTopicById: (id: string) => Promise<void>;
  fetchFreshTopicData: (id: string) => Promise<void>;
  updateCurrentTopic: (updates: Partial<Topic>) => void;
  clearCurrentTopic: () => void;
  
  // コメント管理
  fetchComments: (topicId: string) => Promise<void>;
  addComment: (topicId: string, text: string, userId: string) => Promise<void>;
  likeComment: (commentId: string, userId: string) => Promise<void>;
  
  // インタラクション
  toggleFavorite: (topicId: string, userId: string) => Promise<void>;
  toggleLike: (topicId: string, userId: string) => Promise<void>;
}

export const useTopicDetailStore = create<TopicDetailState>((set, get) => ({
  currentTopic: null,
  comments: [],
  isLoading: false,
  isLoadingComments: false,
  error: null,

  fetchTopicById: async (id) => {
    const { currentTopic } = get();
    
    // If switching to a different topic, clear current state immediately to prevent flashing
    if (currentTopic && currentTopic.id !== id) {
      set({ 
        currentTopic: null,
        comments: [],
        isLoading: true, 
        error: null 
      });
    } else if (!currentTopic) {
      // No current topic, just set loading
      set({ isLoading: true, error: null });
    }
    // If we already have the correct topic, don't set loading to prevent unnecessary re-renders
    
    await get().fetchFreshTopicData(id);
  },

  fetchFreshTopicData: async (id: string) => {
    try {
      await withNetworkRetry(async () => {
        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;

        // Fetch topic from Supabase
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
        
        // Check participation status
        let isParticipated = false;
        if (currentUserId) {
          // 用户是创建者或在topic_participants表中有活跃记录
          const isCreator = topicData.user_id === currentUserId;
          if (isCreator) {
            isParticipated = true;
          } else {
            const { data: participantData } = await supabase
              .from('topic_participants')
              .select('id')
              .eq('topic_id', id)
              .eq('user_id', currentUserId)
              .eq('is_active', true)
              .single();
            
            isParticipated = !!participantData;
          }
        }

        // Get likes count
        const { count: likesCount } = await supabase
          .from('topic_likes')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', id);

        // Calculate participant count
        const uniqueParticipants = new Set(topicData.chat_messages?.map((msg: any) => msg.user_id) || []);
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
            nickname: topicData.users.nickname,
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
          likesCount: likesCount || 0,
          isParticipated
        };
        
        // Topic caching is now handled by the unified cache system
        
        set({ 
          currentTopic: topic,
          isLoading: false 
        });
      });
    } catch (error: any) {
      console.error('Failed to fetch topic:', error);
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : 'トピックの取得に失敗しました';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
    }
  },

  updateCurrentTopic: (updates) => {
    set(state => {
      const updatedTopic = state.currentTopic ? { ...state.currentTopic, ...updates } : null;
      
      // Cache updates are handled by the unified cache system
      
      return { currentTopic: updatedTopic };
    });
  },

  clearCurrentTopic: () => {
    // Clear all state to prevent showing stale data when switching topics
    set({ 
      currentTopic: null,
      comments: [], 
      error: null,
      isLoading: false,
      isLoadingComments: false
    });
  },

  fetchComments: async (topicId) => {
    set({ isLoadingComments: true, error: null });
    
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
          nickname: comment.users.nickname,
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
        isLoadingComments: false 
      }));
    } catch (error: any) {
      set({ 
        error: "コメントの取得に失敗しました", 
        isLoadingComments: false 
      });
    }
  },

  addComment: async (topicId, text, userId) => {
    set({ isLoadingComments: true, error: null });
    
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
          nickname: insertedComment.users.nickname,
          avatar: insertedComment.users.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(insertedComment.users.nickname)}&background=random`,
          email: insertedComment.users.email
        },
        likes: insertedComment.likes_count || 0,
        topicId,
        isLikedByUser: false
      };
      
      const newCommentCount = get().comments.length + 1;
      
      set(state => ({ 
        comments: [...state.comments, newComment],
        // Update current topic comment count
        currentTopic: state.currentTopic?.id === topicId ? {
          ...state.currentTopic,
          commentCount: newCommentCount
        } : state.currentTopic,
        isLoadingComments: false 
      }));
      
      // Emit event for other stores
      eventBus.emit(EVENT_TYPES.TOPIC_COMMENTED, { 
        topicId, 
        userId,
        commentCount: newCommentCount
      } as CommentEvent);
    } catch (error: any) {
      set({ 
        error: "コメントの投稿に失敗しました", 
        isLoadingComments: false 
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
          )
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
          )
        }));
      }
    } catch (error: any) {
      set({ 
        error: "いいねの更新に失敗しました" 
      });
    }
  },

  toggleFavorite: async (topicId, userId) => {
    const { currentTopic } = get();
    if (!currentTopic || currentTopic.id !== topicId) return;
    
    try {
      const isFavorited = currentTopic.isFavorited;
      
      if (isFavorited) {
        // Remove favorite
        const { error: deleteError } = await supabase
          .from('topic_favorites')
          .delete()
          .eq('topic_id', topicId)
          .eq('user_id', userId);

        if (deleteError) {
          throw deleteError;
        }

        set(state => ({
          currentTopic: state.currentTopic ? {
            ...state.currentTopic,
            isFavorited: false,
            favoritesCount: Math.max(0, (state.currentTopic.favoritesCount || 0) - 1)
          } : null
        }));
        
        // Emit event for other stores
        eventBus.emit(EVENT_TYPES.TOPIC_UNFAVORITED, { 
          topicId, 
          userId 
        } as TopicInteractionEvent);
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

        set(state => ({
          currentTopic: state.currentTopic ? {
            ...state.currentTopic,
            isFavorited: true,
            favoritesCount: (state.currentTopic.favoritesCount || 0) + 1
          } : null
        }));
        
        // Emit event for other stores
        eventBus.emit(EVENT_TYPES.TOPIC_FAVORITED, { 
          topicId, 
          userId 
        } as TopicInteractionEvent);
      }
    } catch (error: any) {
      set({ 
        error: "お気に入りの更新に失敗しました" 
      });
    }
  },

  toggleLike: async (topicId, userId) => {
    const { currentTopic } = get();
    if (!currentTopic || currentTopic.id !== topicId) return;
    
    try {
      const isLiked = currentTopic.isLiked;
      
      if (isLiked) {
        // Unlike
        const { error: deleteError } = await supabase
          .from('topic_likes')
          .delete()
          .eq('topic_id', topicId)
          .eq('user_id', userId);

        if (deleteError) {
          throw deleteError;
        }

        const newLikesCount = Math.max(0, (currentTopic.likesCount || 0) - 1);
        
        set(state => ({
          currentTopic: state.currentTopic ? {
            ...state.currentTopic,
            isLiked: false,
            likesCount: newLikesCount
          } : null
        }));
        
        // Emit event for other stores
        eventBus.emit(EVENT_TYPES.TOPIC_UNLIKED, { 
          topicId, 
          userId,
          count: newLikesCount
        } as TopicInteractionEvent);
      } else {
        // Like
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

        const newLikesCount = (currentTopic.likesCount || 0) + 1;
        
        set(state => ({
          currentTopic: state.currentTopic ? {
            ...state.currentTopic,
            isLiked: true,
            likesCount: newLikesCount
          } : null
        }));
        
        // Emit event for other stores
        eventBus.emit(EVENT_TYPES.TOPIC_LIKED, { 
          topicId, 
          userId,
          count: newLikesCount
        } as TopicInteractionEvent);
      }
    } catch (error: any) {
      set({ 
        error: "いいねの更新に失敗しました" 
      });
    }
  }
}));