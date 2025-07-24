import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';
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
  originalWidth: number;
  originalHeight: number;
  contentType?: string;
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
 * 检测图片内容类型，返回优化建议
 */
export function detectImageContentType(width: number, height: number): {
  type: 'text' | 'photo' | 'screenshot';
  quality: number;
  description: string;
} {
  const aspectRatio = width / height;
  
  // 检测截图类型图片（通常是手机截图比例）
  if (Math.abs(aspectRatio - 0.5) < 0.1 || // 2:1 宽屏截图
      Math.abs(aspectRatio - 0.46) < 0.05 || // iPhone截图比例
      Math.abs(aspectRatio - 0.56) < 0.05) { // Android截图比例
    return {
      type: 'screenshot',
      quality: 0.95, // 高质量保持文本清晰
      description: 'スクリーンショット'
    };
  }
  
  // 检测文本密集型图片（长图片通常包含大量文本）
  if (height > width * 1.5) { // 高度是宽度的1.5倍以上
    return {
      type: 'text',
      quality: 0.9, // 高质量保持文本可读性
      description: 'テキスト画像'
    };
  }
  
  // 默认为照片类型
  return {
    type: 'photo',
    quality: 0.8, // 标准质量，平衡文件大小和质量
    description: '写真'
  };
}

/**
 * 智能缩放图片，保持原始比例
 */
export async function resizeImageIntelligently(
  uri: string,
  options: Partial<ImageUploadOptions> = {}
): Promise<{ uri: string; width: number; height: number; contentType: string }> {
  const { maxWidth = 1200 } = options;
  
  // 获取原图尺寸
  const originalDimensions = await getImageDimensions(uri);
  const originalWidth = originalDimensions.width;
  const originalHeight = originalDimensions.height;
  const originalRatio = originalWidth / originalHeight;
  
  // 智能检测内容类型并获取最佳压缩参数
  const contentInfo = detectImageContentType(originalWidth, originalHeight);
  
  // 设置合理的最大高度限制（避免图片过长）
  const maxHeight = maxWidth * 2; // 最大高度为最大宽度的2倍
  
  let targetWidth: number;
  let targetHeight: number;
  
  // 如果原图宽度超出限制，按宽度缩放
  if (originalWidth > maxWidth) {
    targetWidth = maxWidth;
    targetHeight = Math.round(targetWidth / originalRatio);
  } else {
    targetWidth = originalWidth;
    targetHeight = originalHeight;
  }
  
  // 如果高度超出限制，再按高度缩放
  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = Math.round(targetHeight * originalRatio);
  }
  
  // 如果尺寸没有变化，直接返回原图
  if (targetWidth === originalWidth && targetHeight === originalHeight) {
    return {
      uri,
      width: originalWidth,
      height: originalHeight,
      contentType: contentInfo.description
    };
  }
  
  const result = await manipulateAsync(
    uri,
    [
      { resize: { width: targetWidth, height: targetHeight } }
    ],
    {
      compress: contentInfo.quality, // 使用智能检测的质量参数
      format: SaveFormat.JPEG,
    }
  );
  
  console.log(`图片优化完成: ${contentInfo.description}, 质量: ${contentInfo.quality}, 尺寸: ${targetWidth}x${targetHeight}`);
  
  return {
    uri: result.uri,
    width: targetWidth,
    height: targetHeight,
    contentType: contentInfo.description
  };
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
  aspectRatio?: AspectRatio, // 现在只作为参考，不强制裁剪
  topicId?: string
): Promise<ImageUploadResult> {
  try {
    // 1. 智能缩放图片，保持原始比例
    const resizeResult = await resizeImageIntelligently(imageUri);
    
    // 2. 生成文件名
    const timestamp = Date.now();
    const fileName = topicId 
      ? `${topicId}_${timestamp}.jpg`
      : `topic_${timestamp}.jpg`;
    
    // 3. 上传到Supabase
    const url = await uploadImageToSupabase(resizeResult.uri, fileName);
    
    // 4. 根据实际尺寸计算最接近的aspectRatio（用于向后兼容）
    const actualRatio = resizeResult.width / resizeResult.height;
    let calculatedAspectRatio: AspectRatio;
    
    if (Math.abs(actualRatio - 1) < 0.1) {
      calculatedAspectRatio = '1:1';
    } else if (Math.abs(actualRatio - 0.8) < 0.1) {
      calculatedAspectRatio = '4:5';
    } else if (Math.abs(actualRatio - 1.91) < 0.2) {
      calculatedAspectRatio = '1.91:1';
    } else {
      // 默认使用最接近的比例
      calculatedAspectRatio = actualRatio > 1 ? '1.91:1' : '4:5';
    }
    
    return {
      url,
      aspectRatio: aspectRatio || calculatedAspectRatio,
      originalWidth: resizeResult.width,
      originalHeight: resizeResult.height,
      contentType: resizeResult.contentType
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
 * 获取图片的实际尺寸信息（React Native版本）
 */
export async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    // 在React Native中使用Image.getSize
    if (typeof Image !== 'undefined' && Image.getSize) {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        reject
      );
    } else {
      // Web环境回退
      const img = new globalThis.Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = uri;
    }
  });
}