import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface CategoryBadgeProps {
  category?: string;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

// カテゴリー名の変換とスタイル定義
const getCategoryInfo = (category: string) => {
  const categoryMap: { [key: string]: { displayName: string; color: string; icon: string } } = {
    recommended: {
      displayName: 'おすすめ',
      color: '#FF6B6B',
      icon: '✨'
    },
    nearby: {
      displayName: '近くの話題',
      color: '#4ECDC4',
      icon: '📍'
    },
    trending: {
      displayName: 'トレンド',
      color: '#FFE66D',
      icon: '🔥'
    },
    new: {
      displayName: '新着',
      color: '#95E1D3',
      icon: '🆕'
    },
    food: {
      displayName: 'グルメ',
      color: '#F38181',
      icon: '🍽️'
    },
    event: {
      displayName: 'イベント',
      color: '#AA96DA',
      icon: '🎉'
    },
    shopping: {
      displayName: 'ショッピング',
      color: '#FCBAD3',
      icon: '🛍️'
    },
    work: {
      displayName: '仕事',
      color: '#3B82F6',
      icon: '💼'
    },
    lifestyle: {
      displayName: 'ライフスタイル',
      color: '#059669',
      icon: '🌿'
    },
    social: {
      displayName: '交流',
      color: '#7C3AED',
      icon: '👥'
    },
    default: {
      displayName: 'その他',
      color: '#6B7280',
      icon: '📌'
    }
  };

  return categoryMap[category?.toLowerCase()] || categoryMap.default;
};

export default function CategoryBadge({ category, size = 'medium', style }: CategoryBadgeProps) {
  if (!category) return null;

  const categoryInfo = getCategoryInfo(category);
  
  const sizeStyles = {
    small: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 10,
      borderRadius: 10,
    },
    medium: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      fontSize: 12,
      borderRadius: 14,
    },
    large: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      fontSize: 14,
      borderRadius: 16,
    }
  };

  const currentSizeStyle = sizeStyles[size];

  return (
    <View 
      style={[
        styles.badge,
        {
          backgroundColor: categoryInfo.color + '20', // 20% opacity
          paddingHorizontal: currentSizeStyle.paddingHorizontal,
          paddingVertical: currentSizeStyle.paddingVertical,
          borderRadius: currentSizeStyle.borderRadius,
        },
        style
      ]}
    >
      <Text 
        style={[
          styles.badgeText,
          {
            color: categoryInfo.color,
            fontSize: currentSizeStyle.fontSize,
          }
        ]}
      >
        {categoryInfo.icon} {categoryInfo.displayName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeText: {
    fontWeight: '600',
    lineHeight: 16,
  },
});