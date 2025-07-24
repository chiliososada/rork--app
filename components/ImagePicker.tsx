import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Camera, Image as ImageIcon, X, ZoomIn } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { pickImage, takePicture } from '@/lib/image-upload';

interface ImagePickerProps {
  onImageSelected: (uri: string) => void;
  selectedImageUri?: string;
  onRemoveImage?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const previewWidth = screenWidth - 48; // Account for padding

export default function ImagePicker({
  onImageSelected,
  selectedImageUri,
  onRemoveImage,
}: ImagePickerProps) {
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showFullScreen, setShowFullScreen] = useState(false);

  const handleImagePick = async (useCamera: boolean = false) => {
    try {
      setShowImageOptions(false);
      setIsLoading(true);
      setLoadingMessage(useCamera ? 'カメラを起動中...' : '画像を選択中...');
      
      const result = useCamera ? await takePicture() : await pickImage();
      
      if (result && !result.canceled && result.assets?.[0]) {
        setLoadingMessage('画像を処理中...');
        // 短暂延迟以显示处理状态
        await new Promise(resolve => setTimeout(resolve, 500));
        onImageSelected(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert(
        'エラー',
        error.message || '画像の選択に失敗しました。もう一度お試しください。',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      '写真を選択',
      '写真の取得方法を選択してください',
      [
        {
          text: 'カメラ',
          onPress: () => handleImagePick(true),
        },
        {
          text: 'フォトライブラリ',
          onPress: () => handleImagePick(false),
        },
        {
          text: 'キャンセル',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Image Preview or Picker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>写真を選択</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{loadingMessage}</Text>
          </View>
        ) : selectedImageUri ? (
          <View style={styles.imagePreviewContainer}>
            <TouchableOpacity 
              style={styles.imagePreview}
              onPress={() => setShowFullScreen(true)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: selectedImageUri }}
                style={styles.previewImage}
                contentFit="contain"
              />
              
              {/* Zoom indicator */}
              <View style={styles.zoomIndicator}>
                <ZoomIn size={16} color={Colors.card} />
              </View>
              
              {/* Remove Image Button */}
              {onRemoveImage && (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={onRemoveImage}
                >
                  <X size={20} color={Colors.card} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            
            {/* Change Image Button */}
            <TouchableOpacity
              style={styles.changeImageButton}
              onPress={showImagePickerOptions}
              disabled={isLoading}
            >
              <Text style={styles.changeImageButtonText}>写真を変更</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imagePickerButton}
            onPress={showImagePickerOptions}
            disabled={isLoading}
          >
            <ImageIcon size={40} color={Colors.text.secondary} />
            <Text style={styles.imagePickerText}>
              写真を選択またはカメラで撮影
            </Text>
            <Text style={styles.imagePickerSubtext}>
              原図の比例を保持して表示されます
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Full Screen Image Modal */}
      {selectedImageUri && (
        <Modal
          visible={showFullScreen}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFullScreen(false)}
        >
          <View style={styles.fullScreenContainer}>
            <TouchableOpacity
              style={styles.fullScreenOverlay}
              activeOpacity={1}
              onPress={() => setShowFullScreen(false)}
            >
              <Image
                source={{ uri: selectedImageUri }}
                style={styles.fullScreenImage}
                contentFit="contain"
              />
              
              <TouchableOpacity
                style={styles.fullScreenCloseButton}
                onPress={() => setShowFullScreen(false)}
              >
                <X size={24} color={Colors.card} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  imagePickerButton: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 160,
  },
  imagePickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: 12,
  },
  imagePickerSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  imagePreviewContainer: {
    alignItems: 'center',
  },
  imagePreview: {
    width: previewWidth,
    maxHeight: 400,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.border,
    minHeight: 160,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 6,
  },
  changeImageButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeImageButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  loadingContainer: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 6,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  fullScreenOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
  },
});