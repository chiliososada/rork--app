import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// Types
interface BlockedUser {
  blocked_user_id: string;
  blocked_user_name: string;
  blocked_user_avatar: string | null;
  reason: string | null;
  is_mutual: boolean;
  blocked_at: string;
}

interface BlockStatus {
  is_blocked_by_user1: boolean;
  is_blocked_by_user2: boolean;
  is_any_blocked: boolean;
}

interface BlockingStore {
  // State
  blockedUsers: BlockedUser[];
  blockedUserIds: Set<string>;
  isLoading: boolean;
  lastUpdated: number;
  
  // Block status cache
  blockStatusCache: Map<string, BlockStatus>;
  
  // Loading state tracking
  currentLoadingUserId: string | null;
  loadingPromise: Promise<void> | null;
  
  // Actions
  loadBlockedUsers: (userId: string) => Promise<void>;
  blockUser: (blockedUserId: string, reason?: string) => Promise<boolean>;
  unblockUser: (blockedUserId: string) => Promise<boolean>;
  isUserBlocked: (userId1: string, userId2: string) => Promise<BlockStatus>;
  isUserBlockedSync: (userId: string) => boolean;
  clearBlockStatusCache: () => void;
  refreshBlockedUsers: (userId: string) => Promise<void>;
  
  // Content filtering
  filterBlockedUsers: <T extends { user_id?: string; id?: string }>(items: T[]) => T[];
}

