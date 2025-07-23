import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import TopicCard from '@/components/TopicCard';
import { useTopicDetailsStore } from '@/store/topic-details-store';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';

export default function FavoritesScreen() {
  const router = useRouter();
  const { favoriteTopics, isFavoriteLoading, fetchFavoriteTopics } = useTopicDetailsStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.id) {
      fetchFavoriteTopics(user.id);
    }
  }, [user?.id]);

  const handleRefresh = () => {
    if (user?.id) {
      fetchFavoriteTopics(user.id);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>収藏がありません</Text>
      <Text style={styles.emptyDescription}>
        気になるトピックを見つけたら、書簽ボタンをタップして収藏に追加しましょう。
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
          title: '収藏',
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
        <Text style={styles.subtitle}>{favoriteTopics.length}件の収藏トピック</Text>
        <FlatList
          data={favoriteTopics}
          renderItem={renderTopic}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isFavoriteLoading}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={!isFavoriteLoading ? renderEmptyState : null}
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