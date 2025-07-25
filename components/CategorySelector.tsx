import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

interface CategoryConfig {
  categoryKey: string;
  displayName: string;
  iconEmoji: string;
  colorCode: string;
  commercialPriority: number;
}

interface CategorySelectorProps {
  selectedCategory?: string;
  onCategoryChange: (categoryKey: string) => void;
  autoSelected?: boolean; // 是否自动选择了分类
}

export default function CategorySelector({ 
  selectedCategory, 
  onCategoryChange,
  autoSelected = false
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('category_configs')
        .select('*')
        .eq('is_active', true)
        .neq('category_key', 'recommended') // 排除"推荐"分类
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const categoryConfigs = data?.map(cat => ({
        categoryKey: cat.category_key,
        displayName: cat.display_name,
        iconEmoji: cat.icon_emoji,
        colorCode: cat.color_code,
        commercialPriority: cat.commercial_priority
      })) || [];

      setCategories(categoryConfigs);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategorySelect = (categoryKey: string) => {
    onCategoryChange(categoryKey);
    setShowDropdown(false);
  };

  const selectedCategoryConfig = categories.find(cat => cat.categoryKey === selectedCategory);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>カテゴリー</Text>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>カテゴリー</Text>
        {autoSelected && (
          <Text style={styles.autoLabel}>自動選択</Text>
        )}
      </View>
      
      <TouchableOpacity
        style={[
          styles.selector,
          showDropdown && styles.selectorOpen,
          selectedCategory && styles.selectorSelected
        ]}
        onPress={() => setShowDropdown(!showDropdown)}
      >
        <View style={styles.selectorContent}>
          {selectedCategoryConfig ? (
            <View style={styles.selectedCategory}>
              <Text style={styles.emoji}>{selectedCategoryConfig.iconEmoji}</Text>
              <Text style={styles.selectedText}>{selectedCategoryConfig.displayName}</Text>
            </View>
          ) : (
            <Text style={styles.placeholder}>カテゴリーを選択</Text>
          )}
        </View>
        <ChevronDown 
          size={16} 
          color={Colors.text.secondary}
          style={[
            styles.chevron,
            showDropdown && styles.chevronOpen
          ]}
        />
      </TouchableOpacity>

      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
            {categories.map((category) => {
              const isSelected = category.categoryKey === selectedCategory;
              return (
                <TouchableOpacity
                  key={category.categoryKey}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleCategorySelect(category.categoryKey)}
                >
                  <View style={styles.optionContent}>
                    <Text style={styles.emoji}>{category.iconEmoji}</Text>
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected
                    ]}>
                      {category.displayName}
                    </Text>
                  </View>
                  {isSelected && (
                    <Check size={16} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  autoLabel: {
    fontSize: 12,
    color: Colors.primary,
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorOpen: {
    borderColor: Colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  selectorSelected: {
    borderColor: Colors.primary,
  },
  selectorContent: {
    flex: 1,
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 16,
    marginRight: 8,
  },
  selectedText: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  placeholder: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  dropdown: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionSelected: {
    backgroundColor: Colors.primary + '08',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: '500',
  },
});