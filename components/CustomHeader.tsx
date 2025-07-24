import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface CustomHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  showLocationRefresh?: boolean;
  onLocationRefresh?: () => void;
  isLocationRefreshing?: boolean;
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
}: CustomHeaderProps) {
  const insets = useSafeAreaInsets();
  
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
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
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