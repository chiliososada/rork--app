import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ArrowLeft, UserCheck, Users, Lock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFollowStore } from '@/store/follow-store';
import { useAuthStore } from '@/store/auth-store';
import FollowButton from '@/components/FollowButton';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';

export default function FollowersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetUserId = params.userId as string;
  
  const { user: currentUser } = useAuthStore();
  const { fetchFollowers, followers } = useFollowStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [canViewFollowers, setCanViewFollowers] = useState(true);
  const [targetUserName, setTargetUserName] = useState('');
  
  const userId = targetUserId || currentUser?.id;
  const userFollowers = followers.get(userId || '') || [];
  
  useEffect(() => {
    if (userId) {
      checkPrivacyAndLoadFollowers();
    }
  }, [userId]);
  
  const checkPrivacyAndLoadFollowers = async () => {
    if (!userId) return;
    
    try {
      // まずプライバシー設定をチェック
      const { data: profileData, error: profileError } = await supabase
        .rpc('get_user_profile_with_privacy', {
          requested_user_id: userId,
          viewing_user_id: currentUser?.id || null
        });
      
      if (profileError) throw profileError;
      
      if (profileData && profileData.length > 0) {
        const userData = profileData[0];
        setTargetUserName(userData.nickname || 'ユーザー');
        setCanViewFollowers(userData.can_view_followers);
        
        if (userData.can_view_followers) {
          await loadFollowers();
        } else {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error checking privacy settings:', error);
      setIsLoading(false);
    }
  };
  
  const loadFollowers = async (refresh = false) => {
    if (!userId) return;
    
    if (refresh) {
      setIsRefreshing(true);
    }
    
    try {
      const result = await fetchFollowers(userId, 20, refresh ? 0 : userFollowers.length, currentUser?.id);
      setHasMore(result.length === 20);
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  const handleLoadMore = () => {
    if (!isLoading && !isRefreshing && hasMore) {
      loadFollowers();
    }
  };
  
  const renderFollower = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => router.push(`/user/${item.id}`)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.avatar || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.isFollowing && item.isFollowedBy && (
            <View style={styles.mutualBadge}>
              <UserCheck size={12} color="#FFFFFF" />
              <Text style={styles.mutualText}>相互</Text>
            </View>
          )}
        </View>
      </View>
      <FollowButton
        targetUserId={item.id}
        size="small"
        showIcon={false}
        targetUserName={item.name}
        isFollowedBy={item.isFollowedBy}
      />
    </TouchableOpacity>
  );
  
  const renderEmpty = () => {
    if (isLoading) return null;
    
    if (!canViewFollowers) {
      return (
        <View style={styles.emptyContainer}>
          <Lock size={64} color={Colors.text.secondary} />
          <Text style={styles.emptyText}>このユーザーのフォロワーリストは非公開です</Text>
          <Text style={styles.emptySubtext}>{targetUserName}さんはフォロワーリストを非公開に設定しています</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Users size={64} color={Colors.text.secondary} />
        <Text style={styles.emptyText}>まだフォロワーがいません</Text>
      </View>
    );
  };
  
  const renderFooter = () => {
    if (!hasMore || !userFollowers.length) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen 
        options={{
          title: 'フォロワー',
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
      
      {isLoading && userFollowers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={canViewFollowers ? userFollowers : []}
          renderItem={renderFollower}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadFollowers(true)}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      )}
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
  listContent: {
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.border,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  mutualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  mutualText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});