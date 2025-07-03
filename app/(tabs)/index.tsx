import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin } from "lucide-react-native";
import TopicCard from "@/components/TopicCard";
import SearchBar from "@/components/SearchBar";
import Button from "@/components/Button";
import Colors from "@/constants/colors";
import { useLocationStore } from "@/store/location-store";
import { useTopicStore } from "@/store/topic-store";
import { Topic } from "@/types";

export default function NearbyScreen() {
  const { currentLocation, permissionStatus, requestPermission } = useLocationStore();
  const { 
    filteredTopics, 
    fetchNearbyTopics, 
    isLoading, 
    searchQuery, 
    searchTopics, 
    clearSearch 
  } = useTopicStore();
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    if (currentLocation) {
      loadTopics();
    }
  }, [currentLocation]);
  
  const loadTopics = async () => {
    if (currentLocation) {
      await fetchNearbyTopics(currentLocation.latitude, currentLocation.longitude);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTopics();
    setRefreshing(false);
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
  
  if (!currentLocation && permissionStatus !== 'granted') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <View style={styles.iconContainer}>
            <MapPin size={40} color={Colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>Location access needed</Text>
          <Text style={styles.permissionText}>
            To see topics near you, please allow LocalTalk to access your location.
          </Text>
          <Button 
            title="Allow Location Access" 
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
          <Text style={styles.loadingText}>Loading nearby topics...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Topics</Text>
        {currentLocation && (
          <View style={styles.locationContainer}>
            <MapPin size={14} color={Colors.text.secondary} />
            <Text style={styles.locationText}>
              Current Location
            </Text>
          </View>
        )}
      </View>
      
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearch}
        onClear={handleClearSearch}
        placeholder="Search nearby topics..."
      />
      
      <FlatList
        data={filteredTopics}
        renderItem={renderTopic}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {searchQuery ? (
              <>
                <Text style={styles.emptyTitle}>No topics found</Text>
                <Text style={styles.emptyText}>
                  Try adjusting your search terms or clear the search to see all nearby topics.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>No topics nearby</Text>
                <Text style={styles.emptyText}>
                  Be the first to start a conversation in your area!
                </Text>
              </>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 4,
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
  },
});