import React, { useEffect, useCallback, useState, useRef } from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableWithoutFeedback, 
  Keyboard, 
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useLocationStore } from "@/store/location-store";
import { useExploreStore } from "@/store/explore-store";
import SearchBar from "@/components/SearchBar";
import SearchFilterBar from "@/components/SearchFilterBar";
import SearchSettingsModal from "@/components/SearchSettingsModal";
import CustomHeader from "@/components/CustomHeader";
import GreetingHeader from "@/components/explore/GreetingHeader";
import RecommendationCarousel from "@/components/explore/RecommendationCarousel";
import CategoryTabs from "@/components/explore/CategoryTabs";
import EnhancedTopicCard from "@/components/explore/EnhancedTopicCard";
import { EnhancedTopic } from "@/types";

export default function ExploreScreen() {
  const router = useRouter();
  const { currentLocation } = useLocationStore();
  const { 
    topics,
    categories,
    selectedCategory,
    recommendations,
    isLoading,
    isLoadingMore,
    isLoadingRecommendations,
    error,
    fetchCategories,
    fetchRecommendations,
    fetchTopics,
    loadMoreTopics,
    selectCategory,
    trackInteraction
  } = useExploreStore();
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  // 初期データ読み込み
  useEffect(() => {
    fetchCategories();
    fetchRecommendations();
  }, []);
  
  // 位置情報取得後にトピックを取得
  useEffect(() => {
    if (currentLocation) {
      fetchTopics(currentLocation.latitude, currentLocation.longitude, true);
    }
  }, [currentLocation, selectedCategory]);
  
  const handleRefresh = useCallback(async () => {
    if (!currentLocation) return;
    
    setRefreshing(true);
    await Promise.all([
      fetchRecommendations(),
      fetchTopics(currentLocation.latitude, currentLocation.longitude, true)
    ]);
    setRefreshing(false);
  }, [currentLocation]);
  
  const handleLoadMore = useCallback(() => {
    if (currentLocation && !isLoadingMore) {
      loadMoreTopics(currentLocation.latitude, currentLocation.longitude);
    }
  }, [currentLocation, isLoadingMore]);
  
  const handleSettingsPress = () => {
    setSettingsModalVisible(true);
  };

  const handleSettingsChanged = () => {
    if (currentLocation) {
      fetchTopics(currentLocation.latitude, currentLocation.longitude, true);
    }
  };
  
  const handleCategorySelect = (categoryKey: string) => {
    selectCategory(categoryKey);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };
  
  const handleSimilarPost = (topic: EnhancedTopic) => {
    // 似たような投稿を作成する画面へ遷移
    router.push({
      pathname: '/(tabs)/publish',
      params: {
        templateTitle: topic.title,
        templateTags: JSON.stringify(topic.tags || []),
        templateCategory: topic.category
      }
    });
  };
  
  const handleFABPress = () => {
    router.push('/(tabs)/publish');
  };
  
  const renderHeader = () => (
    <>
      <GreetingHeader 
        locationName={currentLocation ? '現在地' : undefined}
        topicCount={topics.length}
      />
      
      <RecommendationCarousel
        recommendations={recommendations}
        isLoading={isLoadingRecommendations}
        onRecommendationPress={(rec) => trackInteraction(rec.topicId || '', 'click')}
      />
    </>
  );
  
  const renderItem = ({ item }: { item: EnhancedTopic }) => (
    <EnhancedTopicCard
      topic={item}
      onSimilarPost={handleSimilarPost}
    />
  );
  
  const renderEmpty = () => {
    if (isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {selectedCategory === 'recommended' 
            ? 'まだおすすめのトピックがありません'
            : 'このカテゴリーのトピックはまだありません'}
        </Text>
      </View>
    );
  };
  
  const renderFooter = () => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };
  
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <CustomHeader
          title="🔍 発見"
          subtitle={`${topics.length} 件のトピック`}
        />
        
        <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
          <SearchFilterBar onSettingsPress={handleSettingsPress} />
          
          <CategoryTabs
            categories={categories}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
          
          {currentLocation ? (
            <FlatList
              ref={flatListRef}
              data={topics}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              ListHeaderComponent={renderHeader}
              ListEmptyComponent={renderEmpty}
              ListFooterComponent={renderFooter}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[Colors.primary]}
                  tintColor={Colors.primary}
                />
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={5}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>位置情報を取得しています...</Text>
            </View>
          )}
        </SafeAreaView>
        
        {/* フローティングアクションボタン */}
        <TouchableOpacity
          style={styles.fab}
          onPress={handleFABPress}
          activeOpacity={0.8}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>

        <SearchSettingsModal
          visible={settingsModalVisible}
          onClose={() => setSettingsModalVisible(false)}
          onSettingsChanged={handleSettingsChanged}
        />
      </View>
    </TouchableWithoutFeedback>
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  footerLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});