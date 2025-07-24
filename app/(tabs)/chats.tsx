import React, { useEffect, useMemo, useCallback, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Image, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MessageCircle, Clock, LogOut } from "lucide-react-native";
import { SwipeListView } from 'react-native-swipe-list-view';
import Colors from "@/constants/colors";
import { useChatTopicsStore } from "@/store/chat-topics-store";
import { useChatStore } from "@/store/chat-store";
import { useAuthStore } from "@/store/auth-store";
import SearchBar from "@/components/SearchBar";
import CustomHeader from "@/components/CustomHeader";
import { Topic } from "@/types";
import { formatChatListTime } from "@/lib/utils/timeUtils";

export default function ChatsScreen() {
  const router = useRouter();
  const { 
    filteredTopics, 
    fetchChatTopics, 
    searchQuery, 
    searchTopics, 
    clearSearch,
    leaveTopic 
  } = useChatTopicsStore();
  const { user } = useAuthStore();
  const { 
    getUnreadCount, 
    fetchUnreadCountsForTopics,
    subscribeToMultipleTopics,
    cleanupUnusedSubscriptions
  } = useChatStore();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'others'>('others');
  
  useEffect(() => {
    if (user) {
      fetchChatTopics(user.id, true);
    }
  }, [user, fetchChatTopics]);
  
  // トピックが変更されたら未読数を取得し、リアルタイム購読を設定
  useEffect(() => {
    if (filteredTopics.length > 0 && user) {
      // トピックIDのリストを取得
      const topicIds = filteredTopics.map(topic => topic.id);
      
      // 未読数を取得
      fetchUnreadCountsForTopics(topicIds, user.id);
      
      // リアルタイム購読を設定（最大5つまで）
      subscribeToMultipleTopics(topicIds.slice(0, 5));
      
      // クリーンアップ: 表示されていないトピックの購読を解除
      return () => {
        cleanupUnusedSubscriptions(topicIds);
      };
    }
  }, [filteredTopics, user, fetchUnreadCountsForTopics, subscribeToMultipleTopics, cleanupUnusedSubscriptions]);
  
  const handleChatPress = useCallback((topicId: string) => {
    router.push(`/chat/${topicId}`);
  }, [router]);
  
  const handleSearch = (query: string) => {
    searchTopics(query);
  };
  
  const handleClearSearch = () => {
    clearSearch();
  };
  
  const handleRefresh = useCallback(async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      // トピックデータを再取得
      await fetchChatTopics(user.id, true);
      
      // 少し待ってからトピックIDを取得（データが更新されるのを待つ）
      setTimeout(async () => {
        const topicIds = filteredTopics.map(topic => topic.id);
        if (topicIds.length > 0) {
          // 未読数を更新
          await fetchUnreadCountsForTopics(topicIds, user.id);
        }
      }, 100);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user, fetchChatTopics, fetchUnreadCountsForTopics, filteredTopics]);
  
  const handleLeaveTopic = useCallback((topicId: string, topicTitle: string) => {
    if (!user) return;
    
    Alert.alert(
      "チャット退出",
      `「${topicTitle}」のチャットから退出しますか？`,
      [
        {
          text: "キャンセル",
          style: "cancel"
        },
        {
          text: "退出",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveTopic(topicId, user.id);
              // 退出成功後にリストを強制更新
              await fetchChatTopics(user.id, true);
              Alert.alert("完了", "チャットから退出しました");
            } catch (error) {
              console.error('Failed to leave topic:', error);
              Alert.alert("エラー", "チャットの退出に失敗しました");
            }
          }
        }
      ]
    );
  }, [user, leaveTopic, fetchChatTopics]);

  
  
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
                {item.lastMessageTime ? formatChatListTime(item.lastMessageTime) : 'まだメッセージなし'}
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
  }, [getUnreadCount, handleChatPress]);
  
  // Render hidden item (swipe actions)
  const renderHiddenItem = useCallback(({ item }: { item: Topic }) => {
    // Don't show swipe actions for "my" tab
    if (activeTab === 'my') {
      return null;
    }
    
    return (
      <View style={styles.hiddenItemContainer}>
        <TouchableOpacity 
          style={styles.leaveButton}
          onPress={() => handleLeaveTopic(item.id, item.title)}
          activeOpacity={0.7}
        >
          <LogOut size={20} color="white" />
          <Text style={styles.actionButtonText}>退出</Text>
        </TouchableOpacity>
      </View>
    );
  }, [handleLeaveTopic, activeTab]);
  
  // Filter topics based on active tab
  const tabFilteredTopics = useMemo(() => {
    if (!user) return [];
    
    return filteredTopics.filter(topic => {
      if (activeTab === 'my') {
        return topic.author.id === user.id;
      } else {
        return topic.author.id !== user.id;
      }
    });
  }, [filteredTopics, activeTab, user]);

  // Memoize expensive calculations
  const getActiveChatsCount = useMemo(() => {
    return tabFilteredTopics.filter(topic => topic.lastMessageTime).length;
  }, [tabFilteredTopics]);
  
  // Memoize key extractor
  const keyExtractor = useCallback((item: Topic) => item.id, []);

  // Tab component
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'others' && styles.activeTab]}
        onPress={() => setActiveTab('others')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, activeTab === 'others' && styles.activeTabText]}>
          その他
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'my' && styles.activeTab]}
        onPress={() => setActiveTab('my')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>
          私が発表した
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <CustomHeader
        title="チャットルーム"
        subtitle={`💬 ${getActiveChatsCount} 件のアクティブなチャット • ${tabFilteredTopics.length} 件の${activeTab === 'my' ? '発表した' : '参加中'}トピック`}
      />
      
      <SafeAreaView style={styles.content} edges={['left', 'right']}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          onClear={handleClearSearch}
          placeholder="チャットルームを検索..."
        />
        
        {renderTabs()}
        
        <SwipeListView
          data={tabFilteredTopics.map(topic => ({ key: topic.id, ...topic }))}
          renderItem={renderChatItem}
          renderHiddenItem={renderHiddenItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          rightOpenValue={-75}
          disableRightSwipe={true}
          removeClippedSubviews={true}
          leftOpenValue={75}
          stopLeftSwipe={75}
          stopRightSwipe={0}
          swipeRowStyle={{ backgroundColor: 'transparent' }}
          swipeToOpenPercent={40}
          swipeToClosePercent={70}
          closeOnRowPress={true}
          closeOnScroll={true}
          closeOnRowBeginSwipe={true}
          closeOnRowOpen={false}
          recalculateHiddenLayout={false}
          disableLeftSwipe={false}
          directionalDistanceChangeThreshold={10}
          swipeGestureBegan={() => {}}
          swipeValueChanged={() => {}}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {searchQuery ? (
                <>
                  <Text style={styles.emptyTitle}>チャットルームが見つかりません</Text>
                  <Text style={styles.emptyText}>
                    検索条件を変更するか、クリアしてすべてのチャットルームを表示してください。
                  </Text>
                </>
              ) : activeTab === 'my' ? (
                <>
                  <Text style={styles.emptyTitle}>発表したトピックがありません</Text>
                  <Text style={styles.emptyText}>
                    新しいトピックを作成して、他の人とチャットを始めましょう。
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>参加中のチャットルームがありません</Text>
                  <Text style={styles.emptyText}>
                    既存のトピックの詳細ページで「チャットに参加」ボタンをタップして参加してください。
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: 'white',
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
  hiddenItemContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: Colors.background,
    marginBottom: 12,
    paddingRight: 16,
  },
  leaveButton: {
    width: 75,
    height: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  leaveButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});