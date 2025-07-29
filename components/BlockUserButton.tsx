import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  View,
} from 'react-native';
import { Shield, ShieldOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUserBlocking } from '@/store/blocking-store';
import { useAuthStore } from '@/store/auth-store';

interface BlockUserButtonProps {
  userId: string;
  userName: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'minimal';
  showText?: boolean;
  onBlockChange?: (isBlocked: boolean) => void;
}

export default function BlockUserButton({
  userId,
  userName,
  size = 'medium',
  variant = 'primary',
  showText = true,
  onBlockChange,
}: BlockUserButtonProps) {
  const { user: currentUser } = useAuthStore();
  const {
    isUserBlockedSync,
    blockUserWithConfirmation,
    unblockUserWithConfirmation,
    isUserBlocked,
    loadBlockedUsers,
  } = useUserBlocking();

  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Don't show button for self
  if (!currentUser || currentUser.id === userId) {
    return null;
  }

  // Initialize block status
  useEffect(() => {
    const initializeBlockStatus = async () => {
      setIsInitializing(true);
      
      // First check sync state (faster)
      const syncBlocked = isUserBlockedSync(userId);
      setIsBlocked(syncBlocked);
      
      // Then check with server (more accurate)
      try {
        await loadBlockedUsers(currentUser.id);
        const blockStatus = await isUserBlocked(currentUser.id, userId);
        const actuallyBlocked = blockStatus.is_any_blocked;
        
        if (actuallyBlocked !== syncBlocked) {
          setIsBlocked(actuallyBlocked);
        }
      } catch (error) {
        console.error('Error checking block status:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeBlockStatus();
  }, [userId, currentUser.id]);

  const handleBlockToggle = async () => {
    if (isLoading) return;
    
    setIsLoading(true);

    try {
      if (isBlocked) {
        // Unblock user
        Alert.alert(
          'ブロック解除',
          `${userName}さんのブロックを解除しますか？\n\nブロックを解除すると：\n• この人の投稿やコメントが再び表示されます\n• この人があなたをフォローできるようになります\n• チャットでメッセージのやり取りができるようになります`,
          [
            {
              text: 'キャンセル',
              style: 'cancel',
              onPress: () => setIsLoading(false),
            },
            {
              text: 'ブロック解除',
              style: 'default',
              onPress: async () => {
                const success = await unblockUserWithConfirmation(userId, userName);
                if (success) {
                  setIsBlocked(false);
                  onBlockChange?.(false);
                }
                setIsLoading(false);
              },
            },
          ]
        );
      } else {
        // Block user
        Alert.alert(
          'ユーザーをブロック',
          `${userName}さんをブロックしますか？\n\nブロックすると：\n• この人の投稿やコメントが表示されなくなります\n• この人があなたをフォローできなくなります\n• お互いのチャット履歴が非表示になります\n• フォロー関係がある場合は解除されます`,
          [
            {
              text: 'キャンセル',
              style: 'cancel',
              onPress: () => setIsLoading(false),
            },
            {
              text: 'ブロックする',
              style: 'destructive',
              onPress: () => {
                Alert.prompt(
                  'ブロック理由（任意）',
                  'ブロックの理由を入力してください（空欄でも構いません）',
                  [
                    {
                      text: 'キャンセル',
                      style: 'cancel',
                      onPress: () => setIsLoading(false),
                    },
                    {
                      text: 'ブロックする',
                      style: 'destructive',
                      onPress: async (reason) => {
                        const success = await blockUserWithConfirmation(
                          userId, 
                          userName, 
                          reason || undefined
                        );
                        if (success) {
                          setIsBlocked(true);
                          onBlockChange?.(true);
                        }
                        setIsLoading(false);
                      },
                    },
                  ],
                  'plain-text',
                  '',
                  '不適切な行為、スパム、ハラスメント等'
                );
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error in block toggle:', error);
      Alert.alert('エラー', 'ブロック操作に失敗しました。もう一度お試しください。');
      setIsLoading(false);
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          button: { paddingVertical: 6, paddingHorizontal: 12 },
          text: { fontSize: 12 },
          icon: 16,
        };
      case 'large':
        return {
          button: { paddingVertical: 12, paddingHorizontal: 20 },
          text: { fontSize: 16 },
          icon: 22,
        };
      default: // medium
        return {
          button: { paddingVertical: 8, paddingHorizontal: 16 },
          text: { fontSize: 14 },
          icon: 18,
        };
    }
  };

  const getVariantStyles = () => {
    if (isBlocked) {
      return {
        container: styles.unblockedContainer,
        text: styles.unblockedText,
        iconColor: '#34C759',
      };
    }

    switch (variant) {
      case 'secondary':
        return {
          container: styles.secondaryContainer,
          text: styles.secondaryText,
          iconColor: Colors.text.secondary,
        };
      case 'minimal':
        return {
          container: styles.minimalContainer,
          text: styles.minimalText,
          iconColor: Colors.text.secondary,
        };
      default: // primary
        return {
          container: styles.primaryContainer,
          text: styles.primaryText,
          iconColor: '#FFFFFF',
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  if (isInitializing) {
    return (
      <View style={[styles.container, variantStyles.container, sizeStyles.button]}>
        <ActivityIndicator size="small" color={variantStyles.iconColor} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, variantStyles.container, sizeStyles.button]}
      onPress={handleBlockToggle}
      disabled={isLoading}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={variantStyles.iconColor} />
      ) : (
        <>
          {isBlocked ? (
            <ShieldOff size={sizeStyles.icon} color={variantStyles.iconColor} />
          ) : (
            <Shield size={sizeStyles.icon} color={variantStyles.iconColor} />
          )}
          {showText && (
            <Text style={[styles.text, variantStyles.text, sizeStyles.text]}>
              {isBlocked ? 'ブロック解除' : 'ブロック'}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    minWidth: 44,
  },
  text: {
    fontWeight: '600',
    marginLeft: 6,
  },
  
  // Primary variant (blocked state)
  primaryContainer: {
    backgroundColor: '#FF3B30',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  
  // Secondary variant
  secondaryContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryText: {
    color: Colors.text.secondary,
  },
  
  // Minimal variant
  minimalContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  minimalText: {
    color: Colors.text.secondary,
  },
  
  // Unblocked state (green, indicates blocked)
  unblockedContainer: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  unblockedText: {
    color: '#2E7D32',
  },
});