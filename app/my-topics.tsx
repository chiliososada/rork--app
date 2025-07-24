import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import TopicCard from '@/components/TopicCard';
import { useTopicDetailsStore } from '@/store/topic-details-store';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';

export default function MyTopicsScreen() {
  const router = useRouter();
  const { userTopics, isUserTopicsLoading, fetchUserTopics, deleteTopic } = useTopicDetailsStore();
  const { user } = useAuthStore();
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchUserTopics(user.id);
    }
  }, [user?.id]);

  const handleRefresh = () => {
    if (user?.id) {
      fetchUserTopics(user.id);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!user?.id || isDeleting) return;
    
    setIsDeleting(true);
    try {
      await deleteTopic(topicId, user.id);
      // Refresh the list after deletion
      await fetchUserTopics(user.id);
    } catch (error) {
      console.error('Error deleting topic:', error);
      Alert.alert(
        "エラー",
        "投稿の削除に失敗しました。もう一度お試しください。",
        [{ text: "OK" }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>投稿がありません</Text>
      <Text style={styles.emptyDescription}>
        新しいトピックを作成して、地域の人々と会話を始めましょう。
      </Text>
    </View>
  );

  const renderTopic = ({ item }: { item: any }) => (
    <TopicCard 
      topic={item} 
      showMenuButton={true}
      onDelete={handleDeleteTopic}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen 
        options={{
          title: '我的投稿',
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
        <Text style={styles.subtitle}>{userTopics.length}件の投稿トピック</Text>
        <FlatList
          data={userTopics}
          renderItem={renderTopic}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isUserTopicsLoading || isDeleting}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={!isUserTopicsLoading ? renderEmptyState : null}
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