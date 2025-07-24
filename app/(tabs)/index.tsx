import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import TopicCard from "@/components/TopicCard";
import SearchBar from "@/components/SearchBar";
import Button from "@/components/Button";
import CustomHeader from "@/components/CustomHeader";
import Colors from "@/constants/colors";
import { useLocationStore } from "@/store/location-store";
import { useHomeTopicsStore } from "@/store/home-topics-store";
import { Topic } from "@/types";

export default function NearbyScreen() {
  const router = useRouter();
  const { currentLocation, permissionStatus, requestPermission } = useLocationStore();
  const { 
    filteredTopics, 
    fetchNearbyTopics, 
    loadMoreTopics,
    isLoading, 
    isLoadingMore,
    hasMore,
    searchQuery, 
    searchTopics, 
    clearSearch 
  } = useHomeTopicsStore();
  const [refreshing, setRefreshing] = useState(false);
  
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
    if (currentLocation && hasMore && !isLoadingMore) {
      await loadMoreTopics(currentLocation.latitude, currentLocation.longitude);
    }
  };
  
  const handleSearch = (query: string) => {
    searchTopics(query);
  };
  
  const handleClearSearch = () => {
    clearSearch();
  };
  
  const renderTopic = ({ item }: { item: Topic }) => {
    return <TopicCard topic={item} />;
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingFooterText}>さらに読み込み中...</Text>
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
    if (!currentLocation) return "Location not available";
    // You can replace this with actual location name from reverse geocoding
    return "Tokyo, Japan";
  };

  return (
    <View style={styles.container}>
      <CustomHeader
        title="近くのトピック"
        subtitle={`📍 ${getLocationText()}`}
      />
      
      <SafeAreaView style={styles.content} edges={['left', 'right']}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          onClear={handleClearSearch}
          placeholder="近くのトピックを検索..."
        />
        
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
              {searchQuery ? (
                <>
                  <Text style={styles.emptyTitle}>トピックが見つかりません</Text>
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