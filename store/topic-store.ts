import { create } from 'zustand';
import { Topic, Comment, Message } from '@/types';
import { supabase } from '@/lib/supabase';
import { encryptMessage, decryptMessage, isEncrypted } from '@/lib/encryption';

interface TopicState {
  topics: Topic[];
  filteredTopics: Topic[];
  mapFilteredTopics: Topic[];
  chatFilteredTopics: Topic[];
  currentTopic: Topic | null;
  comments: Comment[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  error: string | null;
  searchQuery: string;
  mapSearchQuery: string;
  chatSearchQuery: string;
  
  fetchNearbyTopics: (latitude: number, longitude: number, refresh?: boolean) => Promise<void>;
  loadMoreTopics: (latitude: number, longitude: number) => Promise<void>;
  fetchTopicById: (id: string) => Promise<void>;
  fetchComments: (topicId: string) => Promise<void>;
  addComment: (topicId: string, text: string, userId: string) => Promise<void>;
  createTopic: (topic: Omit<Topic, 'id' | 'createdAt' | 'commentCount' | 'participantCount'>) => Promise<void>;
  likeComment: (commentId: string, userId: string) => Promise<void>;
  searchTopics: (query: string) => void;
  clearSearch: () => void;
  searchMapTopics: (query: string) => void;
  clearMapSearch: () => void;
  searchChatTopics: (query: string) => void;
  clearChatSearch: () => void;
}

const TOPICS_PER_PAGE = 10;

export const useTopicStore = create<TopicState>((set, get) => ({
  topics: [],
  filteredTopics: [],
  mapFilteredTopics: [],
  chatFilteredTopics: [],
  currentTopic: null,
  comments: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  currentPage: 0,
  error: null,
  searchQuery: '',
  mapSearchQuery: '',
  chatSearchQuery: '',

  fetchNearbyTopics: async (latitude, longitude, refresh = false) => {
    set({ isLoading: true, error: null });
    
    if (refresh) {
      set({ currentPage: 0, hasMore: true });
    }
    
    try {
      // Fetch topics from Supabase with pagination and comment counts
      const { data: topicsData, error: topicsError } = await supabase
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
        .order('created_at', { ascending: false })
        .range(0, TOPICS_PER_PAGE - 1);

      if (topicsError) {
        throw topicsError;
      }

      // Transform data to match our Topic interface
      const topics: Topic[] = (topicsData || []).map(topic => {
        const distance = calculateDistance(
          latitude, 
          longitude, 
          topic.latitude, 
          topic.longitude
        );
        
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
          distance,
          commentCount: topic.comments?.[0]?.count || 0,
          participantCount: 1
        };
      });

      // Sort by distance
      const sortedTopics = topics.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      set({ 
        topics: sortedTopics,
        filteredTopics: sortedTopics,
        mapFilteredTopics: sortedTopics,
        chatFilteredTopics: sortedTopics,
        currentPage: 1,
        hasMore: topicsData?.length === TOPICS_PER_PAGE,
        isLoading: false 
      });
      
      // Apply current searches if exist
      const { searchQuery, mapSearchQuery, chatSearchQuery } = get();
      if (searchQuery) {
        get().searchTopics(searchQuery);
      }
      if (mapSearchQuery) {
        get().searchMapTopics(mapSearchQuery);
      }
      if (chatSearchQuery) {
        get().searchChatTopics(chatSearchQuery);
      }
    } catch (error: any) {
      set({ 
        error: "近くのトピックの取得に失敗しました", 
        isLoading: false 
      });
    }
  },

  loadMoreTopics: async (latitude, longitude) => {
    const { isLoadingMore, hasMore, currentPage, topics } = get();
    
    if (isLoadingMore || !hasMore) return;
    
    set({ isLoadingMore: true, error: null });
    
    try {
      const from = currentPage * TOPICS_PER_PAGE;
      const to = from + TOPICS_PER_PAGE - 1;
      
      // Fetch more topics from Supabase with comment counts
      const { data: topicsData, error: topicsError } = await supabase
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
        .order('created_at', { ascending: false })
        .range(from, to);

      if (topicsError) {
        throw topicsError;
      }

      // Transform data to match our Topic interface
      const newTopics: Topic[] = (topicsData || []).map(topic => {
        const distance = calculateDistance(
          latitude, 
          longitude, 
          topic.latitude, 
          topic.longitude
        );
        
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
          distance,
          commentCount: topic.comments?.[0]?.count || 0,
          participantCount: 1
        };
      });

      // Combine with existing topics and sort by distance
      const allTopics = [...topics, ...newTopics];
      const sortedTopics = allTopics.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      set({ 
        topics: sortedTopics,
        filteredTopics: sortedTopics,
        mapFilteredTopics: sortedTopics,
        chatFilteredTopics: sortedTopics,
        currentPage: currentPage + 1,
        hasMore: topicsData?.length === TOPICS_PER_PAGE,
        isLoadingMore: false 
      });
      
      // Apply current searches if exist
      const { searchQuery, mapSearchQuery, chatSearchQuery } = get();
      if (searchQuery) {
        get().searchTopics(searchQuery);
      }
      if (mapSearchQuery) {
        get().searchMapTopics(mapSearchQuery);
      }
      if (chatSearchQuery) {
        get().searchChatTopics(chatSearchQuery);
      }
    } catch (error: any) {
      set({ 
        error: "さらなるトピックの取得に失敗しました", 
        isLoadingMore: false 
      });
    }
  },

  fetchTopicById: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      // Fetch topic from Supabase with comment count
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
          comments!comments_topic_id_fkey (count)
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
        participantCount: 1
      };
      