export const useBlockingStore = create<BlockingStore>((set, get) => ({
  // Initial state
  blockedUsers: [],
  blockedUserIds: new Set(),
  isLoading: false,
  lastUpdated: 0,
  blockStatusCache: new Map(),
  currentLoadingUserId: null,
  loadingPromise: null,

  // Load blocked users for current user
  loadBlockedUsers: async (userId: string) => {
    const { currentLoadingUserId, loadingPromise } = get();
    
    // 如果已经在为同一用户加载，返回现有的Promise
    if (currentLoadingUserId === userId && loadingPromise) {
      return loadingPromise;
    }
    
    const promise = (async () => {
      try {
        set({ 
          isLoading: true,
          currentLoadingUserId: userId 
        });
        
        // Add timeout to prevent hanging with proper cleanup
        let timeoutId: Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Request timeout')), 10000);
        });
        
        const supabasePromise = supabase
          .rpc('get_blocked_users', { user_id_param: userId });
        
        let result;
        try {
          result = await Promise.race([supabasePromise, timeoutPromise]);
        } finally {
          // Always clear timeout to prevent memory leaks
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
        
        const { data, error } = result as { data: BlockedUser[] | null; error: any };

        if (error) {
          console.error('Error loading blocked users:', error);
          throw error;
        }

        const blockedUsers = data || [];
        const blockedUserIds = new Set<string>(blockedUsers.map((user: BlockedUser) => user.blocked_user_id));

        set({
          blockedUsers,
          blockedUserIds,
          lastUpdated: Date.now(),
          isLoading: false,
          currentLoadingUserId: null,
          loadingPromise: null,
        });
      } catch (error) {
        console.error('Failed to load blocked users:', error);
        set({ 
          isLoading: false,
          currentLoadingUserId: null,
          loadingPromise: null,
        });
        throw error;
      }
    })();
    
    // 存储Promise以避免重复请求
    set({ loadingPromise: promise });
    
    return promise;
  },

  // Block a user
  blockUser: async (blockedUserId: string, reason?: string) => {
    try {
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      if (!currentUserId) {
        console.error('User not authenticated');
        return false;
      }

      const { data, error } = await supabase
        .rpc('toggle_block_with_reason', {
          blocker_id_param: currentUserId,
          blocked_id_param: blockedUserId,
          reason_param: reason || null
        });

      if (error) {
        console.error('Error blocking user:', error);
        return false;
      }

      const result = data?.[0];
      if (result?.action === 'blocked') {
        // Add to local state
        const { blockedUserIds, blockStatusCache } = get();
        const newBlockedUserIds = new Set(blockedUserIds);
        newBlockedUserIds.add(blockedUserId);
        
        // Update cache
        const newCache = new Map(blockStatusCache);
        const cacheKey = [currentUserId, blockedUserId].sort().join('-');
        newCache.set(cacheKey, {
          is_blocked_by_user1: currentUserId < blockedUserId,
          is_blocked_by_user2: currentUserId > blockedUserId,
          is_any_blocked: true
        });

        set({ 
          blockedUserIds: newBlockedUserIds,
          blockStatusCache: newCache
        });

        // No need to refresh full list since we just blocked a user
        // The full list will be updated next time it's loaded
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error in blockUser:', error);
      return false;
    }
  },

  // Unblock a user
  unblockUser: async (blockedUserId: string) => {
    try {
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      if (!currentUserId) {
        console.error('User not authenticated');
        return false;
      }

      const { data, error } = await supabase
        .rpc('toggle_block_with_reason', {
          blocker_id_param: currentUserId,
          blocked_id_param: blockedUserId
        });

      if (error) {
        console.error('Error unblocking user:', error);
        return false;
      }

      const result = data?.[0];
      if (result?.action === 'unblocked') {
        // Remove from local state
        const { blockedUserIds, blockedUsers, blockStatusCache } = get();
        const newBlockedUserIds = new Set(blockedUserIds);
        newBlockedUserIds.delete(blockedUserId);
        
        const newBlockedUsers = blockedUsers.filter(
          user => user.blocked_user_id !== blockedUserId
        );

        // Update cache
        const newCache = new Map(blockStatusCache);
        const cacheKey = [currentUserId, blockedUserId].sort().join('-');
        newCache.delete(cacheKey);

        set({ 
          blockedUserIds: newBlockedUserIds,
          blockedUsers: newBlockedUsers,
          blockStatusCache: newCache
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error in unblockUser:', error);
      return false;
    }
  },

  // Check if user is blocked (with caching)
  isUserBlocked: async (userId1: string, userId2: string): Promise<BlockStatus> => {
    const { blockStatusCache } = get();
    const cacheKey = [userId1, userId2].sort().join('-');
    
    // Check cache first
    const cached = blockStatusCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .rpc('is_user_blocked', {
          user1_id: userId1,
          user2_id: userId2
        });

      if (error) {
        console.error('Error checking block status:', error);
        return { is_blocked_by_user1: false, is_blocked_by_user2: false, is_any_blocked: false };
      }

      const result = data?.[0] || { is_blocked_by_user1: false, is_blocked_by_user2: false, is_any_blocked: false };
      
      // Cache the result
      const newCache = new Map(blockStatusCache);
      newCache.set(cacheKey, result);
      set({ blockStatusCache: newCache });

      return result;
    } catch (error) {
      console.error('Error in isUserBlocked:', error);
      return { is_blocked_by_user1: false, is_blocked_by_user2: false, is_any_blocked: false };
    }
  },

  // Synchronous check using local state
  isUserBlockedSync: (userId: string): boolean => {
    const { blockedUserIds } = get();
    return blockedUserIds.has(userId);
  },

  // Clear cache
  clearBlockStatusCache: () => {
    set({ blockStatusCache: new Map() });
  },

  // Refresh blocked users (force reload)
  refreshBlockedUsers: async (userId: string) => {
    // Clear the existing promise and force a fresh load
    set({ 
      loadingPromise: null,
      currentLoadingUserId: null,
      lastUpdated: 0 // Reset timestamp to force reload
    });
    await get().loadBlockedUsers(userId);
  },

  // Filter out blocked users from content
  filterBlockedUsers: <T extends { user_id?: string; id?: string }>(items: T[]): T[] => {
    const { blockedUserIds } = get();
    return items.filter(item => {
      const userId = item.user_id || item.id;
      return userId ? !blockedUserIds.has(userId) : true;
    });
  },
}));

// Helper hook for easier usage
export const useUserBlocking = () => {
  const store = useBlockingStore();
  
  return {
    ...store,
    // Convenience methods
    blockUserWithConfirmation: async (userId: string, userName: string, reason?: string) => {
      try {
        return await store.blockUser(userId, reason);
      } catch (error) {
        console.error('Error blocking user:', error);
        return false;
      }
    },
    
    unblockUserWithConfirmation: async (userId: string, userName: string) => {
      try {
        return await store.unblockUser(userId);
      } catch (error) {
        console.error('Error unblocking user:', error);
        return false;
      }
    },
  };
};