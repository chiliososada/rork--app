import React, { useEffect, useMemo, useCallback } from "react";
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MessageCircle, Clock } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useTopicStore } from "@/store/topic-store";
import { useLocationStore } from "@/store/location-store";
import { useChatStore } from "@/store/chat-store";
import SearchBar from "@/components/SearchBar";
import CustomHeader from "@/components/CustomHeader";
import { Topic } from "@/types";

export default function ChatsScreen() {
  const router = useRouter();
  const { 
    chatFilteredTopics, 
    fetchNearbyTopics, 
    chatSearchQuery, 
    searchChatTopics, 
    clearChatSearch 
  } = useTopicStore();
  const { currentLocation } = useLocationStore();
  const { getUnreadCount } = useChatStore();
  
  useEffect(() => {
    if (currentLocation) {
      fetchNearbyTopics(currentLocation.latitude, currentLocation.longitude);
    }
  }, [currentLocation]);
  
  const handleChatPress = useCallback((topicId: string) => {
    router.push(`/chat/${topicId}`);
  }, [router]);
  
  const handleSearch = (query: string) => {
    searchChatTopics(query);
  };
  
  const handleClearSearch = () => {
    clearChatSearch();
  };
  
  // Memoize expensive time formatting function
  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInMs / (1000 * 60));
      return minutes <= 0 ? "今" : `${minutes}分前`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}時間前`;
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  }, []);
  
  // Memoize chat item renderer for performance
  const renderChatItem = useCallback(({ item }: { item: Topic }) => {
    const unreadCount = getUnreadCount(item.id);
    
    return (
      <TouchableOpacity 
        style={styles.chatItem}
        onPress={() => handleChatPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.chatIconContainer}>
          <MessageCircle size={24} color={Colors.text.light} />
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount.toString()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatTitleRow}>
            <Text style={[styles.chatTitle, unreadCount > 0 && styles.unreadChatTitle]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.chatTimeContainer}>
              {item.lastMessageTime && (
                <Clock size={12} color={Colors.text.secondary} style={styles.clockIcon} />
              )}
              <Text style={styles.chatTime}>
                {item.lastMessageTime ? formatTime(item.lastMessageTime) : 'まだメッセージなし'}
              </Text>
            </View>
          </View>
          <Text style={styles.chatParticipants}>
            {item.participantCount} 人の参加者
          </Text>
        </View>
        
        <View style={styles.authorContainer}>
          <Image source={{ uri: item.author.avatar }} style={styles.authorAvatar} />
        </View>
      </TouchableOpacity>
    );
  }, [getUnreadCount, formatTime, handleChatPress]);
  
  // Memoize expensive calculations
  const getActiveChatsCount = useMemo(() => {
    return chatFilteredTopics.filter(topic => topic.participantCount > 1).length;
  }, [chatFilteredTopics]);
  
  // Memoize key extractor
  const keyExtractor = useCallback((item: Topic) => item.id, []);

  return (
    <View style={styles.container}>
      <CustomHeader
        title="チャットルーム"
        subtitle={`💬 ${getActiveChatsCount} 件のアクティブなチャット • ${chatFilteredTopics.length} 件のトピック`}
      />
      
      <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
        <SearchBar
          value={chatSearchQuery}
          onChangeText={handleSearch}
          onClear={handleClearSearch}
          placeholder="チャットルームを検索..."
        />
        
        <FlatList
          data={chatFilteredTopics}
          renderItem={renderChatItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 80, // Approximate item height
            offset: 80 * index,
            index,
          })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {chatSearchQuery ? (
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
    position: 'relative',
  },
  chatInfo: {
    flex: 1,
  },
  chatTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  chatTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clockIcon: {
    marginRight: 4,
  },
  chatTime: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '400',
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
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  unreadChatTitle: {
    fontWeight: '700',
    color: Colors.text.primary,
  },
});