import { supabase } from '@/lib/supabase';
import { Topic } from '@/types';

// Geographic query utilities for location-based topic fetching
export interface GeoQueryParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  cursor?: string; // For cursor-based pagination
  sortBy?: 'distance' | 'activity' | 'time';
}

export interface QueryResult {
  topics: Topic[];
  nextCursor?: string;
  hasMore: boolean;
  totalInRadius?: number;
}

// Default radius for nearby searches (5km)
const DEFAULT_RADIUS_KM = 5;

/**
 * Fetch nearby topics using PostGIS geographic queries
 * Optimized for home page - sorts by distance first, then time
 */
export async function fetchNearbyTopics(params: GeoQueryParams): Promise<QueryResult> {
  const { 
    latitude, 
    longitude, 
    radiusKm = DEFAULT_RADIUS_KM, 
    limit = 10,
    cursor 
  } = params;

  try {
    // Build the query with geographic distance calculation
    let query = supabase
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
      // Use PostGIS to filter by distance (radius in meters)
      .gte('latitude', latitude - (radiusKm / 111.0)) // Rough lat degree approximation
      .lte('latitude', latitude + (radiusKm / 111.0))
      .gte('longitude', longitude - (radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180))))
      .lte('longitude', longitude + (radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180))));

    // Add cursor-based pagination
    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    // Execute query with limit
    const { data: topicsData, error: topicsError } = await query
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more

    if (topicsError) {
      throw topicsError;
    }

    // Transform and calculate exact distances
    const topics: Topic[] = (topicsData || []).slice(0, limit).map(topic => {
      const distance = calculateDistance(
        latitude, 
        longitude, 
        topic.latitude, 
        topic.longitude
      );
      
      // Calculate participant count
      const uniqueParticipants = new Set(topic.chat_messages?.map((msg: any) => msg.user_id) || []);
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
        isFavorited: false,
        isLiked: false,
        likesCount: 0
      };
    });

    // Sort by distance first, then by creation time
    const sortedTopics = topics.sort((a, b) => {
      const distanceDiff = (a.distance || 0) - (b.distance || 0);
      if (distanceDiff !== 0) {
        return distanceDiff;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Determine next cursor and hasMore
    const hasMore = topicsData ? topicsData.length > limit : false;
    const nextCursor = hasMore && sortedTopics.length > 0 
      ? sortedTopics[sortedTopics.length - 1].createdAt 
      : undefined;

    return {
      topics: sortedTopics,
      nextCursor,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching nearby topics:', error);
    throw error;
  }
}

/**
 * Fetch topics for map view with activity-based sorting
 * Optimized for map page - sorts by activity (engagement) first
 */
export async function fetchMapTopics(params: GeoQueryParams): Promise<QueryResult> {
  const { 
    latitude, 
    longitude, 
    radiusKm = DEFAULT_RADIUS_KM * 2, // Larger radius for map view
    limit = 30, // More topics for map
    cursor 
  } = params;

  try {
    // Build query with activity calculation
    let query = supabase
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
      // Geographic filtering
      .gte('latitude', latitude - (radiusKm / 111.0))
      .lte('latitude', latitude + (radiusKm / 111.0))
      .gte('longitude', longitude - (radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180))))
      .lte('longitude', longitude + (radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180))));

    // Add cursor-based pagination
    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    const { data: topicsData, error: topicsError } = await query
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (topicsError) {
      throw topicsError;
    }

    // Transform and calculate activity scores
    const topics: Topic[] = (topicsData || []).slice(0, limit).map(topic => {
      const distance = calculateDistance(
        latitude, 
        longitude, 
        topic.latitude, 
        topic.longitude
      );
      
      // Calculate participant count and activity score
      const uniqueParticipants = new Set(topic.chat_messages?.map((msg: any) => msg.user_id) || []);
      uniqueParticipants.add(topic.user_id);
      
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
        isFavorited: false,
        isLiked: false,
        likesCount: 0
      };
    });

    // Sort by activity score (participant count + comment count)
    const sortedTopics = topics.sort((a, b) => {
      const scoreA = a.participantCount + a.commentCount;
      const scoreB = b.participantCount + b.commentCount;
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher activity first
      }
      // If same activity, sort by recency
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const hasMore = topicsData ? topicsData.length > limit : false;
    const nextCursor = hasMore && sortedTopics.length > 0 
      ? sortedTopics[sortedTopics.length - 1].createdAt 
      : undefined;

    return {
      topics: sortedTopics,
      nextCursor,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching map topics:', error);
    throw error;
  }
}

