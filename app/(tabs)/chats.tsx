import React, { useEffect } from "react";
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useTopicStore } from "@/store/topic-store";
import { useLocationStore } from "@/store/location-store";
import SearchBar from "@/components/SearchBar";
import CustomHeader from "@/components/CustomHeader";
import { Topic } from "@/types";

export default function ChatsScreen() {
  const router = useRouter();
  const { 
    filteredTopics, 
    fetchNearbyTopics, 
    searchQuery, 
    searchTopics, 
    clearSearch 
  } = useTopicStore();
  const { currentLocation } = useLocationStore();
  
  useEffect(() => {
    if (currentLocation) {
      fetchNearbyTopics(currentLocation.latitude, currentLocation.longitude);
    }
  }, [currentLocation]);
  
  const handleChatPress = (topicId: string) => {
    router.push(`/chat/${topicId}`);
  };
  
  const handleSearch = (query: string) => {
    searchTopics(query);
  };
  
  const handleClearSearch = () => {
    clearSearch();
  };
  
  const renderChatItem = ({ item }: { item: Topic }) => {
    return (
      <TouchableOpacity 
        style={styles.chatItem}
        onPress={() => handleChatPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.chatIconContainer}>
          <MessageCircle size={24} color={Colors.text.light} />
        </View>
        
        <View style={styles.chatInfo}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.chatParticipants}>
            {item.participantCount} 人の参加者
          </Text>
        </View>
        
        <View style={styles.authorContainer}>
          <Image source={{ uri: item.author.avatar }} style={styles.authorAvatar} />
        </View>
      </TouchableOpacity>
    );
  };
  
  const getActiveChatsCount = () => {
    return filteredTopics.filter(topic => topic.participantCount > 1).length;
  };

  return (
    <View style={styles.container}>
      <CustomHeader
        title="チャットルーム"
        subtitle={`💬 ${getActiveChatsCount()} 件のアクティブなチャット • ${filteredTopics.length} 件のトピック`}
      />
      
      <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          onClear={handleClearSearch}
          placeholder="チャットルームを検索..."
        />
        
        <FlatList
          data={filteredTopics}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {searchQuery ? (
                <>
                  <Text style={styles.emptyTitle}>チャットルームが見つかりません</Text>
                  <Text style={styles.emptyText}>
                    検索条件を変更するか、クリアしてすべてのチャットルームを表示してください。
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>アクティブなチャットルームがありません</Text>
                  <Text style={styles.emptyText}>
                    新しいトピックを作成してチャットルームを始めましょう！
                  </Text>
                </>
              )}
            </View>
          }
        />
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
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  chatIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  chatParticipants: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  authorContainer: {
    marginLeft: 12,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});