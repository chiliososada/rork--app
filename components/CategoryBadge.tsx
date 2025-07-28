import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { useCategoryConfigs } from '@/hooks/useCategoryConfigs';

interface CategoryBadgeProps {
  category?: string;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export default function CategoryBadge({ category, size = 'medium', style }: CategoryBadgeProps) {
  const { getCategoryByKey, isLoading } = useCategoryConfigs();
  
  if (!category || isLoading) return null;

  const categoryInfo = getCategoryByKey(category);
  
  // カテゴリが無効な場合は非表示
  if (!categoryInfo) return null;
  
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
          backgroundColor: categoryInfo.colorCode + '20', // 20% opacity
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
            color: categoryInfo.colorCode,
            fontSize: currentSizeStyle.fontSize,
          }
        ]}
      >
        {categoryInfo.iconEmoji} {categoryInfo.displayName}
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