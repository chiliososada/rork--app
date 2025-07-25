import { supabase } from '@/lib/supabase';
import { Topic } from '@/types';
import { TimeRange } from '@/store/search-settings-store';

// Geographic query utilities for location-based topic fetching
export interface GeoQueryParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  cursor?: string; // For cursor-based pagination
  sortBy?: 'distance' | 'activity' | 'time';
  timeRange?: TimeRange; // Time filter
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
 * Get the start date for time range filtering
 */
function getTimeRangeStartDate(timeRange: TimeRange): Date | null {
  const now = new Date();
  
  switch (timeRange) {
    case 'today':
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return today;
    case 'week':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return weekAgo;
    case 'month':
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return monthAgo;
    case 'all':
      return null; // No time filtering
    default:
      return null;
  }
}

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
    cursor,
    timeRange = 'all'
  } = params;


  try {
    // Calculate geographic bounds
    const latBounds = {
      min: latitude - (radiusKm / 111.0),
      max: latitude + (radiusKm / 111.0)
    };
    const lonBounds = {
      min: longitude - (radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180))),
      max: longitude + (radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180)))
    };
    

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
      .gte('latitude', latBounds.min)
      .lte('latitude', latBounds.max)
      .gte('longitude', lonBounds.min)
      .lte('longitude', lonBounds.max);

    // Add time range filtering
    const timeFilterStart = getTimeRangeStartDate(timeRange);
    if (timeFilterStart) {
      query = query.gte('created_at', timeFilterStart.toISOString());
    }

    // Use offset-based pagination instead of cursor for reliability
    let offset = 0;
    if (cursor) {
      // Parse offset from cursor
      offset = parseInt(cursor) || 0;
    }

    // Execute query with limit and offset
    const { data: topicsData, error: topicsError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1); // Use range for offset-based pagination

    if (topicsError) {
      throw topicsError;
    }


    // Transform and calculate exact distances
    const topics: Topic[] = (topicsData || []).map(topic => {
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
        originalWidth: topic.original_width || undefined,
        originalHeight: topic.original_height || undefined,
        tags: (() => {
          try {
            if (!topic.tags) return undefined;
            
            // Handle already parsed arrays (JSONB from database)
            if (Array.isArray(topic.tags)) {
              return topic.tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
            }
            
            // Handle string format (shouldn't happen with JSONB but safeguard)
            if (typeof topic.tags === 'string') {
              const tagsStr = topic.tags.trim();
              if (!tagsStr) return undefined;
              
              const parsed = JSON.parse(tagsStr);
              if (Array.isArray(parsed)) {
                return parsed.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
              }
            }
            
            return undefined;
          } catch (parseError: any) {
            console.warn('[GeoQueries] Error parsing tags for topic', topic.id, ':', parseError.message, 'Raw tags:', topic.tags);
            return undefined;
          }
        })(),
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

    // Determine next cursor and hasMore for offset-based pagination
    const hasMore = topicsData ? topicsData.length === limit : false;
    const nextCursor = hasMore ? (offset + limit).toString() : undefined;

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
    cursor,
    timeRange = 'all'
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

    // Add time range filtering
    const timeFilterStart = getTimeRangeStartDate(timeRange);
    if (timeFilterStart) {
      query = query.gte('created_at', timeFilterStart.toISOString());
    }

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
        originalWidth: topic.original_width || undefined,
        originalHeight: topic.original_height || undefined,
        tags: (() => {
          try {
            if (!topic.tags) return undefined;
            
            // Handle already parsed arrays (JSONB from database)
            if (Array.isArray(topic.tags)) {
              return topic.tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
            }
            
            // Handle string format (shouldn't happen with JSONB but safeguard)
            if (typeof topic.tags === 'string') {
              const tagsStr = topic.tags.trim();
              if (!tagsStr) return undefined;
              
              const parsed = JSON.parse(tagsStr);
              if (Array.isArray(parsed)) {
                return parsed.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
              }
            }
            
            return undefined;
          } catch (parseError: any) {
            console.warn('[GeoQueries] Error parsing tags for topic', topic.id, ':', parseError.message, 'Raw tags:', topic.tags);
            return undefined;
          }
        })(),
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
      .select('topic_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (participatedError) {
      throw participatedError;
    }

    const participatedTopicIds = new Set(participatedData?.map((d: any) => d.topic_id) || []);
    const lastMessageTimes = new Map(participatedData?.map((d: any) => [d.topic_id, d.created_at]) || []);

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
        originalWidth: topic.original_width || undefined,
        originalHeight: topic.original_height || undefined,
        tags: (() => {
          try {
            if (!topic.tags) return undefined;
            
            // Handle already parsed arrays (JSONB from database)
            if (Array.isArray(topic.tags)) {
              return topic.tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
            }
            
            // Handle string format (shouldn't happen with JSONB but safeguard)
            if (typeof topic.tags === 'string') {
              const tagsStr = topic.tags.trim();
              if (!tagsStr) return undefined;
              
              const parsed = JSON.parse(tagsStr);
              if (Array.isArray(parsed)) {
                return parsed.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
              }
            }
            
            return undefined;
          } catch (parseError: any) {
            console.warn('[GeoQueries] Error parsing tags for topic', topic.id, ':', parseError.message, 'Raw tags:', topic.tags);
            return undefined;
          }
        })(),
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
 * Search for topics by text query with geographic and time filtering
 * Optimized for search functionality - includes full-text search across multiple fields
 */
export async function searchNearbyTopics(params: GeoQueryParams & { searchQuery: string }): Promise<QueryResult> {
  const { 
    latitude, 
    longitude, 
    radiusKm = DEFAULT_RADIUS_KM, 
    limit = 20,
    cursor,
    timeRange = 'all',
    searchQuery
  } = params;

  // Return empty results if no search query
  if (!searchQuery.trim()) {
    return {
      topics: [],
      hasMore: false
    };
  }

  try {
    const normalizedQuery = searchQuery.toLowerCase().trim();
    
    // Build the query with geographic distance calculation and text search
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

    // Add time range filtering
    const timeFilterStart = getTimeRangeStartDate(timeRange);
    if (timeFilterStart) {
      query = query.gte('created_at', timeFilterStart.toISOString());
    }

    // Add text search using multiple filter conditions
    // Apply search filter to each field separately using OR logic
    query = query.or(`title.ilike.*${normalizedQuery}*,description.ilike.*${normalizedQuery}*,location_name.ilike.*${normalizedQuery}*`);

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
        originalWidth: topic.original_width || undefined,
        originalHeight: topic.original_height || undefined,
        tags: (() => {
          try {
            if (!topic.tags) return undefined;
            
            // Handle already parsed arrays (JSONB from database)
            if (Array.isArray(topic.tags)) {
              return topic.tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
            }
            
            // Handle string format (shouldn't happen with JSONB but safeguard)
            if (typeof topic.tags === 'string') {
              const tagsStr = topic.tags.trim();
              if (!tagsStr) return undefined;
              
              const parsed = JSON.parse(tagsStr);
              if (Array.isArray(parsed)) {
                return parsed.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
              }
            }
            
            return undefined;
          } catch (parseError: any) {
            console.warn('[GeoQueries] Error parsing tags for topic', topic.id, ':', parseError.message, 'Raw tags:', topic.tags);
            return undefined;
          }
        })(),
        isFavorited: false,
        isLiked: false,
        likesCount: 0
      };
    });

    // Sort by relevance (distance + recency)
    const sortedTopics = topics.sort((a, b) => {
      // First sort by distance (closer is better)
      const distanceDiff = (a.distance || 0) - (b.distance || 0);
      if (Math.abs(distanceDiff) > 500) { // 500m threshold
        return distanceDiff;
      }
      // If distances are similar, sort by recency
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
    console.error('Error searching nearby topics:', error);
    throw error;
  }
}

/**
 * Search for topics specifically for map view with geographic and time filtering
 * Optimized for map display - larger radius, activity-based sorting
 */
export async function searchMapTopics(params: GeoQueryParams & { searchQuery: string }): Promise<QueryResult> {
  const { 
    latitude, 
    longitude, 
    radiusKm = DEFAULT_RADIUS_KM * 2, // Larger radius for map view
    limit = 30, // More topics for map
    cursor,
    timeRange = 'all',
    searchQuery
  } = params;

  // Return empty results if no search query
  if (!searchQuery.trim()) {
    return {
      topics: [],
      hasMore: false
    };
  }

  try {
    const normalizedQuery = searchQuery.toLowerCase().trim();
    
    // Build the query with geographic distance calculation and text search
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
      // Geographic filtering (larger radius for map)
      .gte('latitude', latitude - (radiusKm / 111.0))
      .lte('latitude', latitude + (radiusKm / 111.0))
      .gte('longitude', longitude - (radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180))))
      .lte('longitude', longitude + (radiusKm / (111.0 * Math.cos(latitude * Math.PI / 180))));

    // Add time range filtering
    const timeFilterStart = getTimeRangeStartDate(timeRange);
    if (timeFilterStart) {
      query = query.gte('created_at', timeFilterStart.toISOString());
    }

    // Add text search using multiple filter conditions  
    query = query.or(`title.ilike.*${normalizedQuery}*,description.ilike.*${normalizedQuery}*,location_name.ilike.*${normalizedQuery}*`);

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

    // Transform and calculate activity scores for map view
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
        originalWidth: topic.original_width || undefined,
        originalHeight: topic.original_height || undefined,
        tags: (() => {
          try {
            if (!topic.tags) return undefined;
            
            // Handle already parsed arrays (JSONB from database)
            if (Array.isArray(topic.tags)) {
              return topic.tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
            }
            
            // Handle string format (shouldn't happen with JSONB but safeguard)
            if (typeof topic.tags === 'string') {
              const tagsStr = topic.tags.trim();
              if (!tagsStr) return undefined;
              
              const parsed = JSON.parse(tagsStr);
              if (Array.isArray(parsed)) {
                return parsed.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
              }
            }
            
            return undefined;
          } catch (parseError: any) {
            console.warn('[GeoQueries] Error parsing tags for topic', topic.id, ':', parseError.message, 'Raw tags:', topic.tags);
            return undefined;
          }
        })(),
        isFavorited: false,
        isLiked: false,
        likesCount: 0
      };
    });

    // Sort by activity score (participant count + comment count) for map display
    const sortedTopics = topics.sort((a, b) => {
      const scoreA = a.participantCount + a.commentCount;
      const scoreB = b.participantCount + b.commentCount;
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher activity first
      }
      // If same activity, sort by proximity
      return (a.distance || 0) - (b.distance || 0);
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
    console.error('Error searching map topics:', error);
    throw error;
  }
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
        originalWidth: topic.original_width || undefined,
        originalHeight: topic.original_height || undefined,
        tags: (() => {
          try {
            if (!topic.tags) return undefined;
            
            // Handle already parsed arrays (JSONB from database)
            if (Array.isArray(topic.tags)) {
              return topic.tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
            }
            
            // Handle string format (shouldn't happen with JSONB but safeguard)
            if (typeof topic.tags === 'string') {
              const tagsStr = topic.tags.trim();
              if (!tagsStr) return undefined;
              
              const parsed = JSON.parse(tagsStr);
              if (Array.isArray(parsed)) {
                return parsed.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0);
              }
            }
            
            return undefined;
          } catch (parseError: any) {
            console.warn('[GeoQueries] Error parsing tags for topic', topic.id, ':', parseError.message, 'Raw tags:', topic.tags);
            return undefined;
          }
        })(),
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