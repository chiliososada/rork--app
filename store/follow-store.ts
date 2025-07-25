import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { FollowStats, FollowStatus, User } from '@/types';

interface FollowState {
  // フォロー統計情報のキャッシュ
  followStats: Map<string, FollowStats>;
  
  // フォロー状態のキャッシュ
  followStatus: Map<string, FollowStatus>;
  
  // フォロワーリスト
  followers: Map<string, User[]>;
  
  // フォロー中リスト
  following: Map<string, User[]>;
  
  // ローディング状態
  isLoadingFollowStats: boolean;
  isLoadingFollowStatus: boolean;
  isTogglingFollow: boolean;
  
  // アクション
  fetchFollowStats: (userIds: string[]) => Promise<void>;
  fetchFollowStatus: (currentUserId: string, targetUserIds: string[]) => Promise<void>;
  toggleFollow: (currentUserId: string, targetUserId: string) => Promise<boolean>;
  fetchFollowers: (userId: string, limit?: number, offset?: number) => Promise<User[]>;
  fetchFollowing: (userId: string, limit?: number, offset?: number) => Promise<User[]>;
  
  // キャッシュクリア
  clearCache: () => void;
  
  // 単一ユーザーのフォロー統計を更新
  updateUserFollowStats: (userId: string, stats: Partial<FollowStats>) => void;
  
  // リストからユーザーを削除
  removeFromFollowingList: (currentUserId: string, unfollowedUserId: string) => void;
  removeFromFollowersList: (currentUserId: string, unfollowerUserId: string) => void;
}

