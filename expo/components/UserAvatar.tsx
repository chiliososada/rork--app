import React from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import { Image } from 'expo-image';
import { Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { User, SafeUser } from '@/types';
import { useUserBlockStatus } from '@/hooks/useContentFilter';

interface UserAvatarProps {
  user: User | SafeUser;
  size?: 'small' | 'medium' | 'large' | number;
  style?: ViewStyle;
  showBorder?: boolean;
  borderColor?: string;
  showBlockedIndicator?: boolean; // Whether to show blocked user indicator
  userName?: string; // Optional username for blocked avatar placeholder
}

export default function UserAvatar({ 
  user, 
  size = 'medium', 
  style,
  showBorder = false,
  borderColor = Colors.card,
  showBlockedIndicator = true,
  userName
}: UserAvatarProps) {
  const { isBlocked } = useUserBlockStatus(user.id);
  
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

  // Show blocked indicator if user is blocked
  if (isBlocked && showBlockedIndicator) {
    return (
      <View
        style={[
          styles.container,
          styles.blockedContainer,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius,
          },
          showBorder && {
            borderWidth: 2,
            borderColor: '#8E8E93',
            borderRadius: borderRadius + 2,
          },
          style,
        ]}
      >
        <Shield size={avatarSize * 0.4} color="#8E8E93" />
        {avatarSize >= 40 && (
          <Text style={[styles.blockedText, { fontSize: avatarSize * 0.15 }]}>
            ブロック済み
          </Text>
        )}
      </View>
    );
  }

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
      size={28} 
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
  blockedContainer: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
  },
  blockedText: {
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
});