import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

export type AspectRatio = '1:1' | '4:5' | '1.91:1';

export interface ImageUploadOptions {
  aspectRatio: AspectRatio;
  quality?: number;
  maxWidth?: number;
}

export interface ImageUploadResult {
  url: string;
  aspectRatio: AspectRatio;
}

/**
 * 获取相机和相册权限
 */
export async function requestImagePermissions(): Promise<boolean> {
  const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
  const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  return cameraStatus === 'granted' && mediaStatus === 'granted';
}

/**
 * 打开图片选择器
 */
export async function pickImage(): Promise<ImagePicker.ImagePickerResult | null> {
  const hasPermissions = await requestImagePermissions();
  
  if (!hasPermissions) {
    throw new Error('カメラまたはフォトライブラリへのアクセス権限が必要です');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
  });

  return result.canceled ? null : result;
}

/**
 * 拍摄照片
 */
export async function takePicture(): Promise<ImagePicker.ImagePickerResult | null> {
  const hasPermissions = await requestImagePermissions();
  
  if (!hasPermissions) {
    throw new Error('カメラへのアクセス権限が必要です');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.8,
  });

  return result.canceled ? null : result;
}

/**
 * 根据比例裁剪图片
 */
export async function cropImageToAspectRatio(
  uri: string, 
  aspectRatio: AspectRatio,
  options: Partial<ImageUploadOptions> = {}
): Promise<string> {
  const { quality = 0.8, maxWidth = 1200 } = options;
  
  // 计算裁剪参数
  let cropWidth: number;
  let cropHeight: number;
  
  switch (aspectRatio) {
    case '1:1':
      cropWidth = maxWidth;
      cropHeight = maxWidth;
      break;
    case '4:5':
      cropWidth = maxWidth;
      cropHeight = Math.round(maxWidth * 1.25); // 4:5 = 0.8, so height = width / 0.8
      break;
    case '1.91:1':
      cropWidth = maxWidth;
      cropHeight = Math.round(maxWidth / 1.91);
      break;
  }
  
  const result = await manipulateAsync(
    uri,
    [
      { resize: { width: cropWidth, height: cropHeight } }
    ],
    {
      compress: quality,
      format: SaveFormat.JPEG,
    }
  );
  
  return result.uri;
}

/**
 * 上传图片到Supabase Storage
 */
export async function uploadImageToSupabase(
  uri: string,
  fileName: string,
  bucket: string = 'topic-images'
): Promise<string> {
  try {
    console.log('开始上传图片:', fileName);
    
    // 使用expo-file-system读取文件为base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log('文件读取为base64成功');
    
    // 将base64转换为Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('开始上传到Supabase Storage...');
    
    // 上传到Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: true // 改为true以防文件名冲突
      });

    if (error) {
      console.error('Supabase Storage错误:', error);
      throw error;
    }

    console.log('上传成功:', data);

    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    console.log('获取公开URL成功:', urlData.publicUrl);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('画像アップロードエラー:', error);
    
    // 如果是权限错误，给出更详细的信息
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === '403') {
      throw new Error('ストレージへのアクセス権限がありません。Supabaseの設定を確認してください。');
    }
    
    throw new Error('画像のアップロードに失敗しました');
  }
}

/**
 * 完整的图片上传流程
 */
export async function uploadTopicImage(
  imageUri: string,
  aspectRatio: AspectRatio,
  topicId?: string
): Promise<ImageUploadResult> {
  try {
    // 1. 裁剪图片到指定比例
    const croppedUri = await cropImageToAspectRatio(imageUri, aspectRatio);
    
    // 2. 生成文件名
    const timestamp = Date.now();
    const fileName = topicId 
      ? `${topicId}_${timestamp}.jpg`
      : `topic_${timestamp}.jpg`;
    
    // 3. 上传到Supabase
    const url = await uploadImageToSupabase(croppedUri, fileName);
    
    return {
      url,
      aspectRatio
    };
  } catch (error) {
    console.error('画像処理エラー:', error);
    throw error;
  }
}

/**
 * 删除Supabase Storage中的图片
 */
export async function deleteImageFromSupabase(
  imageUrl: string,
  bucket: string = 'topic-images'
): Promise<void> {
  try {
    // 从URL中提取文件路径
    const url = new URL(imageUrl);
    const pathSegments = url.pathname.split('/');
    const fileName = pathSegments[pathSegments.length - 1];
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);
      
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('画像削除エラー:', error);
    throw new Error('画像の削除に失敗しました');
  }
}

/**
 * 获取图片的实际尺寸信息
 */
export async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = uri;
  });
}