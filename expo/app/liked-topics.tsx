import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import TopicCard from '@/components/TopicCard';
import { useTopicDetailsStore } from '@/store/topic-details-store';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';

export default function LikedTopicsScreen() {
  const router = useRouter();
  const { likedTopics, isLikedTopicsLoading, fetchLikedTopics } = useTopicDetailsStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.id) {
      fetchLikedTopics(user.id);
    }
  }, [user?.id]);

  const handleRefresh = () => {
    if (user?.id) {
      fetchLikedTopics(user.id);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>いいねしたトピックがありません</Text>
      <Text style={styles.emptyDescription}>
        気に入ったトピックにいいねボタンをタップして、後で簡単に見つけられるようにしましょう。
      </Text>
    </View>
  );

  const renderTopic = ({ item }: { item: any }) => (
    <TopicCard topic={item} />
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen 
        options={{
          title: 'いいね',
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
      
      <View style={styles.content}>
        <Text style={styles.subtitle}>{likedTopics.length}件のいいねしたトピック</Text>
        <FlatList
          data={likedTopics}
          renderItem={renderTopic}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isLikedTopicsLoading}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={!isLikedTopicsLoading ? renderEmptyState : null}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});