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
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { ArrowLeft, UserCheck, Users } from 'lucide-react-native';
import { useCallback } from 'react';
import Colors from '@/constants/colors';
import { useFollowStore } from '@/store/follow-store';
import { useAuthStore } from '@/store/auth-store';
import FollowButton from '@/components/FollowButton';
import { User } from '@/types';

export default function FollowingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetUserId = params.userId as string;
  
  const { user: currentUser } = useAuthStore();
  const { fetchFollowing, following } = useFollowStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const userId = targetUserId || currentUser?.id;
  const userFollowing = following.get(userId || '') || [];
  
  useEffect(() => {
    if (userId) {
      loadFollowing();
    }
  }, [userId]);
  
  // 画面にフォーカスが戻った時にリストを更新
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadFollowing(true);
      }
    }, [userId])
  );
  
  const loadFollowing = async (refresh = false) => {
    if (!userId) return;
    
    if (refresh) {
      setIsRefreshing(true);
    }
    
    try {
      const result = await fetchFollowing(userId, 20, refresh ? 0 : userFollowing.length);
      setHasMore(result.length === 20);
    } catch (error) {
      console.error('Error loading following:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  const handleLoadMore = () => {
    if (!isLoading && !isRefreshing && hasMore) {
      loadFollowing();
    }
  };
  
  const renderFollowing = ({ item }: { item: User }) => (
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
        onFollowChange={(isFollowing) => {
          // フォロー解除された場合は即座に画面を更新
          if (!isFollowing) {
            loadFollowing(true);
          }
        }}
      />
    </TouchableOpacity>
  );
  
  const renderEmpty = () => {
    if (isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Users size={64} color={Colors.text.secondary} />
        <Text style={styles.emptyText}>まだ誰もフォローしていません</Text>
      </View>
    );
  };
  
  const renderFooter = () => {
    if (!hasMore || !userFollowing.length) return null;
    
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
          title: 'フォロー中',
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
      
      {isLoading && userFollowing.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={userFollowing}
          renderItem={renderFollowing}
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
              onRefresh={() => loadFollowing(true)}
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
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});