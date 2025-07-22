import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { User } from '@/types';

interface UserAvatarProps {
  user: User;
  size?: 'small' | 'medium' | 'large' | number;
  style?: ViewStyle;
  showBorder?: boolean;
  borderColor?: string;
}

export default function UserAvatar({ 
  user, 
  size = 'medium', 
  style,
  showBorder = false,
  borderColor = Colors.card
}: UserAvatarProps) {
  
  const getSize = () => {
    if (typeof size === 'number') return size;
    
    switch (size) {
      case 'small':
        return 32;
      case 'medium':
        return 48;
      case 'large':
        return 80;
      default:
        return 48;
    }
  };

  const avatarSize = getSize();
  const borderRadius = avatarSize / 2;

  return (
    <View
      style={[
        styles.container,
        {
          width: avatarSize,
          height: avatarSize,
        },
        showBorder && {
          borderWidth: 2,
          borderColor: borderColor,
          borderRadius: borderRadius + 2,
        },
        style,
      ]}
    >
      <Image
        source={{ uri: user.avatar }}
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius,
          },
        ]}
        contentFit="cover"
        transition={200}
      />
    </View>
  );
}

// 简化的头像显示组件，只需要URL
export function SimpleAvatar({ 
  avatarUrl, 
  size = 40, 
  style,
  showBorder = false,
  borderColor = Colors.card
}: { 
  avatarUrl?: string; 
  size?: number;
  style?: ViewStyle;
  showBorder?: boolean;
  borderColor?: string;
}) {
  const borderRadius = size / 2;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
        },
        showBorder && {
          borderWidth: 2,
          borderColor: borderColor,
          borderRadius: borderRadius + 2,
        },
        style,
      ]}
    >
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
        contentFit="cover"
        transition={200}
      />
    </View>
  );
}

// 用于不同场景的预设头像组件
export function CommentAvatar({ user, style }: { user: User; style?: ViewStyle }) {
  return (
    <UserAvatar 
      user={user} 
      size="small" 
      style={style}
      showBorder={false}
    />
  );
}

export function TopicCardAvatar({ user, style }: { user: User; style?: ViewStyle }) {
  return (
    <UserAvatar 
      user={user} 
      size={24} 
      style={style}
      showBorder={false}
    />
  );
}

export function ChatAvatar({ user, style }: { user: User; style?: ViewStyle }) {
  return (
    <UserAvatar 
      user={user} 
      size="medium" 
      style={style}
      showBorder={true}
      borderColor={Colors.border}
    />
  );
}

export function ProfileAvatar({ user, style }: { user: User; style?: ViewStyle }) {
  return (
    <UserAvatar 
      user={user} 
      size="large" 
      style={style}
      showBorder={true}
      borderColor={Colors.card}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: Colors.border,
  },
});