      set({ 
        currentTopic: topic,
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: "トピックの取得に失敗しました", 
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
      set({ 
        error: "コメントの取得に失敗しました", 
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
      set({ 
        error: "コメントの投稿に失敗しました", 
        isLoading: false 
      });
      throw error; // Re-throw so the UI can handle it
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
            location_name: topicData.location.name
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
        participantCount: 1
      };
      
      set(state => ({ 
        topics: [newTopic, ...state.topics],
        filteredTopics: [newTopic, ...state.filteredTopics],
        currentTopic: newTopic,
        isLoading: false 
      }));
    } catch (error: any) {
      set({ 
        error: "トピックの作成に失敗しました", 
        isLoading: false 
      });
      throw error; // Re-throw so the UI can handle it
    }
  },

  searchTopics: (query) => {
    const { topics } = get();
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      set({ 
        filteredTopics: topics,
        searchQuery: query 
      });
      return;
    }
    
    const filtered = topics.filter(topic => {
      const titleMatch = topic.title.toLowerCase().includes(normalizedQuery);
      const descriptionMatch = topic.description.toLowerCase().includes(normalizedQuery);
      const authorMatch = topic.author.name.toLowerCase().includes(normalizedQuery);
      const locationMatch = topic.location.name?.toLowerCase().includes(normalizedQuery) || false;
      
      return titleMatch || descriptionMatch || authorMatch || locationMatch;
    });
    
    set({ 
      filteredTopics: filtered,
      searchQuery: query 
    });
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

  clearSearch: () => {
    const { topics } = get();
    set({ 
      filteredTopics: topics,
      searchQuery: '' 
    });
  },

  searchMapTopics: (query) => {
    const { topics } = get();
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      set({ 
        mapFilteredTopics: topics,
        mapSearchQuery: query 
      });
      return;
    }
    
    const filtered = topics.filter(topic => {
      const titleMatch = topic.title.toLowerCase().includes(normalizedQuery);
      const descriptionMatch = topic.description.toLowerCase().includes(normalizedQuery);
      const authorMatch = topic.author.name.toLowerCase().includes(normalizedQuery);
      const locationMatch = topic.location.name?.toLowerCase().includes(normalizedQuery) || false;
      
      return titleMatch || descriptionMatch || authorMatch || locationMatch;
    });
    
    set({ 
      mapFilteredTopics: filtered,
      mapSearchQuery: query 
    });
  },

  clearMapSearch: () => {
    const { topics } = get();
    set({ 
      mapFilteredTopics: topics,
      mapSearchQuery: '' 
    });
  },

  searchChatTopics: (query) => {
    const { topics } = get();
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      set({ 
        chatFilteredTopics: topics,
        chatSearchQuery: query 
      });
      return;
    }
    
    const filtered = topics.filter(topic => {
      const titleMatch = topic.title.toLowerCase().includes(normalizedQuery);
      const descriptionMatch = topic.description.toLowerCase().includes(normalizedQuery);
      const authorMatch = topic.author.name.toLowerCase().includes(normalizedQuery);
      const locationMatch = topic.location.name?.toLowerCase().includes(normalizedQuery) || false;
      
      return titleMatch || descriptionMatch || authorMatch || locationMatch;
    });
    
    set({ 
      chatFilteredTopics: filtered,
      chatSearchQuery: query 
    });
  },

  clearChatSearch: () => {
    const { topics } = get();
    set({ 
      chatFilteredTopics: topics,
      chatSearchQuery: '' 
    });
  },

}));

// Helper function to calculate distance between two coordinates in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
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