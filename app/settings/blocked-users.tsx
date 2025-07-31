import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Shield, ShieldOff, ChevronRight, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUserBlocking } from '@/store/blocking-store';
import { useAuthStore } from '@/store/auth-store';
import UserAvatar from '@/components/UserAvatar';

interface BlockedUser {
  blocked_user_id: string;
  blocked_user_name: string;
  blocked_user_avatar: string | null;
  reason: string | null;
  is_mutual: boolean;
  blocked_at: string;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    blockedUsers, 
    loadBlockedUsers, 
    unblockUserWithConfirmation, 
    isLoading,
    refreshBlockedUsers 
  } = useUserBlocking();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // 只在用户ID存在且未初始化时加载一次
    if (user?.id && !initialized) {
      setInitialized(true);
      
      // 使用异步加载，避免阻塞UI
      loadBlockedUsers(user.id).catch(error => {
        console.error('Failed to load blocked users:', error);
        setInitialized(false); // 允许重试
      });
    }
  }, [user?.id, initialized, loadBlockedUsers]); // 简化依赖列表

  const handleRefresh = async () => {
    if (!user?.id) return;
    
    setIsRefreshing(true);
    try {
      await refreshBlockedUsers(user.id);
    } catch (error) {
      console.error('Failed to refresh blocked users:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetry = () => {
    if (user?.id) {
      setInitialized(false); // 重置状态允许重新加载
    }
  };

  const handleUnblockUser = (blockedUser: BlockedUser) => {
    Alert.alert(
      'ブロック解除',
      `${blockedUser.blocked_user_name}さんのブロックを解除しますか？\n\nブロックを解除すると：\n• この人の投稿やコメントが再び表示されます\n• この人があなたをフォローできるようになります\n• チャットでメッセージのやり取りができるようになります`,
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: 'ブロック解除',
          style: 'default',
          onPress: async () => {
            const success = await unblockUserWithConfirmation(
              blockedUser.blocked_user_id,
              blockedUser.blocked_user_name
            );
            
            if (success) {
              Alert.alert(
                'ブロック解除完了',
                `${blockedUser.blocked_user_name}さんのブロックを解除しました。`
              );
            }
          },
        },
      ]
    );
  };

  const formatBlockedDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return '昨日';
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}週間前`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months}ヶ月前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const renderBlockedUser = (blockedUser: BlockedUser) => (
    <TouchableOpacity
      key={blockedUser.blocked_user_id}
      style={styles.userItem}
      onPress={() => handleUnblockUser(blockedUser)}
      activeOpacity={0.7}
    >
      <View style={styles.userInfo}>
        <UserAvatar
          user={{
            id: blockedUser.blocked_user_id,
            name: blockedUser.blocked_user_name,
            nickname: blockedUser.blocked_user_name,
            avatar: blockedUser.blocked_user_avatar || ''
          }}
          size={50}
          showBlockedIndicator={false}
        />
        <View style={styles.userDetails}>
          <View style={styles.userHeader}>
            <Text style={styles.userName}>{blockedUser.blocked_user_name}</Text>
            {blockedUser.is_mutual && (
              <View style={styles.mutualBadge}>
                <Text style={styles.mutualBadgeText}>相互</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.blockedDate}>
            {formatBlockedDate(blockedUser.blocked_at)}にブロック
          </Text>
          
          {blockedUser.reason && (
            <Text style={styles.blockReason} numberOfLines={2}>
              理由: {blockedUser.reason}
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.unblockButton}>
        <ShieldOff size={20} color="#34C759" />
        <Text style={styles.unblockButtonText}>解除</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Shield size={64} color={Colors.text.secondary} />
      </View>
      <Text style={styles.emptyTitle}>ブロック中のユーザーはいません</Text>
      <Text style={styles.emptyDescription}>
        不適切な行為をするユーザーをブロックすると、ここに表示されます。
        ブロックしたユーザーの投稿やコメントは表示されなくなります。
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'ブロック中のユーザー',
          headerBackTitle: '戻る',
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {/* 説明セクション */}
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              <Shield size={24} color={Colors.primary} />
              <Text style={styles.infoTitle}>ブロック機能について</Text>
            </View>
            <Text style={styles.infoDescription}>
              ブロックしたユーザーの投稿、コメント、メッセージは表示されなくなります。
              また、お互いのフォロー関係も自動的に解除されます。
            </Text>
          </View>

          {/* 統計情報 */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Users size={20} color={Colors.text.secondary} />
              <Text style={styles.statNumber}>{blockedUsers.length}</Text>
              <Text style={styles.statLabel}>ブロック中</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Shield size={20} color={Colors.text.secondary} />
              <Text style={styles.statNumber}>
                {blockedUsers.filter(u => u.is_mutual).length}
              </Text>
              <Text style={styles.statLabel}>相互ブロック</Text>
            </View>
          </View>

          {/* ブロックされたユーザーリスト */}
          <View style={styles.usersList}>
            {isLoading && !initialized ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>読み込み中...</Text>
              </View>
            ) : blockedUsers.length === 0 ? (
              renderEmptyState()
            ) : (
              <View style={styles.usersContainer}>
                <Text style={styles.sectionTitle}>
                  ブロック中のユーザー ({blockedUsers.length}人)
                </Text>
                {blockedUsers.map(renderBlockedUser)}
              </View>
            )}
          </View>

          {/* 注意事項 */}
          {blockedUsers.length > 0 && (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>ブロック解除について</Text>
              <Text style={styles.noticeText}>
                ブロックを解除すると、そのユーザーの投稿やコメントが再び表示されます。
                解除後も、必要に応じて再度ブロックすることができます。
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  infoSection: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.secondary,
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  usersList: {
    marginTop: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  usersContainer: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  mutualBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  mutualBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  blockedDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  blockReason: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unblockButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 4,
  },
  notice: {
    margin: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1565C0',
  },
  errorContainer: {
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});