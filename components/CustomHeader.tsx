import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Settings, Search } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface CustomHeaderProps {
  title: string;
  subtitle?: string;
  showNotification?: boolean;
  showSettings?: boolean;
  showSearch?: boolean;
  onNotificationPress?: () => void;
  onSettingsPress?: () => void;
  onSearchPress?: () => void;
}

export default function CustomHeader({
  title,
  subtitle,
  showNotification = true,
  showSettings = false,
  showSearch = false,
  onNotificationPress,
  onSettingsPress,
  onSearchPress,
}: CustomHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        
        <View style={styles.actionContainer}>
          {showSearch && (
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={onSearchPress}
            >
              <Search size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          )}
          
          {showNotification && (
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={onNotificationPress}
            >
              <Bell size={24} color={Colors.text.secondary} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          )}
          
          {showSettings && (
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={onSettingsPress}
            >
              <Settings size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
});