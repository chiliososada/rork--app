import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, Text, View, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import TopicCard from "@/components/TopicCard";
import SearchBar from "@/components/SearchBar";
import SearchFilterBar from "@/components/SearchFilterBar";
import SearchSettingsModal from "@/components/SearchSettingsModal";
import Button from "@/components/Button";
import CustomHeader from "@/components/CustomHeader";
import Colors from "@/constants/colors";
import { useLocationStore } from "@/store/location-store";
import { useHomeTopicsStore } from "@/store/home-topics-store";
import { Topic } from "@/types";

export default function NearbyScreen() {
  const router = useRouter();
  const { currentLocation, permissionStatus, requestPermission, getCurrentLocation, isLoading: locationLoading, error: locationError } = useLocationStore();
  const { 
    filteredTopics, 
    fetchNearbyTopics, 
    loadMoreTopics,
    isLoading, 
    isLoadingMore,
    hasMore,
    searchQuery, 
    searchTopics, 
    clearSearch,
    isSearching,
    isSearchMode,
    searchHasMore,
    loadMoreSearchResults
  } = useHomeTopicsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [lastLocationRefresh, setLastLocationRefresh] = useState(0);
  
  useEffect(() => {
    if (currentLocation) {
      loadTopics();
    }
  }, [currentLocation]);
  
  const loadTopics = async () => {
    if (currentLocation) {
      await fetchNearbyTopics(currentLocation.latitude, currentLocation.longitude, true);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTopics();
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (isSearchMode) {
      // Load more search results
      if (searchHasMore && !isSearching) {
        await loadMoreSearchResults();
      }
    } else {
      // Load more normal topics
      if (currentLocation && hasMore && !isLoadingMore) {
        await loadMoreTopics(currentLocation.latitude, currentLocation.longitude);
      }
    }
  };
  
  const handleSearch = (query: string) => {
    searchTopics(query);
  };
  
  const handleClearSearch = () => {
    clearSearch();
  };

  const handleSettingsPress = () => {
    setSettingsModalVisible(true);
  };

  const handleSettingsChanged = () => {
    // Refresh topics when search settings change
    if (currentLocation) {
      loadTopics();
    }
  };

  // 手动刷新位置功能
  const handleLocationRefresh = useCallback(async () => {
    // 防止频繁点击 - 3秒内只能刷新一次
    const now = Date.now();
    if (now - lastLocationRefresh < 3000) {
      Alert.alert('お待ちください', '位置情報を更新中です。しばらくお待ちください');
      return;
    }
    
    try {
      setLastLocationRefresh(now);
      
      // 先获取最新位置
      await getCurrentLocation();
      
      // 获取更新后的位置信息
      const updatedLocation = useLocationStore.getState().currentLocation;
      
      // 使用最新位置重新获取话题
      if (updatedLocation) {
        await fetchNearbyTopics(updatedLocation.latitude, updatedLocation.longitude, true);
      }
      
      // 显示成功提示
      Alert.alert('位置更新完了', '最新の位置情報を取得しました');
    } catch (error) {
      console.error('Location refresh failed:', error);
      Alert.alert('位置更新に失敗', '位置情報を取得できませんでした。位置情報の権限設定をご確認ください');
    }
  }, [getCurrentLocation, fetchNearbyTopics, lastLocationRefresh]);
  
  const renderTopic = ({ item }: { item: Topic }) => {
    return <TopicCard topic={item} />;
  };

  const renderFooter = () => {
    const isLoadingFooter = isSearchMode ? isSearching : isLoadingMore;
    if (!isLoadingFooter) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingFooterText}>
          {isSearchMode ? '検索結果を読み込み中...' : 'さらに読み込み中...'}
        </Text>
      </View>
    );
  };
  
  if (!currentLocation && permissionStatus !== 'granted') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <View style={styles.iconContainer}>
            <MapPin size={40} color={Colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>位置情報へのアクセスが必要です</Text>
          <Text style={styles.permissionText}>
            近くのトピックを表示するには、LocalTalkに位置情報へのアクセスを許可してください。
          </Text>
          <Button 
            title="位置情報を許可" 
            onPress={requestPermission}
            style={styles.permissionButton}
          />
        </View>
      </SafeAreaView>
    );
  }
  
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>近くのトピックを読み込んでいます...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const getLocationText = () => {
    // 位置加载中
    if (locationLoading) return "位置を取得中...";
    
    // 位置获取失败
    if (locationError) return "位置の取得に失敗しました";
    
    // 没有位置信息
    if (!currentLocation) return "位置情報なし";
    
    // 使用真实的地理位置名称
    if (currentLocation.name && currentLocation.name !== '現在地') {
      return currentLocation.name;
    }
    
    // 如果有完整地址，使用地址
    if (currentLocation.address) {
      return currentLocation.address;
    }
    
    // 降备方案：显示坐标
    return `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`;
  };

  return (
    <View style={styles.container}>
      <CustomHeader
        title="近くのトピック"
        subtitle={`📍 ${getLocationText()}`}
        showLocationRefresh={permissionStatus === 'granted'}
        onLocationRefresh={handleLocationRefresh}
        isLocationRefreshing={locationLoading}
      />
      
      <SafeAreaView style={styles.content} edges={['left', 'right']}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          onClear={handleClearSearch}
          placeholder="近くのトピックを検索..."
          isLoading={isSearching}
        />
        
        <SearchFilterBar onSettingsPress={handleSettingsPress} />
        
        <FlatList
          data={filteredTopics}
          renderItem={renderTopic}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {isSearchMode ? (
                <>
                  <Text style={styles.emptyTitle}>検索結果が見つかりません</Text>
                  <Text style={styles.emptyText}>
                    検索条件を変更するか、クリアして近くのすべてのトピックを表示してください。
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>近くにトピックがありません</Text>
                  <Text style={styles.emptyText}>
                    あなたのエリアで最初の会話を始めましょう！
                  </Text>
                  <TouchableOpacity 
                    style={styles.createTopicButton}
                    onPress={() => router.push('/create-topic')}
                  >
                    <Text style={styles.createTopicText}>トピックを作成</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
        />
        
        {/* Floating Action Button */}
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => router.push('/create-topic')}
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </SafeAreaView>

      <SearchSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        onSettingsChanged={handleSettingsChanged}
      />
    </View>
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
    padding: 16,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(91, 114, 242, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionButton: {
    width: "100%",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 16,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: "center",
    marginBottom: 16,
  },
  createTopicButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    alignSelf: 'center',
  },
  createTopicText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 100, // タブバーとの重複を避けるため
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingFooterText: {
    marginLeft: 10,
    fontSize: 14,
    color: Colors.text.secondary,
  },
});