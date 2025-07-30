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
import { usePrivateChatStore } from "@/store/private-chat-store";
import SearchBar from "@/components/SearchBar";
import CustomHeader from "@/components/CustomHeader";
import AvatarPicker from "@/components/AvatarPicker";
import NotificationHeaderButton from "@/components/NotificationHeaderButton";
import { Topic, ChatListItem } from "@/types";
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
    initializeGlobalConnection,
    updateUserTopics,
    isConnected
  } = useChatStore();
  const { 
    privateChats, 
    fetchPrivateChats 
  } = usePrivateChatStore();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'参加中' | '作成済み' | 'プライベート'>('参加中');
  
  useEffect(() => {
    if (user) {
      fetchChatTopics(user.id, true);
      fetchPrivateChats(user.id);
    }
  }, [user, fetchChatTopics, fetchPrivateChats]);
  
  // トピックが変更されたら未読数を取得し、リアルタイム購読を設定
  useEffect(() => {
    if (filteredTopics.length > 0 && user) {
      // トピックIDのリストを取得
      const topicIds = filteredTopics.map(topic => topic.id);
      
      // 未読数を取得
      fetchUnreadCountsForTopics(topicIds, user.id);
      
      // 初始化全局连接（如果还未连接）
      if (user?.id && !isConnected()) {
        initializeGlobalConnection(user.id);
      } else if (user?.id) {
        // 更新用户参与的topics
        updateUserTopics(user.id);
      }
    }
  }, [filteredTopics, user, fetchUnreadCountsForTopics, initializeGlobalConnection, updateUserTopics, isConnected]);
  
  const handleChatPress = useCallback((item: ChatListItem) => {
    if (item.type === 'topic') {
      router.push(`/chat/${item.id}`);
    } else {
      router.push(`/chat/private/${item.id}`);
    }
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
      // データを再取得
      await Promise.all([
        fetchChatTopics(user.id, true),
        fetchPrivateChats(user.id)
      ]);
      
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
  }, [user, fetchChatTopics, fetchPrivateChats, fetchUnreadCountsForTopics, filteredTopics]);
  
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

  // Convert topics and private chats to unified list with proper filtering
  const getChatListItems = useMemo((): ChatListItem[] => {
    const items: ChatListItem[] = [];
    
    if (activeTab === '参加中') {
      // 显示用户参加的他人创建的话题聊天（可退出）
      const participatingTopics = filteredTopics.filter(topic => 
        topic.author.id !== user?.id && topic.isParticipated
      );
      const topicItems: ChatListItem[] = participatingTopics.map(topic => ({
        id: topic.id,
        type: 'topic',
        title: topic.title,
        lastMessage: topic.lastMessagePreview,
        lastMessageTime: topic.lastMessageTime,
        unreadCount: getUnreadCount(topic.id),
        topic: topic,
      }));
      items.push(...topicItems);
    } else if (activeTab === '作成済み') {
      // 显示用户自己创建的话题聊天（不可退出）
      const myTopics = filteredTopics.filter(topic => 
        topic.author.id === user?.id
      );
      const topicItems: ChatListItem[] = myTopics.map(topic => ({
        id: topic.id,
        type: 'topic',
        title: topic.title,
        lastMessage: topic.lastMessagePreview,
        lastMessageTime: topic.lastMessageTime,
        unreadCount: getUnreadCount(topic.id),
        topic: topic,
      }));
      items.push(...topicItems);
    } else if (activeTab === 'プライベート') {
      // 显示所有私人消息对话
      const privateChatItems: ChatListItem[] = privateChats.map(chat => ({
        id: chat.id,
        type: 'private',
        title: chat.otherUser?.name || 'Unknown User',
        lastMessage: chat.lastMessage,
        lastMessageTime: chat.lastMessageAt,
        unreadCount: chat.unreadCount || 0,
        otherUser: chat.otherUser,
      }));
      items.push(...privateChatItems);
    }
    
    // Sort by last message time (newest first)
    return items.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });
  }, [filteredTopics, privateChats, activeTab, getUnreadCount, user?.id]);
  
  // Memoize chat item renderer for performance
  const renderChatItem = useCallback(({ item }: { item: ChatListItem }) => {
    return (
      <TouchableOpacity 
        style={styles.chatItem}
        onPress={() => handleChatPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.chatIconContainer}>
          {item.type === 'private' && item.otherUser ? (
            <AvatarPicker
              currentAvatarUrl={item.otherUser.avatar}
              userId={item.otherUser.id}
              size={40}
              editable={false}
            />
          ) : (
            <>
              <MessageCircle size={24} color={Colors.text.light} />
              {(item.unreadCount || 0) > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {(item.unreadCount || 0) > 99 ? '99+' : (item.unreadCount || 0).toString()}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatTitleRow}>
            <Text style={[styles.chatTitle, (item.unreadCount || 0) > 0 && styles.unreadChatTitle]} numberOfLines={1}>
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
          {item.type === 'topic' && item.topic ? (
            <Text style={styles.chatParticipants}>
              {item.topic.participantCount} 人の参加者
            </Text>
          ) : (
            <Text style={styles.chatParticipants}>
              {item.lastMessage || '新しいチャット'}
            </Text>
          )}
        </View>
        
        <View style={styles.authorContainer}>
          {item.type === 'topic' && item.topic && (
            <Image source={{ uri: item.topic.author.avatar }} style={styles.authorAvatar} />
          )}
          {item.type === 'private' && (item.unreadCount || 0) > 0 && (
            <View style={styles.privateUnreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {(item.unreadCount || 0) > 99 ? '99+' : (item.unreadCount || 0).toString()}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [handleChatPress]);
  
  // Render hidden item (swipe actions)
  const renderHiddenItem = useCallback(({ item }: { item: ChatListItem }) => {
    // 只有"参加中"标签的话题聊天可以退出
    if (activeTab !== '参加中' || item.type !== 'topic' || !item.topic) {
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
  
  // Memoize expensive calculations
  const getActiveChatsCount = useMemo(() => {
    return getChatListItems.filter(item => item.lastMessageTime).length;
  }, [getChatListItems]);
  
  // Memoize key extractor
  const keyExtractor = useCallback((item: ChatListItem) => `${item.type}-${item.id}`, []);

  // Tab component with three tabs
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === '参加中' && styles.activeTab]}
        onPress={() => setActiveTab('参加中')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, activeTab === '参加中' && styles.activeTabText]}>
          参加中
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === '作成済み' && styles.activeTab]}
        onPress={() => setActiveTab('作成済み')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, activeTab === '作成済み' && styles.activeTabText]}>
          作成済み
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'プライベート' && styles.activeTab]}
        onPress={() => setActiveTab('プライベート')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, activeTab === 'プライベート' && styles.activeTabText]}>
          プライベート
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <CustomHeader
        title="チャットルーム"
        subtitle=""
        rightElement={<NotificationHeaderButton />}
      />
      
      <SafeAreaView style={styles.content} edges={['left', 'right']}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          onClear={handleClearSearch}
          placeholder={
            activeTab === 'プライベート' 
              ? 'ユーザー名を検索...' 
              : 'チャットルームを検索...'
          }
        />
        
        {renderTabs()}
        
        <SwipeListView
          data={getChatListItems.map(item => ({ key: `${item.type}-${item.id}`, ...item }))}
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
          onSwipeValueChange={() => {}}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {searchQuery ? (
                <>
                  <Text style={styles.emptyTitle}>
                    {activeTab === 'プライベート' ? 'ユーザーが見つかりません' : 'チャットルームが見つかりません'}
                  </Text>
                  <Text style={styles.emptyText}>
                    検索条件を変更するか、クリアしてすべてを表示してください。
                  </Text>
                </>
              ) : activeTab === '参加中' ? (
                <>
                  <Text style={styles.emptyTitle}>参加中のチャットルームがありません</Text>
                  <Text style={styles.emptyText}>
                    既存のトピックの詳細ページで「チャットに参加」ボタンをタップして参加してください。
                  </Text>
                </>
              ) : activeTab === '作成済み' ? (
                <>
                  <Text style={styles.emptyTitle}>作成したチャットルームがありません</Text>
                  <Text style={styles.emptyText}>
                    新しいトピックを作成して、他の人とチャットを始めましょう。
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>プライベートチャットがありません</Text>
                  <Text style={styles.emptyText}>
                    ユーザープロフィールからメッセージを送信してチャットを始めましょう。
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    textAlign: 'center',
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
  privateUnreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
});