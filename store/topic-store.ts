import { create } from 'zustand';
import { Topic, Comment, Message, TopicFavorite } from '@/types';
import { supabase } from '@/lib/supabase';
import { encryptMessage, decryptMessage, isEncrypted } from '@/lib/encryption';
import { withNetworkRetry, withDatabaseRetry, isNetworkError } from '@/lib/retry';

interface TopicState {
  topics: Topic[];
  filteredTopics: Topic[];
  mapFilteredTopics: Topic[];
  chatFilteredTopics: Topic[];
  currentTopic: Topic | null;
  comments: Comment[];
  favoriteTopics: Topic[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isFavoriteLoading: boolean;
  isLikeLoading: boolean;
  hasMore: boolean;
  currentPage: number;
  error: string | null;
  searchQuery: string;
  mapSearchQuery: string;
  chatSearchQuery: string;
  
  // Profile统计更新通知
  profileStatsVersion: number;
  
  // 请求去重和状态管理
  pendingRequests: Set<string>;
  requestQueue: Map<string, Promise<any>>;
  lastRequestTime: number;
  
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
  toggleFavorite: (topicId: string, userId: string) => Promise<void>;
  fetchFavoriteTopics: (userId: string) => Promise<void>;
  checkFavoriteStatus: (topicIds: string[], userId: string) => Promise<void>;
  toggleLike: (topicId: string, userId: string) => Promise<void>;
  checkLikeStatus: (topicIds: string[], userId: string) => Promise<void>;
  ensureMinimumTopicsForMap: (latitude: number, longitude: number) => Promise<void>;
}

const TOPICS_PER_PAGE = 10;
const MINIMUM_MAP_TOPICS = 30;

export const useTopicStore = create<TopicState>((set, get) => ({
  topics: [],
  filteredTopics: [],
  mapFilteredTopics: [],
  chatFilteredTopics: [],
  currentTopic: null,
  comments: [],
  favoriteTopics: [],
  isLoading: false,
  isLoadingMore: false,
  isFavoriteLoading: false,
  isLikeLoading: false,
  hasMore: true,
  currentPage: 0,
  error: null,
  searchQuery: '',
  mapSearchQuery: '',
  chatSearchQuery: '',
  
  // Profile统计更新通知
  profileStatsVersion: 0,
  
  // 请求去重和状态管理
  pendingRequests: new Set(),
  requestQueue: new Map(),
  lastRequestTime: 0,

  fetchNearbyTopics: async (latitude, longitude, refresh = false) => {
    const requestKey = `fetchNearby_${latitude}_${longitude}_${refresh}`;
    const { pendingRequests, requestQueue, lastRequestTime } = get();
    
    // 防止频繁请求（1秒内最多一次）
    const now = Date.now();
    if (!refresh && now - lastRequestTime < 1000) {
      console.log('请求过于频繁，已忽略');
      return;
    }
    
    // 检查是否有相同的请求正在进行
    if (pendingRequests.has(requestKey)) {
      console.log('相同请求正在进行中，等待结果');
      return requestQueue.get(requestKey);
    }
    
    set({ isLoading: true, error: null, lastRequestTime: now });
    
    // 将请求标记为进行中
    set(state => ({
      pendingRequests: new Set([...state.pendingRequests, requestKey])
    }));
    
    // 创建新请求并添加到队列
    const requestPromise = withNetworkRetry(async () => {
      if (refresh) {
        set({ 
          currentPage: 0, 
          hasMore: true,
          topics: [],
          filteredTopics: [],
          mapFilteredTopics: [],
          chatFilteredTopics: []
        });
      }
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch topics from Supabase with pagination, comment counts, and message counts (for participant count)
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
          comments!comments_topic_id_fkey (count),
          chat_messages!chat_messages_topic_id_fkey (
            user_id,
            created_at
          )
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
        
        // Calculate participant count from unique users who have sent messages
        const uniqueParticipants = new Set(topic.chat_messages?.map((msg: any) => msg.user_id) || []);
        // Always include the topic author
        uniqueParticipants.add(topic.user_id);
        
        // Find the latest message time
        const lastMessageTime = topic.chat_messages && topic.chat_messages.length > 0
          ? topic.chat_messages
              .map((msg: any) => msg.created_at)
              .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0]
          : undefined;
        
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
          participantCount: uniqueParticipants.size,
          lastMessageTime,
          imageUrl: topic.image_url || undefined,
          aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
          // Initialize with default values, will be updated below
          isFavorited: false,
          isLiked: false,
          likesCount: 0
        };
      });

      // Sort by distance first, then by creation time DESC
      const sortedTopics = topics.sort((a, b) => {
        const distanceDiff = (a.distance || 0) - (b.distance || 0);
        if (distanceDiff !== 0) {
          return distanceDiff;
        }
        // If distances are equal, sort by creation time DESC
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      set({ 
        topics: sortedTopics,
        filteredTopics: sortedTopics,
        mapFilteredTopics: sortedTopics,
        chatFilteredTopics: sortedTopics,
        currentPage: 1,
        hasMore: topicsData?.length === TOPICS_PER_PAGE,
        isLoading: false 
      });
      
      // Check favorite and like status for current user
      if (currentUserId && sortedTopics.length > 0) {
        const topicIds = sortedTopics.map(t => t.id);
        await get().checkFavoriteStatus(topicIds, currentUserId);
        await get().checkLikeStatus(topicIds, currentUserId);
      }
      
      // 重新应用当前的搜索状态（如果存在）
      const currentState = get();
      if (currentState.searchQuery) {
        get().searchTopics(currentState.searchQuery);
      }
      if (currentState.mapSearchQuery) {
        get().searchMapTopics(currentState.mapSearchQuery);
      }
      if (currentState.chatSearchQuery) {
        get().searchChatTopics(currentState.chatSearchQuery);
      }
      
      return sortedTopics;
    }).catch((error: any) => {
      console.error('附近话题获取失败:', error);
      const errorMessage = isNetworkError(error) 
        ? 'ネットワーク接続を確認してください' 
        : '近くのトピックの取得に失敗しました';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error;
    });
    
    // 将请求添加到队列
    set(state => ({
      requestQueue: new Map([...state.requestQueue, [requestKey, requestPromise]])
    }));
    
    try {
      await requestPromise;
    } finally {
      // 清理请求状态
      set(state => {
        const newPendingRequests = new Set(state.pendingRequests);
        newPendingRequests.delete(requestKey);
        
        const newRequestQueue = new Map(state.requestQueue);
        newRequestQueue.delete(requestKey);
        
        return {
          pendingRequests: newPendingRequests,
          requestQueue: newRequestQueue
        };
      });
    }
  },

  loadMoreTopics: async (latitude, longitude) => {
    const { isLoadingMore, hasMore, currentPage, topics, pendingRequests, requestQueue } = get();
    
    if (isLoadingMore || !hasMore) return;
    
    const requestKey = `loadMore_${latitude}_${longitude}_${currentPage}`;
    
    // 检查是否有相同的请求正在进行
    if (pendingRequests.has(requestKey)) {
      console.log('相同的loadMore请求正在进行中');
      return requestQueue.get(requestKey);
    }
    
    set({ isLoadingMore: true, error: null });
    
    // 将请求标记为进行中
    set(state => ({
      pendingRequests: new Set([...state.pendingRequests, requestKey])
    }));
    
    const requestPromise = (async () => {
    
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      const from = currentPage * TOPICS_PER_PAGE;
      const to = from + TOPICS_PER_PAGE - 1;
      
      // Fetch more topics from Supabase with comment counts and message counts
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
          comments!comments_topic_id_fkey (count),
          chat_messages!chat_messages_topic_id_fkey (
            user_id,
            created_at
          )
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
        
        // Calculate participant count from unique users who have sent messages
        const uniqueParticipants = new Set(topic.chat_messages?.map((msg: any) => msg.user_id) || []);
        // Always include the topic author
        uniqueParticipants.add(topic.user_id);
        
        // Find the latest message time
        const lastMessageTime = topic.chat_messages && topic.chat_messages.length > 0
          ? topic.chat_messages
              .map((msg: any) => msg.created_at)
              .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0]
          : undefined;
        
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
          participantCount: uniqueParticipants.size,
          lastMessageTime,
          imageUrl: topic.image_url || undefined,
          aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
          // Initialize with default values, will be updated below
          isFavorited: false,
          isLiked: false,
          likesCount: 0
        };
      });