/**
 * Fetch topics user has participated in (for chat page)
 * Optimized for chat page - shows participated topics first
 */
export async function fetchParticipatedTopics(userId: string, params: Omit<GeoQueryParams, 'latitude' | 'longitude'> = {}): Promise<QueryResult> {
  const { limit = 20, cursor } = params;

  try {
    // First, get topics user has participated in
    const { data: participatedData, error: participatedError } = await supabase
      .from('chat_messages')
      .select('topic_id, MAX(created_at) as last_message_time')
      .eq('user_id', userId)
      .group('topic_id');

    if (participatedError) {
      throw participatedError;
    }

    const participatedTopicIds = new Set(participatedData?.map(d => d.topic_id) || []);
    const lastMessageTimes = new Map(participatedData?.map(d => [d.topic_id, d.last_message_time]) || []);

    // Get topics user created
    const { data: createdTopicsData, error: createdError } = await supabase
      .from('topics')
      .select('id')
      .eq('user_id', userId);

    if (createdError) {
      throw createdError;
    }

    createdTopicsData?.forEach(topic => participatedTopicIds.add(topic.id));

    // Build main query for all topics
    let query = supabase
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
          created_at,
          message
        )
      `);

    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    const { data: topicsData, error: topicsError } = await query
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (topicsError) {
      throw topicsError;
    }

    // Transform topics with participation info
    const topics: Topic[] = (topicsData || []).slice(0, limit).map(topic => {
      const uniqueParticipants = new Set(topic.chat_messages?.map((msg: any) => msg.user_id) || []);
      uniqueParticipants.add(topic.user_id);
      
      const lastMessageTime = topic.chat_messages && topic.chat_messages.length > 0
        ? topic.chat_messages
            .map((msg: any) => msg.created_at)
            .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0]
        : undefined;
      
      const lastMessage = topic.chat_messages && topic.chat_messages.length > 0
        ? topic.chat_messages
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;
      
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
        participantCount: uniqueParticipants.size,
        lastMessageTime,
        imageUrl: topic.image_url || undefined,
        aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
        isFavorited: false,
        isLiked: false,
        likesCount: 0,
        // Chat-specific fields
        isParticipated: participatedTopicIds.has(topic.id),
        lastMessagePreview: lastMessage?.message
      };
    });

    // Sort by participation status first, then by last message time
    const sortedTopics = topics.sort((a, b) => {
      // Participated topics first
      if (a.isParticipated && !b.isParticipated) return -1;
      if (!a.isParticipated && b.isParticipated) return 1;
      
      // For participated topics, sort by last message time
      if (a.isParticipated && b.isParticipated) {
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        }
        if (a.lastMessageTime) return -1;
        if (b.lastMessageTime) return 1;
      }
      
      // For non-participated topics, sort by creation time
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const hasMore = topicsData ? topicsData.length > limit : false;
    const nextCursor = hasMore && sortedTopics.length > 0 
      ? sortedTopics[sortedTopics.length - 1].createdAt 
      : undefined;

    return {
      topics: sortedTopics,
      nextCursor,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching participated topics:', error);
    throw error;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

/**
 * Get topics within a bounding box (for map viewport)
 */
export async function fetchTopicsInBounds(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}, limit = 50): Promise<QueryResult> {
  try {
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
      .gte('latitude', bounds.south)
      .lte('latitude', bounds.north)
      .gte('longitude', bounds.west)
      .lte('longitude', bounds.east)
      .limit(limit);

    if (topicsError) {
      throw topicsError;
    }

    const topics: Topic[] = (topicsData || []).map(topic => {
      const uniqueParticipants = new Set(topic.chat_messages?.map((msg: any) => msg.user_id) || []);
      uniqueParticipants.add(topic.user_id);
      
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
        commentCount: topic.comments?.[0]?.count || 0,
        participantCount: uniqueParticipants.size,
        lastMessageTime,
        imageUrl: topic.image_url || undefined,
        aspectRatio: topic.image_aspect_ratio as '1:1' | '4:5' | '1.91:1' | undefined,
        isFavorited: false,
        isLiked: false,
        likesCount: 0
      };
    });

    return {
      topics,
      hasMore: topics.length === limit
    };
  } catch (error) {
    console.error('Error fetching topics in bounds:', error);
    throw error;
  }
}