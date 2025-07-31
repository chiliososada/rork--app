import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Bell, 
  MessageSquare, 
  Heart, 
  MessageCircle, 
  Users, 
  X,
  ChevronRight
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { AppNotification } from '@/store/push-notification-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOAST_HEIGHT = 80;
const ANIMATION_DURATION = 300;
const AUTO_HIDE_DURATION = 4000;

interface ToastNotificationProps {
  notification: AppNotification | null;
  onPress?: () => void;
  onDismiss?: () => void;
}

const getNotificationIcon = (type: AppNotification['type']) => {
  switch (type) {
    case 'message':
      return <MessageSquare size={20} color="#007AFF" />;
    case 'like':
      return <Heart size={20} color="#FF3B30" />;
    case 'comment':
      return <MessageCircle size={20} color="#34C759" />;
    case 'follow':
      return <Users size={20} color="#5856D6" />;
    case 'system':
      return <Bell size={20} color="#FF9500" />;
    default:
      return <Bell size={20} color="#8E8E93" />;
  }
};

export default function ToastNotification({ 
  notification, 
  onPress, 
  onDismiss 
}: ToastNotificationProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-TOAST_HEIGHT - insets.top)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const autoHideTimer = useRef<TimerHandle | null>(null);

  useEffect(() => {
    if (notification) {
      showToast();
      startAutoHideTimer();
    } else {
      hideToast();
      clearAutoHideTimer();
    }

    return () => {
      clearAutoHideTimer();
    };
  }, [notification]);

  const showToast = () => {
    clearAutoHideTimer();
    
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: insets.top,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -TOAST_HEIGHT - insets.top,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startAutoHideTimer = () => {
    clearAutoHideTimer();
    autoHideTimer.current = setTimeout(() => {
      handleDismiss();
    }, AUTO_HIDE_DURATION);
  };

  const clearAutoHideTimer = () => {
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
      autoHideTimer.current = null;
    }
  };

  const handlePress = () => {
    clearAutoHideTimer();
    onPress?.();
  };

  const handleDismiss = () => {
    clearAutoHideTimer();
    onDismiss?.();
  };

  if (!notification) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
          top: 0,
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          {getNotificationIcon(notification.type)}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
        
        <View style={styles.actionContainer}>
          <ChevronRight size={16} color={Colors.text.secondary} />
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={16} color={Colors.text.secondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 999,
    paddingHorizontal: 16,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: Platform.OS === 'ios' ? 8 : 4,
    },
    shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0.25,
    shadowRadius: Platform.OS === 'ios' ? 12 : 8,
    elevation: Platform.OS === 'android' ? 8 : 0,
    borderWidth: Platform.OS === 'android' ? 1 : 0,
    borderColor: Platform.OS === 'android' ? Colors.border : 'transparent',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  actionContainer: {
    paddingLeft: 4,
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
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