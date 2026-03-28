import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { MessageSquare, Heart, Bookmark, Users, MessageCircle, MoreHorizontal, Flag, Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useFollowStore } from '@/store/follow-store';
import { useTopicDetailsStore } from '@/store/topic-details-store';
import { usePrivateChatStore } from '@/store/private-chat-store';
import { useUserBlocking } from '@/store/blocking-store';
import AvatarPicker from '@/components/AvatarPicker';
import FollowButton from '@/components/FollowButton';
import BlockUserButton from '@/components/BlockUserButton';
import ReportModal from '@/components/ReportModal';
import TopicCard from '@/components/TopicCard';
import { supabase } from '@/lib/supabase';
import { User, Topic } from '@/types';

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const { followStats, followStatus, fetchFollowStats, fetchFollowStatus } = useFollowStore();
  const { fetchUserTopics } = useTopicDetailsStore();
  const { getOrCreatePrivateChat } = usePrivateChatStore();
  const { isUserBlockedSync, loadBlockedUsers } = useUserBlocking();
  
  const [user, setUser] = useState<User | null>(null);
  const [userTopics, setUserTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [topicCount, setTopicCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [canViewProfile, setCanViewProfile] = useState(true);
  const [canViewFollowers, setCanViewFollowers] = useState(true);
  
  const stats = followStats.get(id);
  const followersCount = canViewFollowers ? (stats?.followersCount || 0) : null;
  const followingCount = canViewFollowers ? (stats?.followingCount || 0) : null;
  
  const status = followStatus.get(id);
  const isFollowedBy = status?.isFollowedBy || false;
  
  useEffect(() => {
    if (id) {
      loadUserData();
    }
  }, [id]);
  
  useEffect(() => {
    if (id && currentUser?.id && id !== currentUser.id) {
      fetchFollowStatus(currentUser.id, [id]);
      loadBlockedUsers(currentUser.id);
    }
  }, [id, currentUser?.id]);

  useEffect(() => {
    if (id && currentUser?.id) {
      const blocked = isUserBlockedSync(id);
      setIsBlocked(blocked);
    }
  }, [id, currentUser?.id, isUserBlockedSync]);
  
  const loadUserData = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      // プライバシー設定を考慮してユーザー情報を取得
      const { data: profileData, error: profileError } = await supabase
        .rpc('get_user_profile_with_privacy', {
          requested_user_id: id,
          viewing_user_id: currentUser?.id || null
        });
      
      if (profileError) throw profileError;
      
      if (profileData && profileData.length > 0) {
        const userData = profileData[0];
        
        const userInfo: User = {
          id: userData.id,
          name: userData.nickname || 'ユーザー',
          nickname: userData.nickname || 'ユーザー',
          avatar: userData.avatar_url || '',
          email: userData.can_view_profile ? userData.email : undefined,
          bio: userData.can_view_profile ? userData.bio : undefined,
          gender: userData.can_view_profile ? userData.gender : undefined,
          isProfilePublic: userData.is_profile_public,
          isFollowersVisible: userData.is_followers_visible,
        };
        
        setUser(userInfo);
        setCanViewProfile(userData.can_view_profile);
        setCanViewFollowers(userData.can_view_followers);
        
        // フォロー統計を取得（プライバシー設定に基づいて表示）
        if (userData.can_view_followers) {
          await fetchFollowStats([id], currentUser?.id);
        }
      } else {
        throw new Error('User not found');
      }
      
      // ユーザーの投稿を取得
      const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select(`
          *,
          user:users(id, nickname, avatar_url)
        `)
        .eq('user_id', id)
        .order('created_at', { ascending: false });
      
      if (topicsError) throw topicsError;
      
      const formattedTopics: Topic[] = topics?.map(topic => ({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        createdAt: topic.created_at,
        author: {
          id: topic.user.id,
          name: topic.user.nickname,
          nickname: topic.user.nickname,
          avatar: topic.user.avatar_url || '',
        },
        location: {
          latitude: topic.latitude,
          longitude: topic.longitude,
          name: topic.location_name,
        },
        commentCount: 0,
        participantCount: 0,
        imageUrl: topic.image_url,
        aspectRatio: topic.image_aspect_ratio,
        originalWidth: topic.original_width,
        originalHeight: topic.original_height,
      })) || [];
      
      setUserTopics(formattedTopics);
      setTopicCount(formattedTopics.length);
      
      // ユーザーの統計情報を取得
      await fetchUserStats();
      
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  const fetchUserStats = async () => {
    if (!id) return;
    
    try {
      // ユーザーが受け取ったいいね数を取得
      const { data: userTopics } = await supabase
        .from('topics')
        .select('id')
        .eq('user_id', id);
      
      if (userTopics && userTopics.length > 0) {
        const topicIds = userTopics.map(t => t.id);
        
        const { count } = await supabase
          .from('topic_likes')
          .select('*', { count: 'exact', head: true })
          .in('topic_id', topicIds);
        
        setLikeCount(count || 0);
      }
      
      // ユーザーの収藏数を取得
      const { count: favorites } = await supabase
        .from('topic_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id);
      
      setFavoriteCount(favorites || 0);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };
  
  const handleSendMessage = async () => {
    if (!currentUser?.id || !user?.id) return;
    
    try {
      const chatId = await getOrCreatePrivateChat(currentUser.id, user.id);
      router.push(`/chat/private/${chatId}`);
    } catch (error) {
      console.error('Error creating private chat:', error);
    }
  };

  const handleMoreOptions = () => {
    if (!user) return;

    Alert.alert(
      'ユーザーオプション',
      `${user.name}さんに対する操作を選択してください`,
      [
        {
          text: 'ユーザーを通報',
          onPress: () => setShowReportModal(true),
          style: 'destructive',
        },
        {
          text: 'キャンセル',
          style: 'cancel',
        },
      ]
    );
  };

  const handleBlockChange = (blocked: boolean) => {
    setIsBlocked(blocked);
    if (blocked) {
      // ブロック後は自動的に前の画面に戻る
      Alert.alert(
        'ブロック完了',
        `${user?.name || 'ユーザー'}をブロックしました。\nこのユーザーの投稿やコメントは表示されなくなります。`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    }
  };
  
  const renderTopic = ({ item }: { item: Topic }) => (
    <TopicCard topic={item} />
  );
  
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>まだ投稿がありません</Text>
    </View>
  );
  
  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'プロフィール',
            headerShown: true,
            headerStyle: {
              backgroundColor: Colors.card,
            },
            headerTitleStyle: {
              fontSize: 18,
              fontWeight: '600',
              color: Colors.text.primary,
            },
            headerTintColor: Colors.text.primary,
            headerBackTitle: '',
            headerBackVisible: true,
            headerShadowVisible: true,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
  
  // 自分のプロフィールの場合はプロフィール画面にリダイレクト
  if (currentUser?.id === id) {
    router.replace('/(tabs)/profile');
    return null;
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen 
        options={{
          title: user.name,
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.card,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '600',
            color: Colors.text.primary,
          },
          headerTintColor: Colors.text.primary,
          headerBackTitle: '',
          headerBackVisible: true,
          headerShadowVisible: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleMoreOptions}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <MoreHorizontal size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadUserData(true)}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.profileHeader}>
          <View style={styles.profileSection}>
            <AvatarPicker
              currentAvatarUrl={user.avatar}
              userId={user.id}
              size={100}
              editable={false}
            />
            <Text style={styles.name}>{user.name}</Text>
            
            {/* 自己紹介セクション */}
            {canViewProfile && user.bio && (
              <View style={styles.bioContainer}>
                <Text style={styles.bioText}>{user.bio}</Text>
              </View>
            )}
            
            <View style={styles.actionButtonsContainer}>
              <FollowButton
                targetUserId={user.id}
                size="medium"
                style={styles.followButton}
                targetUserName={user.name}
                isFollowedBy={isFollowedBy}
              />
              <TouchableOpacity
                style={styles.messageButton}
                onPress={handleSendMessage}
                activeOpacity={0.7}
                disabled={isBlocked}
              >
                <MessageCircle size={16} color={isBlocked ? Colors.text.secondary : Colors.primary} />
                <Text style={[
                  styles.messageButtonText, 
                  isBlocked && { color: Colors.text.secondary }
                ]}>
                  {isBlocked ? 'ブロック中' : 'メッセージ'}
                </Text>
              </TouchableOpacity>
            </View>

            {!isBlocked && (
              <View style={styles.blockButtonContainer}>
                <BlockUserButton
                  userId={user.id}
                  userName={user.name}
                  size="small"
                  variant="secondary"
                  onBlockChange={handleBlockChange}
                />
              </View>
            )}
            
            <View style={styles.statsContainer}>
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => canViewFollowers ? router.push({
                  pathname: '/followers',
                  params: { userId: user.id }
                }) : Alert.alert('非公開', 'このユーザーのフォロワーリストは非公開です')}
                activeOpacity={0.7}
              >
                <Users size={20} color={Colors.text.secondary} />
                <Text style={styles.statNumber}>{canViewFollowers ? followersCount : '非公開'}</Text>
                <Text style={styles.statLabel}>フォロワー</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => canViewFollowers ? router.push({
                  pathname: '/following',
                  params: { userId: user.id }
                }) : Alert.alert('非公開', 'このユーザーのフォローリストは非公開です')}
                activeOpacity={0.7}
              >
                <Users size={20} color={Colors.text.secondary} />
                <Text style={styles.statNumber}>{canViewFollowers ? followingCount : '非公開'}</Text>
                <Text style={styles.statLabel}>フォロー中</Text>
              </TouchableOpacity>
            </View>
            
            <View style={[styles.statsContainer, { marginTop: 12 }]}>
              <View style={styles.statItem}>
                <MessageSquare size={20} color={Colors.text.secondary} />
                <Text style={styles.statNumber}>{topicCount}</Text>
                <Text style={styles.statLabel}>投稿</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Heart size={20} color={Colors.text.secondary} />
                <Text style={styles.statNumber}>{likeCount}</Text>
                <Text style={styles.statLabel}>いいね</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Bookmark size={20} color={Colors.text.secondary} />
                <Text style={styles.statNumber}>{favoriteCount}</Text>
                <Text style={styles.statLabel}>収藏</Text>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.topicsSection}>
          <Text style={styles.sectionTitle}>投稿一覧</Text>
          {userTopics.length === 0 ? (
            renderEmptyState()
          ) : (
            userTopics.map(topic => (
              <TopicCard key={topic.id} topic={topic} />
            ))
          )}
        </View>
      </ScrollView>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={user.id}
        reportedUserName={user.name}
        contentType="user"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    backgroundColor: '#F8F9FA',
    paddingBottom: 24,
    marginBottom: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 0,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 12,
  },
  bioContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    width: '100%',
  },
  followButton: {
    flex: 1,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  messageButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
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
    minWidth: '90%',
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
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  topicsSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  blockButtonContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
});