      // Combine with existing topics, ensuring no duplicates
      const existingTopicIds = new Set(topics.map(t => t.id));
      const uniqueNewTopics = newTopics.filter(topic => !existingTopicIds.has(topic.id));
      
      const allTopics = [...topics, ...uniqueNewTopics];
      const sortedTopics = allTopics.sort((a, b) => {
        const distanceDiff = (a.distance || 0) - (b.distance || 0);
        if (distanceDiff !== 0) {
          return distanceDiff;
        }
        // If distances are equal, sort by creation time DESC
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      set({ 
        topics: sortedTopics,
        filteredTopics: sortedTopics,
        mapFilteredTopics: sortedTopics,
        chatFilteredTopics: sortedTopics,
        currentPage: currentPage + 1,
        hasMore: topicsData?.length === TOPICS_PER_PAGE,
        isLoadingMore: false 
      });
      
      // Check favorite and like status for newly loaded topics only
      if (currentUserId && uniqueNewTopics.length > 0) {
        const newTopicIds = uniqueNewTopics.map(t => t.id);
        await get().checkFavoriteStatus(newTopicIds, currentUserId);
        await get().checkLikeStatus(newTopicIds, currentUserId);
      }
      
      // 重新应用当前的搜索状态（如果存在）
      const currentState = get();
      if (currentState.searchQuery) {
        get().searchTopics(currentState.searchQuery);
      }
      if (currentState.mapSearchQuery) {
        get().searchMapTopics(currentState.mapSearchQuery);
      }
      if (currentState.chatSearchQuery) {
        get().searchChatTopics(currentState.chatSearchQuery);
      }
    } catch (error: any) {
        set({ 
          error: "さらなるトピックの取得に失敗しました", 
          isLoadingMore: false 
        });
        throw error;
      }
    })();
    
    // 将请求添加到队列
    set(state => ({
      requestQueue: new Map([...state.requestQueue, [requestKey, requestPromise]])
    }));
    
    try {
      await requestPromise;
    } finally {
      // 清理请求状态
      set(state => {
        const newPendingRequests = new Set(state.pendingRequests);
        newPendingRequests.delete(requestKey);
        
        const newRequestQueue = new Map(state.requestQueue);
        newRequestQueue.delete(requestKey);
        
        return {
          pendingRequests: newPendingRequests,
          requestQueue: newRequestQueue
        };
      });
    }
  },

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
        aspectRatio: insertedTopic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined
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
    
    // 只更新地图页面的过滤结果，不影响其他页面
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
          topics: state.topics.map(t => 
            t.id === topicId ? { ...t, isFavorited: false, favoritesCount: Math.max(0, (t.favoritesCount || 0) - 1) } : t
          ),
          filteredTopics: state.filteredTopics.map(t => 
            t.id === topicId ? { ...t, isFavorited: false, favoritesCount: Math.max(0, (t.favoritesCount || 0) - 1) } : t
          ),
          mapFilteredTopics: state.mapFilteredTopics.map(t => 
            t.id === topicId ? { ...t, isFavorited: false, favoritesCount: Math.max(0, (t.favoritesCount || 0) - 1) } : t
          ),
          chatFilteredTopics: state.chatFilteredTopics.map(t => 
            t.id === topicId ? { ...t, isFavorited: false, favoritesCount: Math.max(0, (t.favoritesCount || 0) - 1) } : t
          ),
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

        // Get the topic to add to favorites
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

        if (topicError) {
          throw topicError;
        }

        // Transform to Topic interface
        const favoriteTopicData: Topic = {
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
          isFavorited: true
        };

        // Update local state - add to favorites and update isFavorited
        set(state => ({
          favoriteTopics: [favoriteTopicData, ...state.favoriteTopics],
          topics: state.topics.map(t => 
            t.id === topicId ? { ...t, isFavorited: true, favoritesCount: (t.favoritesCount || 0) + 1 } : t
          ),
          filteredTopics: state.filteredTopics.map(t => 
            t.id === topicId ? { ...t, isFavorited: true, favoritesCount: (t.favoritesCount || 0) + 1 } : t
          ),
          mapFilteredTopics: state.mapFilteredTopics.map(t => 
            t.id === topicId ? { ...t, isFavorited: true, favoritesCount: (t.favoritesCount || 0) + 1 } : t
          ),
          chatFilteredTopics: state.chatFilteredTopics.map(t => 
            t.id === topicId ? { ...t, isFavorited: true, favoritesCount: (t.favoritesCount || 0) + 1 } : t
          ),
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
          isFavorited: true
        };
      });

      set({ 
        favoriteTopics,
        isFavoriteLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: "お気に入りの取得に失敗しました", 
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

      const targetTopicIds = new Set(topicIds);
      
      // Update topics with favorite status (only for topics we're checking)
      set(state => ({
        topics: state.topics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isFavorited: favoritedTopicIds.has(topic.id)
          } : topic
        ),
        filteredTopics: state.filteredTopics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isFavorited: favoritedTopicIds.has(topic.id)
          } : topic
        ),
        mapFilteredTopics: state.mapFilteredTopics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isFavorited: favoritedTopicIds.has(topic.id)
          } : topic
        ),
        chatFilteredTopics: state.chatFilteredTopics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isFavorited: favoritedTopicIds.has(topic.id)
          } : topic
        ),
        currentTopic: state.currentTopic && targetTopicIds.has(state.currentTopic.id) ? {
          ...state.currentTopic,
          isFavorited: favoritedTopicIds.has(state.currentTopic.id)
        } : state.currentTopic
      }));
    } catch (error: any) {
      console.error('Error checking favorite status:', error);
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
          topics: state.topics.map(t => 
            t.id === topicId ? { ...t, isLiked: false, likesCount: Math.max(0, (t.likesCount || 0) - 1) } : t
          ),
          filteredTopics: state.filteredTopics.map(t => 
            t.id === topicId ? { ...t, isLiked: false, likesCount: Math.max(0, (t.likesCount || 0) - 1) } : t
          ),
          mapFilteredTopics: state.mapFilteredTopics.map(t => 
            t.id === topicId ? { ...t, isLiked: false, likesCount: Math.max(0, (t.likesCount || 0) - 1) } : t
          ),
          chatFilteredTopics: state.chatFilteredTopics.map(t => 
            t.id === topicId ? { ...t, isLiked: false, likesCount: Math.max(0, (t.likesCount || 0) - 1) } : t
          ),
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
          topics: state.topics.map(t => 
            t.id === topicId ? { ...t, isLiked: true, likesCount: (t.likesCount || 0) + 1 } : t
          ),
          filteredTopics: state.filteredTopics.map(t => 
            t.id === topicId ? { ...t, isLiked: true, likesCount: (t.likesCount || 0) + 1 } : t
          ),
          mapFilteredTopics: state.mapFilteredTopics.map(t => 
            t.id === topicId ? { ...t, isLiked: true, likesCount: (t.likesCount || 0) + 1 } : t
          ),
          chatFilteredTopics: state.chatFilteredTopics.map(t => 
            t.id === topicId ? { ...t, isLiked: true, likesCount: (t.likesCount || 0) + 1 } : t
          ),
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

      const targetTopicIds = new Set(topicIds);
      
      // Update topics with like status and counts (only for topics we're checking)
      set(state => ({
        topics: state.topics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isLiked: likedTopicIds.has(topic.id),
            likesCount: likesCountMap.get(topic.id) ?? topic.likesCount ?? 0
          } : topic
        ),
        filteredTopics: state.filteredTopics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isLiked: likedTopicIds.has(topic.id),
            likesCount: likesCountMap.get(topic.id) ?? topic.likesCount ?? 0
          } : topic
        ),
        mapFilteredTopics: state.mapFilteredTopics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isLiked: likedTopicIds.has(topic.id),
            likesCount: likesCountMap.get(topic.id) ?? topic.likesCount ?? 0
          } : topic
        ),
        chatFilteredTopics: state.chatFilteredTopics.map(topic => 
          targetTopicIds.has(topic.id) ? {
            ...topic,
            isLiked: likedTopicIds.has(topic.id),
            likesCount: likesCountMap.get(topic.id) ?? topic.likesCount ?? 0
          } : topic
        ),
        currentTopic: state.currentTopic && targetTopicIds.has(state.currentTopic.id) ? {
          ...state.currentTopic,
          isLiked: likedTopicIds.has(state.currentTopic.id),
          likesCount: likesCountMap.get(state.currentTopic.id) ?? state.currentTopic.likesCount ?? 0
        } : state.currentTopic
      }));
    } catch (error: any) {
      console.error('Error checking like status:', error);
    }
  },

  ensureMinimumTopicsForMap: async (latitude, longitude) => {
    const { topics, isLoading, isLoadingMore, pendingRequests, requestQueue, lastRequestTime } = get();
    
    // 如果已经在加载中，则跳过
    if (isLoading || isLoadingMore) return;
    
    // 如果当前话题数量已经足够，则跳过
    if (topics.length >= MINIMUM_MAP_TOPICS) return;
    
    const requestKey = `ensureMinimum_${latitude}_${longitude}`;
    const now = Date.now();
    
    // 防止频繁调用（5秒内最多一次）
    if (now - lastRequestTime < 5000) {
      console.log('ensureMinimumTopicsForMap: 请求过于频繁，已忽略');
      return;
    }
    
    // 检查是否有相同的请求正在进行
    if (pendingRequests.has(requestKey)) {
      console.log('ensureMinimumTopicsForMap: 相同请求正在进行中');
      return requestQueue.get(requestKey);
    }
    
    // 将请求标记为进行中
    set(state => ({
      pendingRequests: new Set([...state.pendingRequests, requestKey]),
      lastRequestTime: now
    }));
    
    const requestPromise = (async () => {
    
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Calculate how many more topics we need
      const needed = MINIMUM_MAP_TOPICS - topics.length;
      const batchesToLoad = Math.ceil(needed / TOPICS_PER_PAGE);
      
      set({ isLoadingMore: true });
      
      for (let i = 0; i < batchesToLoad && get().topics.length < MINIMUM_MAP_TOPICS; i++) {
        const currentState = get();
        const from = currentState.topics.length;
        const to = from + TOPICS_PER_PAGE - 1;
        
        // Fetch more topics from Supabase
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
            comments!comments_topic_id_fkey (count),
            chat_messages!chat_messages_topic_id_fkey (
              user_id,
              created_at
            )
          `)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (topicsError) {
          throw topicsError;
        }

        if (!topicsData || topicsData.length === 0) {
          // No more topics to load
          break;
        }

        // Transform data to match our Topic interface
        const newTopics: Topic[] = topicsData.map(topic => {
          const distance = calculateDistance(
            latitude, 
            longitude, 
            topic.latitude, 
            topic.longitude
          );
          
          // Calculate participant count from unique users who have sent messages
          const uniqueParticipants = new Set(topic.chat_messages?.map((msg: any) => msg.user_id) || []);
          // Always include the topic author
          uniqueParticipants.add(topic.user_id);
          
          // Find the latest message time
          const lastMessageTime = topic.chat_messages && topic.chat_messages.length > 0
            ? topic.chat_messages
                .map((msg: any) => msg.created_at)
                .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0]
            : undefined;
          
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
            participantCount: uniqueParticipants.size,
            lastMessageTime,
            imageUrl: topic.image_url || undefined,
            aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
            // Initialize with default values, will be updated below
            isFavorited: false,
            isLiked: false,
            likesCount: 0
          };
        });

        // Combine with existing topics, ensuring no duplicates
        const currentTopics = get().topics;
        const existingTopicIds = new Set(currentTopics.map(t => t.id));
        const uniqueNewTopics = newTopics.filter(topic => !existingTopicIds.has(topic.id));
        
        // Only proceed if we have new unique topics
        if (uniqueNewTopics.length === 0) {
          break;
        }
        
        const allTopics = [...currentTopics, ...uniqueNewTopics];
        const sortedTopics = allTopics.sort((a, b) => {
          const distanceDiff = (a.distance || 0) - (b.distance || 0);
          if (distanceDiff !== 0) {
            return distanceDiff;
          }
          // If distances are equal, sort by creation time DESC
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        set({ 
          topics: sortedTopics,
          filteredTopics: sortedTopics,
          mapFilteredTopics: sortedTopics,
          chatFilteredTopics: sortedTopics,
        });

        // Check favorite and like status for newly loaded topics only
        if (currentUserId && uniqueNewTopics.length > 0) {
          const newTopicIds = uniqueNewTopics.map(t => t.id);
          await get().checkFavoriteStatus(newTopicIds, currentUserId);
          await get().checkLikeStatus(newTopicIds, currentUserId);
        }

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
      }
    } catch (error: any) {
        console.error('Error ensuring minimum topics for map:', error);
        throw error;
      } finally {
        set({ isLoadingMore: false });
      }
    })();
    
    // 将请求添加到队列
    set(state => ({
      requestQueue: new Map([...state.requestQueue, [requestKey, requestPromise]])
    }));
    
    try {
      await requestPromise;
    } finally {
      // 清理请求状态
      set(state => {
        const newPendingRequests = new Set(state.pendingRequests);
        newPendingRequests.delete(requestKey);
        
        const newRequestQueue = new Map(state.requestQueue);
        newRequestQueue.delete(requestKey);
        
        return {
          pendingRequests: newPendingRequests,
          requestQueue: newRequestQueue
        };
      });
    }
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