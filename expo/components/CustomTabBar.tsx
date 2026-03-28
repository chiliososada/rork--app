import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Compass, PlusCircle, MessageCircle, User } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRouter, usePathname } from 'expo-router';
import { useChatStore } from '@/store/chat-store';
import { useChatTopicsStore } from '@/store/chat-topics-store';

const CustomTabBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { getUnreadCount } = useChatStore();
  const { filteredTopics } = useChatTopicsStore();
  
  // Calculate total unread count across all topics (only from chat page)
  const totalUnreadCount = filteredTopics.reduce((total, topic) => {
    return total + getUnreadCount(topic.id);
  }, 0);

  const tabs = [
    {
      name: 'index',
      title: '近く',
      icon: MapPin,
      path: '/(tabs)',
    },
    {
      name: 'explore',
      title: '探索',
      icon: Compass,
      path: '/(tabs)/explore',
    },
    {
      name: 'create',
      title: '作成',
      icon: PlusCircle,
      path: '/create-topic',
      isSpecial: true,
    },
    {
      name: 'chats',
      title: 'チャット',
      icon: MessageCircle,
      path: '/(tabs)/chats',
    },
    {
      name: 'profile',
      title: 'プロフィール',
      icon: User,
      path: '/(tabs)/profile',
    },
  ];

  const isActive = (_path: string, name: string) => {
    // Normalize pathname - remove trailing slashes and handle variations
    const normalizedPath = pathname.replace(/\/$/, '');
    
    // Handle index/home page
    if (name === 'index') {
      return normalizedPath === '' || 
             normalizedPath === '/' || 
             normalizedPath === '/(tabs)' || 
             normalizedPath === '/(tabs)/index' ||
             normalizedPath.endsWith('/index');
    }
    
    // Handle other tabs - check if the pathname includes the tab name
    if (name === 'explore') return normalizedPath.includes('/explore');
    if (name === 'chats') return normalizedPath.includes('/chats');
    if (name === 'profile') return normalizedPath.includes('/profile');
    
    // Handle create button
    if (name === 'create') return normalizedPath.includes('/create-topic');
    
    return false;
  };

  const handlePress = (path: string) => {
    router.push(path as any);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        {tabs.map((tab) => {
          const active = isActive(tab.path, tab.name);
          const Icon = tab.icon;

          if (tab.isSpecial) {
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tab}
                onPress={() => handlePress(tab.path)}
                activeOpacity={0.8}
              >
                <View style={styles.specialButton}>
                  <Icon size={28} color={Colors.text.light} />
                </View>
                <Text style={[styles.specialLabel]}>{tab.title}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => handlePress(tab.path)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, active && styles.activeIconContainer]}>
                <Icon 
                  size={24} 
                  color={active ? Colors.primary : Colors.inactive} 
                />
                {active && <View style={styles.activeDot} />}
                {tab.name === 'chats' && totalUnreadCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {totalUnreadCount > 99 ? '99+' : totalUnreadCount.toString()}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.label,
                active && styles.activeLabel
              ]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    width: 48,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIconContainer: {
    transform: [{ scale: 1.1 }],
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: 11,
    color: Colors.inactive,
    marginTop: 2,
    fontWeight: '500',
  },
  activeLabel: {
    color: Colors.primary,
    fontWeight: '600',
  },
  specialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginTop: -20,
  },
  specialLabel: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.card,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CustomTabBar;