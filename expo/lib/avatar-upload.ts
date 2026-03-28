import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { deleteImageFromSupabase } from './image-upload';

export interface AvatarUploadResult {
  url: string;
}

/**
 * 获取相机和相册权限
 */
export async function requestAvatarPermissions(): Promise<boolean> {
  const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
  const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  return cameraStatus === 'granted' && mediaStatus === 'granted';
}

/**
 * 打开图片选择器（头像专用）
 */
export async function pickAvatarImage(): Promise<ImagePicker.ImagePickerResult | null> {
  const hasPermissions = await requestAvatarPermissions();
  
  if (!hasPermissions) {
    throw new Error('カメラまたはフォトライブラリへのアクセス権限が必要です');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true, // 启用编辑，用户可以裁剪
    aspect: [1, 1], // 强制1:1比例
    quality: 0.8,
  });

  return result.canceled ? null : result;
}

/**
 * 拍摄头像照片
 */
export async function takeAvatarPicture(): Promise<ImagePicker.ImagePickerResult | null> {
  const hasPermissions = await requestAvatarPermissions();
  
  if (!hasPermissions) {
    throw new Error('カメラへのアクセス権限が必要です');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1], // 强制1:1比例
    quality: 0.8,
  });

  return result.canceled ? null : result;
}

/**
 * 处理头像图片（裁剪为正方形并优化尺寸）
 */
export async function processAvatarImage(uri: string): Promise<string> {
  const avatarSize = 300; // 头像标准尺寸
  
  const result = await manipulateAsync(
    uri,
    [
      { resize: { width: avatarSize, height: avatarSize } }
    ],
    {
      compress: 0.8,
      format: SaveFormat.JPEG,
    }
  );
  
  return result.uri;
}

/**
 * 上传头像到Supabase Storage
 */
export async function uploadAvatarToSupabase(
  uri: string,
  userId: string,
  oldAvatarUrl?: string
): Promise<string> {
  try {
    console.log('开始上传头像:', userId);
    
    // 处理头像图片
    const processedUri = await processAvatarImage(uri);
    
    // 使用expo-file-system读取文件为base64
    const base64 = await FileSystem.readAsStringAsync(processedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log('头像文件读取为base64成功');
    
    // 将base64转换为Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 生成文件名：用户ID/avatar_时间戳.jpg
    const timestamp = Date.now();
    const fileName = `${userId}/avatar_${timestamp}.jpg`;
    
    console.log('开始上传头像到Supabase Storage...');
    
    // 上传到Supabase Storage (avatars bucket)
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: false // 使用新文件名，避免缓存问题
      });

    if (error) {
      console.error('Supabase Storage错误:', error);
      throw error;
    }

    console.log('头像上传成功:', data);

    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);

    console.log('获取头像公开URL成功:', urlData.publicUrl);
    
    // 如果有旧头像，尝试删除（不阻塞主流程）
    if (oldAvatarUrl) {
      try {
        await deleteOldAvatar(oldAvatarUrl);
      } catch (deleteError) {
        console.warn('删除旧头像失败（非阻塞）:', deleteError);
      }
    }
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('头像アップロードエラー:', error);
    
    // 如果是权限错误，给出更详细的信息
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === '403') {
      throw new Error('アバターストレージへのアクセス権限がありません。Supabaseの設定を確認してください。');
    }
    
    throw new Error('アバターのアップロードに失敗しました');
  }
}

/**
 * 删除旧头像文件
 */
async function deleteOldAvatar(avatarUrl: string): Promise<void> {
  try {
    // 从URL中提取文件路径
    const url = new URL(avatarUrl);
    const pathSegments = url.pathname.split('/');
    const fileName = pathSegments[pathSegments.length - 1];
    const userId = pathSegments[pathSegments.length - 2];
    const filePath = `${userId}/${fileName}`;
    
    const { error } = await supabase.storage
      .from('avatars')
      .remove([filePath]);
      
    if (error) {
      console.warn('旧头像删除失败:', error);
    } else {
      console.log('旧头像删除成功:', filePath);
    }
  } catch (error) {
    console.warn('解析旧头像URL失败:', error);
  }
}

/**
 * 完整的头像上传流程
 */
export async function uploadUserAvatar(
  imageUri: string,
  userId: string,
  oldAvatarUrl?: string
): Promise<AvatarUploadResult> {
  try {
    // 上传新头像
    const url = await uploadAvatarToSupabase(imageUri, userId, oldAvatarUrl);
    
    return { url };
  } catch (error) {
    console.error('头像処理エラー:', error);
    throw error;
  }
}

/**
 * 获取默认头像URL
 */
export function getDefaultAvatarUrl(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=300`;
}

/**
 * 检查URL是否为默认头像
 */
export function isDefaultAvatar(avatarUrl: string): boolean {
  return avatarUrl.includes('ui-avatars.com');
}