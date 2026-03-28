import { useEffect, useState } from 'react';
import { useBlockingStore } from '@/store/blocking-store';
import { useAuthStore } from '@/store/auth-store';

// Generic interface for content that can be filtered
interface FilterableContent {
  id: string;
  user_id?: string;
  author?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface ContentFilterResult<T> {
  filteredContent: T[];
  blockedCount: number;
  isLoading: boolean;
}

/**
 * Custom hook for filtering content based on blocked users
 * @param content - Array of content items to filter
 * @param enabled - Whether filtering is enabled (default: true)
 * @returns Filtered content, blocked count, and loading state
 */
export function useContentFilter<T extends FilterableContent>(
  content: T[],
  enabled: boolean = true
): ContentFilterResult<T> {
  const { user } = useAuthStore();
  const { blockedUserIds, isUserBlockedSync, loadBlockedUsers, isLoading } = useBlockingStore();
  const [hasLoadedBlocked, setHasLoadedBlocked] = useState(false);

  // Load blocked users when component mounts and user is authenticated
  useEffect(() => {
    if (user?.id && enabled && !hasLoadedBlocked) {
      loadBlockedUsers(user.id).then(() => {
        setHasLoadedBlocked(true);
      });
    }
  }, [user?.id, enabled, hasLoadedBlocked]);

  // Filter content based on blocked users
  const filteredContent = enabled && user ? content.filter(item => {
    const authorId = item.user_id || item.author?.id;
    if (!authorId) return true;
    
    // Don't filter out current user's content
    if (authorId === user.id) return true;
    
    // Filter out blocked users' content
    return !isUserBlockedSync(authorId);
  }) : content;

  const blockedCount = content.length - filteredContent.length;

  return {
    filteredContent,
    blockedCount,
    isLoading: !hasLoadedBlocked && isLoading
  };
}

/**
 * Hook specifically for filtering topics
 */
export function useTopicFilter(topics: any[], enabled: boolean = true) {
  return useContentFilter(topics, enabled);
}

/**
 * Hook specifically for filtering comments
 */
export function useCommentFilter(comments: any[], enabled: boolean = true) {
  return useContentFilter(comments, enabled);
}

/**
 * Hook for checking if a specific user is blocked
 */
export function useUserBlockStatus(userId: string) {
  const { user } = useAuthStore();
  const { isUserBlockedSync, loadBlockedUsers } = useBlockingStore();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (user?.id && userId && userId !== user.id && !isLoaded) {
      loadBlockedUsers(user.id).then(() => {
        setIsLoaded(true);
      });
    }
  }, [user?.id, userId, isLoaded]);

  if (!user || !userId || userId === user.id) {
    return { isBlocked: false, isLoaded: true };
  }

  return {
    isBlocked: isUserBlockedSync(userId),
    isLoaded
  };
}

/**
 * Hook for getting filtered content with additional metadata
 */
export function useFilteredContentWithStats<T extends FilterableContent>(
  content: T[],
  enabled: boolean = true
) {
  const result = useContentFilter(content, enabled);
  
  return {
    ...result,
    totalCount: content.length,
    visibleCount: result.filteredContent.length,
    filteringEnabled: enabled,
    hasBlockedContent: result.blockedCount > 0
  };
}