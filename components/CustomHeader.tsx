import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';

interface CustomHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  showLocationRefresh?: boolean;
  onLocationRefresh?: () => void;
  isLocationRefreshing?: boolean;
  showGreeting?: boolean; // 是否显示问候语
}

export default function CustomHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightElement,
  showLocationRefresh = false,
  onLocationRefresh,
  isLocationRefreshing = false,
  showGreeting = false,
}: CustomHeaderProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  // 获取当前时间的问候语，支持用户名
  const getGreeting = (userName?: string) => {
    const hour = new Date().getHours();
    let greeting = '';
    if (hour < 10) {
      greeting = 'おはよう';
    } else if (hour < 18) {
      greeting = 'こんにちは';
    } else {
      greeting = 'こんばんは';
    }
    
    // 如果有用户名，添加用户名和"さん"
    return userName ? `${userName}さん、${greeting}` : greeting;
  };
  
  // 创建动画值用于刷新按钮旋转
  const [rotateAnim] = React.useState(new Animated.Value(0));
  
  // 当刷新状态改变时启动/停止动画
  React.useEffect(() => {
    if (isLocationRefreshing) {
      // 开始旋转动画
      const rotate = () => {
        rotateAnim.setValue(0);
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }).start(() => {
          if (isLocationRefreshing) {
            rotate(); // 循环动画
          }
        });
      };
      rotate();
    }
  }, [isLocationRefreshing, rotateAnim]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {showBack && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={onBack}
          >
            <ChevronLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        )}
        
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {showGreeting && (
              <Text style={styles.greeting}>{getGreeting(user?.name)}</Text>
            )}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        
        <View style={styles.rightContainer}>
          {showLocationRefresh && (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onLocationRefresh}
              disabled={isLocationRefreshing}
              activeOpacity={0.7}
            >
              <Animated.View
                style={{
                  transform: [{
                    rotate: rotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    })
                  }]
                }}
              >
                <RefreshCw 
                  size={18} 
                  color={isLocationRefreshing ? Colors.primary : Colors.text.secondary} 
                />
              </Animated.View>
            </TouchableOpacity>
          )}
          {rightElement}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
    paddingLeft: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 4,
  },
});