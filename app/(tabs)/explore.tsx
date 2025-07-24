import React, { useEffect, useCallback } from "react";
import { StyleSheet, Text, View, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";
import { useLocationStore } from "@/store/location-store";
import { useMapTopicsStore } from "@/store/map-topics-store";
import SearchBar from "@/components/SearchBar";
import MapViewComponent from "@/components/MapView";
import CustomHeader from "@/components/CustomHeader";

export default function ExploreScreen() {
  const router = useRouter();
  const { currentLocation } = useLocationStore();
  const { 
    filteredTopics, 
    fetchMapTopics, 
    fetchTopicsInViewport,
    loadMoreTopics,
    isLoading,
    isLoadingMore,
    searchQuery, 
    searchTopics, 
    clearSearch 
  } = useMapTopicsStore();
  
  // 初期データ読み込み：位置情報取得後にマップ用データを取得
  useEffect(() => {
    if (currentLocation) {
      // 地図専用のデータ取得（アクティビティベースソート）
      fetchMapTopics(currentLocation.latitude, currentLocation.longitude, true);
    }
  }, [currentLocation]);
  
  // 地図視区変更時の処理
  const handleMapRegionChange = useCallback((bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => {
    // 視区が変更された時に新しいエリアのトピックを取得
    fetchTopicsInViewport(bounds);
  }, [fetchTopicsInViewport]);
  
  const handleMarkerPress = (topicId: string) => {
    router.push(`/topic/${topicId}`);
  };
  
  const handleSearch = (query: string) => {
    searchTopics(query);
  };
  
  const handleClearSearch = () => {
    clearSearch();
  };
  
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <CustomHeader
          title="地図で探索"
          subtitle={`🗺️ 地図上のトピックを発見 • ${filteredTopics.length} 件のトピック`}
        />
        
        <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearch}
            onClear={handleClearSearch}
            placeholder="地図上でトピックを検索..."
          />
          
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.mapWrapper}>
              {currentLocation ? (
                <>
                  <MapViewComponent
                    currentLocation={currentLocation}
                    topics={filteredTopics}
                    onMarkerPress={handleMarkerPress}
                    onRegionChange={handleMapRegionChange}
                  />
                  {/* 初期データ読み込み中のインジケーター */}
                  {isLoading && filteredTopics.length === 0 && (
                    <View style={styles.loadingOverlay}>
                      <View style={styles.loadingIndicator}>
                        <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.loadingText}>地図上のトピックを読み込んでいます...</Text>
                      </View>
                    </View>
                  )}
                  {/* 追加データ読み込み中のインジケーター */}
                  {isLoadingMore && (
                    <View style={styles.loadingOverlay}>
                      <View style={styles.loadingIndicator}>
                        <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.loadingText}>さらにトピックを読み込んでいます...</Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.loadingText}>位置情報を取得しています...</Text>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </SafeAreaView>
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
  mapWrapper: {
    flex: 1,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});