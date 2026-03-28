import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Camera, Image as ImageIcon, X, Edit3 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { 
  pickAvatarImage, 
  takeAvatarPicture, 
  uploadUserAvatar,
  isDefaultAvatar 
} from '@/lib/avatar-upload';

interface AvatarPickerProps {
  currentAvatarUrl?: string;
  userId: string;
  onAvatarChange?: (newAvatarUrl: string) => void;
  size?: number;
  editable?: boolean;
}

export default function AvatarPicker({
  currentAvatarUrl,
  userId,
  onAvatarChange,
  size = 120,
  editable = true,
}: AvatarPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarPress = () => {
    if (!editable) return;
    
    Alert.alert(
      'プロフィール写真を変更',
      '写真の取得方法を選択してください',
      [
        {
          text: 'カメラで撮影',
          onPress: () => handleTakePhoto(),
        },
        {
          text: 'フォトライブラリから選択',
          onPress: () => handlePickImage(),
        },
        {
          text: 'キャンセル',
          style: 'cancel',
        },
      ]
    );
  };

  const handleTakePhoto = async () => {
    try {
      setUploading(true);
      const result = await takeAvatarPicture();
      
      if (result && !result.canceled && result.assets?.[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert(
        'エラー',
        error.message || 'カメラでの撮影に失敗しました。',
        [{ text: 'OK' }]
      );
    } finally {
      setUploading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      setUploading(true);
      const result = await pickAvatarImage();
      
      if (result && !result.canceled && result.assets?.[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert(
        'エラー',
        error.message || '写真の選択に失敗しました。',
        [{ text: 'OK' }]
      );
    } finally {
      setUploading(false);
    }
  };

  const uploadAvatar = async (imageUri: string) => {
    try {
      // 如果当前头像不是默认头像，传递给上传函数以便删除旧文件
      const oldAvatarUrl = currentAvatarUrl && !isDefaultAvatar(currentAvatarUrl) 
        ? currentAvatarUrl 
        : undefined;
      
      const result = await uploadUserAvatar(imageUri, userId, oldAvatarUrl);
      onAvatarChange?.(result.url);
      
      Alert.alert(
        '成功',
        'プロフィール写真を更新しました！',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert(
        'アップロードエラー',
        error.message || 'アバターのアップロードに失敗しました。',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <TouchableOpacity
        style={[styles.avatarContainer, { width: size, height: size }]}
        onPress={handleAvatarPress}
        disabled={!editable || uploading}
        activeOpacity={0.8}
      >
        {/* 头像图片 */}
        <Image
          source={{ uri: currentAvatarUrl }}
          style={[styles.avatar, { width: size, height: size }]}
          contentFit="cover"
          transition={200}
        />
        
        {/* 上传状态遮罩 */}
        {uploading && (
          <View style={[styles.uploadingOverlay, { width: size, height: size }]}>
            <ActivityIndicator size="large" color={Colors.card} />
            <Text style={styles.uploadingText}>アップロード中...</Text>
          </View>
        )}
        
      </TouchableOpacity>
      
      {/* 编辑图标 - 移到容器外部避免被裁剪 */}
      {editable && !uploading && (
        <View style={styles.editIcon}>
          <Edit3 size={16} color={Colors.card} />
        </View>
      )}
    </View>
  );
}

// 简化版的头像显示组件（不可编辑）
export function Avatar({ 
  avatarUrl, 
  size = 40, 
  style 
}: { 
  avatarUrl?: string; 
  size?: number; 
  style?: any;
}) {
  return (
    <Image
      source={{ uri: avatarUrl }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: Colors.border,
        },
        style,
      ]}
      contentFit="cover"
      transition={200}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatarContainer: {
    borderRadius: 60, // 默认为size的一半，但会被动态调整
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 4,
    borderColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    borderRadius: 60,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
  },
  uploadingText: {
    color: Colors.card,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
});