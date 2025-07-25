import React, { useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Animated
} from 'react-native';
import { CategoryConfig } from '@/types';
import Colors from '@/constants/colors';

interface CategoryTabsProps {
  categories: CategoryConfig[];
  selectedCategory: string;
  onCategorySelect: (categoryKey: string) => void;
}

export default function CategoryTabs({ 
  categories, 
  selectedCategory, 
  onCategorySelect 
}: CategoryTabsProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePress = (categoryKey: string, index: number) => {
    // 动画效果
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    onCategorySelect(categoryKey);
    
    // 滚动到选中的标签
    scrollViewRef.current?.scrollTo({
      x: index * 100 - 50,
      animated: true
    });
  };
  
  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((category, index) => {
          const isSelected = selectedCategory === category.categoryKey;
          const isCommercial = category.commercialPriority > 80;
          
          return (
            <TouchableOpacity
              key={category.categoryKey}
              style={[
                styles.tab,
                isSelected && styles.selectedTab,
                isCommercial && !isSelected && styles.commercialTab
              ]}
              onPress={() => handlePress(category.categoryKey, index)}
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.tabContent,
                  isSelected && { transform: [{ scale: scaleAnim }] }
                ]}
              >
                <Text style={styles.emoji}>{category.iconEmoji}</Text>
                <Text 
                  style={[
                    styles.label,
                    isSelected && styles.selectedLabel,
                    isCommercial && !isSelected && styles.commercialLabel
                  ]}
                >
                  {category.displayName}
                </Text>
              </Animated.View>
              
              {isSelected && (
                <View 
                  style={[
                    styles.indicator,
                    { backgroundColor: category.colorCode }
                  ]} 
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: Colors.card,
    position: 'relative',
    minWidth: 80,
    alignItems: 'center',
  },
  selectedTab: {
    backgroundColor: Colors.primary + '10',
  },
  commercialTab: {
    backgroundColor: '#FFE4B5',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 16,
    marginRight: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  selectedLabel: {
    color: Colors.primary,
    fontWeight: '600',
  },
  commercialLabel: {
    color: '#FF8C00',
  },
  indicator: {
    position: 'absolute',
    bottom: -8,
    left: '20%',
    right: '20%',
    height: 3,
    borderRadius: 2,
  },
});