export const useFollowStore = create<FollowState>((set, get) => ({
  followStats: new Map(),
  followStatus: new Map(),
  followers: new Map(),
  following: new Map(),
  isLoadingFollowStats: false,
  isLoadingFollowStatus: false,
  isTogglingFollow: false,

  fetchFollowStats: async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    set({ isLoadingFollowStats: true });
    
    try {
      const { data, error } = await supabase.rpc('get_user_follow_stats', {
        user_ids: userIds
      });

      if (error) throw error;

      const newStats = new Map(get().followStats);
      data?.forEach((stat: any) => {
        newStats.set(stat.user_id, {
          userId: stat.user_id,
          followersCount: stat.followers_count || 0,
          followingCount: stat.following_count || 0
        });
      });

      set({ followStats: newStats });
    } catch (error) {
      console.error('Error fetching follow stats:', error);
    } finally {
      set({ isLoadingFollowStats: false });
    }
  },

  fetchFollowStatus: async (currentUserId: string, targetUserIds: string[]) => {
    if (!currentUserId || targetUserIds.length === 0) return;
    
    set({ isLoadingFollowStatus: true });
    
    try {
      const { data, error } = await supabase.rpc('check_follow_status', {
        current_user_id: currentUserId,
        target_user_ids: targetUserIds
      });

      if (error) throw error;

      const newStatus = new Map(get().followStatus);
      data?.forEach((status: any) => {
        newStatus.set(status.user_id, {
          userId: status.user_id,
          isFollowing: status.is_following || false,
          isFollowedBy: status.is_followed_by || false
        });
      });

      set({ followStatus: newStatus });
    } catch (error) {
      console.error('Error fetching follow status:', error);
    } finally {
      set({ isLoadingFollowStatus: false });
    }
  },

  toggleFollow: async (currentUserId: string, targetUserId: string) => {
    if (!currentUserId || !targetUserId) return false;
    
    set({ isTogglingFollow: true });
    
    try {
      const { data, error } = await supabase.rpc('toggle_follow', {
        follower_id_param: currentUserId,
        following_id_param: targetUserId
      });

      if (error) throw error;

      const result = data?.[0];
      if (result) {
        // フォロー状態を更新
        const newStatus = new Map(get().followStatus);
        const currentStatus = newStatus.get(targetUserId) || {
          userId: targetUserId,
          isFollowing: false,
          isFollowedBy: false
        };
        
        newStatus.set(targetUserId, {
          ...currentStatus,
          isFollowing: result.is_following
        });
        set({ followStatus: newStatus });

        // フォロー統計を更新
        const stats = get().followStats;
        const currentUserStats = stats.get(currentUserId);
        const targetUserStats = stats.get(targetUserId);

        if (currentUserStats) {
          get().updateUserFollowStats(currentUserId, {
            followingCount: currentUserStats.followingCount + (result.is_following ? 1 : -1)
          });
        }

        if (targetUserStats) {
          get().updateUserFollowStats(targetUserId, {
            followersCount: targetUserStats.followersCount + (result.is_following ? 1 : -1)
          });
        }

        // フォロー解除の場合、リストからユーザーを削除
        if (!result.is_following) {
          get().removeFromFollowingList(currentUserId, targetUserId);
          // 相手のフォロワーリストからも自分を削除（必要に応じて）
          get().removeFromFollowersList(targetUserId, currentUserId);
        }

        return result.is_following;
      }
      
      return false;
    } catch (error) {
      console.error('Error toggling follow:', error);
      return false;
    } finally {
      set({ isTogglingFollow: false });
    }
  },

  fetchFollowers: async (userId: string, limit = 20, offset = 0) => {
    try {
      const { data, error } = await supabase.rpc('get_recent_followers', {
        user_id_param: userId,
        limit_count: limit,
        offset_count: offset
      });

      if (error) throw error;

      const followers: User[] = data?.map((follower: any) => ({
        id: follower.follower_id,
        name: follower.follower_name,
        avatar: follower.follower_avatar,
        isFollowedBy: true,
        isFollowing: follower.is_following_back
      })) || [];

      // キャッシュに保存
      const newFollowers = new Map(get().followers);
      const existing = newFollowers.get(userId) || [];
      newFollowers.set(userId, offset === 0 ? followers : [...existing, ...followers]);
      set({ followers: newFollowers });

      return followers;
    } catch (error) {
      console.error('Error fetching followers:', error);
      return [];
    }
  },

  fetchFollowing: async (userId: string, limit = 20, offset = 0) => {
    try {
      const { data, error } = await supabase.rpc('get_following_users', {
        user_id_param: userId,
        limit_count: limit,
        offset_count: offset
      });

      if (error) throw error;

      const following: User[] = data?.map((user: any) => ({
        id: user.following_id,
        name: user.following_name,
        avatar: user.following_avatar,
        isFollowing: true,
        isFollowedBy: user.is_followed_back
      })) || [];

      // キャッシュに保存
      const newFollowing = new Map(get().following);
      const existing = newFollowing.get(userId) || [];
      newFollowing.set(userId, offset === 0 ? following : [...existing, ...following]);
      set({ following: newFollowing });

      return following;
    } catch (error) {
      console.error('Error fetching following:', error);
      return [];
    }
  },

  updateUserFollowStats: (userId: string, stats: Partial<FollowStats>) => {
    const newStats = new Map(get().followStats);
    const current = newStats.get(userId);
    
    if (current) {
      newStats.set(userId, { ...current, ...stats });
    } else {
      newStats.set(userId, {
        userId,
        followersCount: 0,
        followingCount: 0,
        ...stats
      });
    }
    
    set({ followStats: newStats });
  },

  // フォロー中リストから特定のユーザーを削除
  removeFromFollowingList: (currentUserId: string, unfollowedUserId: string) => {
    const newFollowing = new Map(get().following);
    const currentList = newFollowing.get(currentUserId) || [];
    const updatedList = currentList.filter(user => user.id !== unfollowedUserId);
    newFollowing.set(currentUserId, updatedList);
    set({ following: newFollowing });
  },

  // フォロワーリストから特定のユーザーを削除
  removeFromFollowersList: (currentUserId: string, unfollowerUserId: string) => {
    const newFollowers = new Map(get().followers);
    const currentList = newFollowers.get(currentUserId) || [];
    const updatedList = currentList.filter(user => user.id !== unfollowerUserId);
    newFollowers.set(currentUserId, updatedList);
    set({ followers: newFollowers });
  },

  clearCache: () => {
    set({
      followStats: new Map(),
      followStatus: new Map(),
      followers: new Map(),
      following: new Map()
    });
  }
}));