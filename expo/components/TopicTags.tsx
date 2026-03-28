import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Colors from '@/constants/colors';

interface TopicTagsProps {
  tags?: string[];
  maxVisible?: number;
  style?: any;
}

// 标签颜色系统 - 基于商业价值分层
const getTagStyle = (tag: string) => {
  // 高商业价值标签 - 暖色系
  const highValueTags = ['仕事中', '転職', '住まい', 'マネー', '投資', '起業', '副業', '不動産'];
  // 中等商业价值标签 - 活跃色系  
  const mediumValueTags = ['食事中', 'グルメ', 'ショッピング', '買い物', 'イベント', '旅行', '美容', 'ファッション'];
  // 生活类标签 - 清淡色系
  const lifestyleTags = ['移動中', '休憩中', '勉強中', '運動中', '読書', '音楽', '映画', 'ゲーム'];
  // 社交类标签 - 温和色系
  const socialTags = ['雑談', '日常', '相談', '質問', 'みんなで', '一緒に', '友達'];
  
  if (highValueTags.some(t => tag.includes(t))) {
    return {
      backgroundColor: '#3B82F6', // 蓝色 - 专业感
      textColor: '#FFFFFF',
      priority: 4
    };
  }
  
  if (mediumValueTags.some(t => tag.includes(t))) {
    return {
      backgroundColor: '#DC2626', // 红色 - 活跃感
      textColor: '#FFFFFF', 
      priority: 3
    };
  }
  
  if (lifestyleTags.some(t => tag.includes(t))) {
    return {
      backgroundColor: '#059669', // 绿色 - 生活感
      textColor: '#FFFFFF',
      priority: 2
    };
  }
  
  if (socialTags.some(t => tag.includes(t))) {
    return {
      backgroundColor: '#7C3AED', // 紫色 - 社交感
      textColor: '#FFFFFF',
      priority: 1
    };
  }
  
  // 默认样式
  return {
    backgroundColor: '#6B7280', // 中性灰
    textColor: '#FFFFFF',
    priority: 0
  };
};

// 标签排序 - 按商业价值和优先级
const sortTagsByPriority = (tags: string[]) => {
  return [...tags].sort((a, b) => {
    const styleA = getTagStyle(a);
    const styleB = getTagStyle(b);
    return styleB.priority - styleA.priority;
  });
};

export default function TopicTags({ 
  tags = [], 
  maxVisible = 3, 
  style 
}: TopicTagsProps) {
  // Safe guard against invalid tags data
  const safeTags = (() => {
    if (!tags) return [];
    if (!Array.isArray(tags)) return [];
    return tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0);
  })();

  if (safeTags.length === 0) {
    return null;
  }

  // 对标签按优先级排序
  const sortedTags = sortTagsByPriority(safeTags);
  const visibleTags = sortedTags.slice(0, maxVisible);
  const remainingCount = Math.max(0, sortedTags.length - maxVisible);


  return (
    <View style={[styles.container, style]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {visibleTags.map((tag, index) => {
          const tagStyle = getTagStyle(tag);
          return (
            <View
              key={`${tag}-${index}`}
              style={[
                styles.tag,
                { backgroundColor: tagStyle.backgroundColor }
              ]}
            >
              <Text style={[
                styles.tagText,
                { color: tagStyle.textColor }
              ]}>
                {tag}
              </Text>
            </View>
          );
        })}
        
        {remainingCount > 0 && (
          <View style={[styles.tag, styles.remainingTag]}>
            <Text style={styles.remainingText}>
              +{remainingCount}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    alignItems: 'flex-start',
    paddingRight: 8, // 确保最后一个标签不会被截断
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    minHeight: 24, // 确保触摸目标足够大
    justifyContent: 'center',
    alignItems: 'center',
    // 微妙的阴影效果
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
  remainingTag: {
    backgroundColor: Colors.border,
    borderWidth: 1,
    borderColor: Colors.text.disabled,
  },
  remainingText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.secondary,
    lineHeight: 16,
  },
});