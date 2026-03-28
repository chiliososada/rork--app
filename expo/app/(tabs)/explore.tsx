import React, { useEffect, useCallback, useState, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
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
import Colors from "@/constants/colors";
import { useLocationStore } from "@/store/location-store";
import { useExploreStore } from "@/store/explore-store";
import CustomHeader from "@/components/CustomHeader";
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
  
  // 页面获得焦点时刷新数据
  useFocusEffect(
    useCallback(() => {
      if (currentLocation) {
        fetchTopics(currentLocation.latitude, currentLocation.longitude, true);
      }
    }, [currentLocation, fetchTopics])
  );
  
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
  }, [currentLocation, isLoadingMore, loadMoreTopics]);
  
  const handleCategorySelect = (categoryKey: string) => {
    selectCategory(categoryKey);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };
  
  
  
  const renderHeader = () => (
    <>
      <RecommendationCarousel
        recommendations={recommendations}
        isLoading={isLoadingRecommendations}
        onRecommendationPress={(rec) => trackInteraction(rec.topicId || '', 'click')}
      />
    </>
  );
  
  const renderItem = useCallback(({ item }: { item: EnhancedTopic }) => (
    <EnhancedTopicCard
      topic={item}
      showMenuButton={true}
    />
  ), []);
  
  const renderEmpty = useCallback(() => {
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
  }, [isLoading, selectedCategory]);
  
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }, [isLoadingMore]);
  
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <CustomHeader
          title="🔍 発見"
          subtitle=""
          showGreeting={true}
        />
        
        <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
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
        
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSoft,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 17,
    color: Colors.text.secondary,
    marginTop: 20,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    backgroundColor: Colors.card,
  },
  emptyText: {
    fontSize: 17,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footerLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});