import React, { useEffect } from "react";
import { StyleSheet, Text, View, TouchableWithoutFeedback, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";
import { useLocationStore } from "@/store/location-store";
import { useTopicStore } from "@/store/topic-store";
import SearchBar from "@/components/SearchBar";
import MapViewComponent from "@/components/MapView";
import CustomHeader from "@/components/CustomHeader";

export default function ExploreScreen() {
  const router = useRouter();
  const { currentLocation } = useLocationStore();
  const { 
    filteredTopics, 
    fetchNearbyTopics, 
    searchQuery, 
    searchTopics, 
    clearSearch 
  } = useTopicStore();
  
  useEffect(() => {
    if (currentLocation) {
      fetchNearbyTopics(currentLocation.latitude, currentLocation.longitude);
    }
  }, [currentLocation]);
  
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
                <MapViewComponent
                  currentLocation={currentLocation}
                  topics={filteredTopics}
                  onMarkerPress={handleMarkerPress}
                />
              ) : (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>地図を読み込んでいます...</Text>
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
});