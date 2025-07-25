import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, Alert } from 'react-native';
import { UserPlus, UserCheck, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFollowStore } from '@/store/follow-store';
import { useAuthStore } from '@/store/auth-store';

interface FollowButtonProps {
  targetUserId: string;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  style?: any;
  showConfirmUnfollow?: boolean;
  targetUserName?: string;
  isFollowedBy?: boolean;
}

export default function FollowButton({ 
  targetUserId, 
  size = 'medium',
  showIcon = true,
  onFollowChange,
  style,
  showConfirmUnfollow = true,
  targetUserName,
  isFollowedBy = false
}: FollowButtonProps) {
  const { user } = useAuthStore();
  const { followStatus, isTogglingFollow, toggleFollow, fetchFollowStatus } = useFollowStore();
  const [localIsFollowing, setLocalIsFollowing] = useState(false);

  const status = followStatus.get(targetUserId);
  const isFollowing = status?.isFollowing || localIsFollowing;
  const isActuallyFollowedBy = status?.isFollowedBy || isFollowedBy;
  const isMutualFollow = isFollowing && isActuallyFollowedBy;

  useEffect(() => {
    if (user?.id && targetUserId && user.id !== targetUserId) {
      fetchFollowStatus(user.id, [targetUserId]);
    }
  }, [user?.id, targetUserId]);

  useEffect(() => {
    if (status) {
      setLocalIsFollowing(status.isFollowing);
    }
  }, [status]);

  const handleToggleFollow = async () => {
    if (!user?.id || user.id === targetUserId || isTogglingFollow) return;

    // フォロー解除の場合は確認ダイアログを表示
    if (isFollowing && showConfirmUnfollow) {
      Alert.alert(
        'フォロー解除',
        `${targetUserName || 'このユーザー'}の${isMutualFollow ? '相互フォロー' : 'フォロー'}を解除しますか？`,
        [
          {
            text: 'キャンセル',
            style: 'cancel',
          },
          {
            text: 'フォロー解除',
            style: 'destructive',
            onPress: async () => {
              await performToggleFollow();
            },
          },
        ],
        { cancelable: true }
      );
    } else {
      await performToggleFollow();
    }
  };

  const performToggleFollow = async () => {
    // 楽観的更新
    setLocalIsFollowing(!isFollowing);

    const newFollowState = await toggleFollow(user.id, targetUserId);
    
    if (onFollowChange) {
      onFollowChange(newFollowState);
    }

    // エラーが発生した場合は元に戻す
    if (newFollowState !== !isFollowing) {
      setLocalIsFollowing(isFollowing);
    }
  };

  // 自分自身の場合は表示しない
  if (!user?.id || user.id === targetUserId) {
    return null;
  }

  const sizeStyles = {
    small: {
      button: styles.buttonSmall,
      text: styles.textSmall,
      iconSize: 14
    },
    medium: {
      button: styles.buttonMedium,
      text: styles.textMedium,
      iconSize: 16
    },
    large: {
      button: styles.buttonLarge,
      text: styles.textLarge,
      iconSize: 20
    }
  };

  const currentSize = sizeStyles[size];
  let Icon = UserPlus;
  let buttonText = 'フォロー';
  let buttonStyle = styles.followButton;
  let textStyle = styles.followText;
  
  if (isFollowing) {
    if (isMutualFollow) {
      Icon = Users;
      buttonText = '相互フォロー中';
      buttonStyle = styles.mutualFollowButton;
      textStyle = styles.mutualFollowText;
    } else {
      Icon = UserCheck;
      buttonText = 'フォロー中';
      buttonStyle = styles.followingButton;
      textStyle = styles.followingText;
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        currentSize.button,
        buttonStyle,
        style
      ]}
      onPress={handleToggleFollow}
      disabled={isTogglingFollow}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {isTogglingFollow ? (
          <ActivityIndicator 
            size="small" 
            color={isMutualFollow ? '#FFFFFF' : (isFollowing ? Colors.primary : '#FFFFFF')} 
          />
        ) : (
          <>
            {showIcon && (
              <Icon 
                size={currentSize.iconSize} 
                color={isMutualFollow ? '#FFFFFF' : (isFollowing ? Colors.primary : '#FFFFFF')}
                style={styles.icon}
              />
            )}
            <Text style={[
              currentSize.text,
              textStyle
            ]}>
              {buttonText}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  buttonMedium: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonLarge: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  followButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  followingButton: {
    backgroundColor: Colors.background,
    borderColor: Colors.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 4,
  },
  textSmall: {
    fontSize: 12,
    fontWeight: '600',
  },
  textMedium: {
    fontSize: 14,
    fontWeight: '600',
  },
  textLarge: {
    fontSize: 16,
    fontWeight: '600',
  },
  followText: {
    color: '#FFFFFF',
  },
  followingText: {
    color: Colors.primary,
  },
  mutualFollowButton: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  mutualFollowText: {
    color: '#FFFFFF',
  },
});