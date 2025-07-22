import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, Settings, MapPin, Bell, Shield, HelpCircle, MessageSquare, Heart, Bookmark, ThumbsUp } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useAuthStore } from "@/store/auth-store";
import CustomHeader from "@/components/CustomHeader";
import AvatarPicker from "@/components/AvatarPicker";
import { supabase } from "@/lib/supabase";
import { useRouter, useFocusEffect } from "expo-router";
import { useTopicStore } from "@/store/topic-store";
import { useCallback } from "react";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateAvatar, isUpdatingAvatar } = useAuthStore();
  const { favoriteTopics, fetchFavoriteTopics, profileStatsVersion } = useTopicStore();
  const [topicCount, setTopicCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  
  useEffect(() => {
    if (user?.id) {
      fetchUserStats();
      fetchFavoriteTopics(user.id);
    }
  }, [user?.id]);
  
  // フォーカス時に統計データをリフレッシュ（点赞数の変更を反映）
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchUserStats();
      }
    }, [user?.id])
  );
  
  // Update favorite count when favoriteTopics changes
  useEffect(() => {
    setFavoriteCount(favoriteTopics.length);
  }, [favoriteTopics.length]);
  
  // 点赞状态改变时刷新统计数据
  useEffect(() => {
    if (user?.id && profileStatsVersion > 0) {
      console.log('🔄 Profile stats version changed, refreshing stats...');
      fetchUserStats();
    }
  }, [profileStatsVersion, user?.id]);
  
  const fetchUserStats = async () => {
    if (!user?.id) return;
    
    console.log('🔄 Refreshing user stats...');
    
    try {
      // ユーザーの投稿数を取得
      const { count: topics } = await supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      // ユーザーが受け取ったいいね数を取得（话题の点赞数 + コメントの点赞数）
      let totalLikes = 0;
      
      // 1. 用户话题获得的点赞数
      const { data: userTopics } = await supabase
        .from('topics')
        .select('id')
        .eq('user_id', user.id);
      
      if (userTopics && userTopics.length > 0) {
        const topicIds = userTopics.map(t => t.id);
        
        // 统计用户话题的点赞数
        const { count: topicLikes } = await supabase
          .from('topic_likes')
          .select('*', { count: 'exact', head: true })
          .in('topic_id', topicIds);
        
        totalLikes += topicLikes || 0;
      }
      
      // 2. 用户所有评论获得的点赞数
      const { data: userComments } = await supabase
        .from('comments')
        .select('id')
        .eq('user_id', user.id);
      
      if (userComments && userComments.length > 0) {
        const commentIds = userComments.map(c => c.id);
        const { count: commentLikes } = await supabase
          .from('comment_likes')
          .select('*', { count: 'exact', head: true })
          .in('comment_id', commentIds);
        
        totalLikes += commentLikes || 0;
      }
      
      setLikeCount(totalLikes);
      
      // ユーザーの収藏数を取得
      const { count: favorites } = await supabase
        .from('topic_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      setTopicCount(topics || 0);
      setFavoriteCount(favorites || 0);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const handleAvatarChange = async (newAvatarUrl: string) => {
    try {
      await updateAvatar(newAvatarUrl);
    } catch (error) {
      // 错误处理已在updateAvatar中完成
    }
  };
  
  const handleLogout = () => {
    Alert.alert(
      "ログアウト",
      "本当にログアウトしますか？",
      [
        {
          text: "キャンセル",
          style: "cancel"
        },
        {
          text: "ログアウト",
          onPress: logout,
          style: "destructive"
        }
      ]
    );
  };
  
  const menuItems = [
    {
      icon: <Settings size={20} color="#007AFF" />,
      title: "アカウント設定",
      onPress: () => {}
    },
    {
      icon: <MapPin size={20} color="#34C759" />,
      title: "位置情報設定",
      onPress: () => {}
    },
    {
      icon: <Bell size={20} color="#FF9500" />,
      title: "通知設定",
      onPress: () => {}
    },
    {
      icon: <Shield size={20} color="#5856D6" />,
      title: "プライバシー設定",
      onPress: () => {}
    },
    {
      icon: <HelpCircle size={20} color="#FF3B30" />,
      title: "ヘルプとサポート",
      onPress: () => {}
    }
  ];
  
  return (
    <View style={styles.container}>
      <CustomHeader
        title="プロフィール"
        subtitle={`👋 おかえりなさい、${user?.name || 'LocalTalkユーザー'}さん`}
      />
      
      <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
        <ScrollView>
          <View style={styles.profileHeader}>
            <View style={styles.profileSection}>
              <AvatarPicker
                currentAvatarUrl={user?.avatar}
                userId={user?.id || ''}
                onAvatarChange={handleAvatarChange}
                size={120}
                editable={true}
              />
              <Text style={styles.name}>{user?.name}</Text>
              <Text style={styles.email}>{user?.email || "メールアドレスなし"}</Text>
              
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <MessageSquare size={20} color={Colors.text.secondary} />
                  <Text style={styles.statNumber}>{topicCount}</Text>
                  <Text style={styles.statLabel}>投稿</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Heart size={20} color={Colors.text.secondary} />
                  <Text style={styles.statNumber}>{likeCount}</Text>
                  <Text style={styles.statLabel}>いいね</Text>
                </View>
                <View style={styles.statDivider} />
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => router.push('/favorites')}
                  activeOpacity={0.7}
                >
                  <Bookmark size={20} color={Colors.text.secondary} />
                  <Text style={styles.statNumber}>{favoriteCount}</Text>
                  <Text style={styles.statLabel}>収藏</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          <View style={styles.menuSection}>
            {menuItems.map((item, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuIcon}>
                  {item.icon}
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LogOut size={20} color={Colors.error} />
            <Text style={styles.logoutText}>ログアウト</Text>
          </TouchableOpacity>
          
          <Text style={styles.versionText}>バージョン 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    backgroundColor: '#F8F9FA',
    paddingBottom: 24,
    marginBottom: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    padding: 24,
    paddingBottom: 0,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  menuSection: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  menuTitle: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: '#FFEBEE',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.error,
    marginLeft: 8,
  },
  versionText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: "center",
    marginBottom: 24,
  },
});