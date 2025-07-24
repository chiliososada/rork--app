import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Image } from 'expo-image';
import { ImageIcon } from 'lucide-react-native';
import { Topic } from '@/types';
import Colors from '@/constants/colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TopicImageProps {
  topic: Topic;
  size?: 'small' | 'medium' | 'large' | 'full';
  style?: any;
  borderRadius?: number;
  showPlaceholder?: boolean;
}


export default function TopicImage({ 
  topic, 
  size = 'medium', 
  style,
  borderRadius = 12,
  showPlaceholder = false 
}: TopicImageProps) {
  // If no image and placeholder is disabled, return null
  if (!topic.imageUrl && !showPlaceholder) {
    return null;
  }

  const getImageDimensions = () => {
    // 如果有原图尺寸信息，优先使用
    if (topic.originalWidth && topic.originalHeight) {
      const originalRatio = topic.originalWidth / topic.originalHeight;
      
      let maxWidth: number;
      switch (size) {
        case 'small':
          maxWidth = 80;
          break;
        case 'medium':
          maxWidth = 120;
          break;
        case 'large':
          maxWidth = screenWidth - 48; // Account for padding
          break;
        case 'full':
          maxWidth = screenWidth;
          break;
        default:
          maxWidth = 120;
      }
      
      // 保持原图比例，但限制最大宽度
      let width = Math.min(topic.originalWidth, maxWidth);
      let height = width / originalRatio;
      
      // 为large尺寸设置最大高度，避免图片过长
      if (size === 'large') {
        const maxHeight = Math.min(screenHeight * 0.6, screenWidth * 1.5); // 最大高度为屏幕高度的60%或屏幕宽度的1.5倍，取较小值
        if (height > maxHeight) {
          height = maxHeight;
          width = height * originalRatio;
        }
      }
      
      return { width, height };
    }
    
    // 回退到原有逻辑（用于兼容旧数据）
    const aspectRatio = topic.aspectRatio || '1:1';
    let baseWidth: number;
    
    switch (size) {
      case 'small':
        baseWidth = 80;
        break;
      case 'medium':
        baseWidth = 120;
        break;
      case 'large':
        baseWidth = screenWidth - 48;
        break;
      case 'full':
        baseWidth = screenWidth;
        break;
      default:
        baseWidth = 120;
    }

    let height: number;
    switch (aspectRatio) {
      case '1:1':
        height = baseWidth;
        break;
      case '4:5':
        height = baseWidth * 1.25;
        break;
      case '1.91:1':
        height = baseWidth / 1.91;
        break;
      default:
        height = baseWidth;
    }

    return { width: baseWidth, height };
  };

  const { width, height } = getImageDimensions();

  if (!topic.imageUrl && showPlaceholder) {
    return (
      <View
        style={[
          styles.placeholder,
          {
            width,
            height,
            borderRadius,
          },
          style,
        ]}
      >
        <ImageIcon size={width * 0.3} color={Colors.text.secondary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Image
        source={{ uri: topic.imageUrl }}
        style={styles.image}
        contentFit="contain"
        transition={200}
      />
    </View>
  );
}

// Helper component for topic cards that need consistent image sizing
export function TopicCardImage({ topic, style }: { topic: Topic; style?: any }) {
  if (!topic.imageUrl) return null;
  
  return (
    <TopicImage
      topic={topic}
      size="large"
      style={[styles.cardImage, style]}
      borderRadius={12}
    />
  );
}

// Helper component for topic list items
export function TopicListImage({ topic, style }: { topic: Topic; style?: any }) {
  if (!topic.imageUrl) return null;
  
  return (
    <TopicImage
      topic={topic}
      size="medium"
      style={[styles.listImage, style]}
      borderRadius={8}
    />
  );
}

// Helper component for topic thumbnails (like in maps)
export function TopicThumbnail({ topic, style }: { topic: Topic; style?: any }) {
  return (
    <TopicImage
      topic={topic}
      size="small"
      style={[styles.thumbnail, style]}
      borderRadius={6}
      showPlaceholder
    />
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listImage: {
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnail: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
});