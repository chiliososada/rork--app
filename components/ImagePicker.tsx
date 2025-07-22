import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { AspectRatio, pickImage, takePicture } from '@/lib/image-upload';

interface ImagePickerProps {
  onImageSelected: (uri: string, aspectRatio: AspectRatio) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  selectedImageUri?: string;
  onRemoveImage?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const previewWidth = screenWidth - 48; // Account for padding

export default function ImagePicker({
  onImageSelected,
  aspectRatio,
  onAspectRatioChange,
  selectedImageUri,
  onRemoveImage,
}: ImagePickerProps) {
  const [showImageOptions, setShowImageOptions] = useState(false);

  const aspectRatioOptions = [
    { value: '1:1' as const, label: '正方形 (1:1)', description: 'SNS投稿に最適' },
    { value: '4:5' as const, label: '縦長 (4:5)', description: 'Instagram風' },
    { value: '1.91:1' as const, label: '横長 (1.91:1)', description: 'パノラマ風' },
  ];

  const getPreviewHeight = () => {
    switch (aspectRatio) {
      case '1:1':
        return previewWidth;
      case '4:5':
        return previewWidth * 1.25;
      case '1.91:1':
        return previewWidth / 1.91;
      default:
        return previewWidth;
    }
  };

  const handleImagePick = async (useCamera: boolean = false) => {
    try {
      setShowImageOptions(false);
      
      const result = useCamera ? await takePicture() : await pickImage();
      
      if (result && !result.canceled && result.assets?.[0]) {
        onImageSelected(result.assets[0].uri, aspectRatio);
      }
    } catch (error: any) {
      Alert.alert(
        'エラー',
        error.message || '画像の選択に失敗しました。もう一度お試しください。',
        [{ text: 'OK' }]
      );
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
      {/* Aspect Ratio Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アスペクト比を選択</Text>
        <View style={styles.aspectRatioContainer}>
          {aspectRatioOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.aspectRatioOption,
                aspectRatio === option.value && styles.aspectRatioOptionActive,
              ]}
              onPress={() => onAspectRatioChange(option.value)}
            >
              <Text
                style={[
                  styles.aspectRatioLabel,
                  aspectRatio === option.value && styles.aspectRatioLabelActive,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.aspectRatioDescription,
                  aspectRatio === option.value && styles.aspectRatioDescriptionActive,
                ]}
              >
                {option.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Image Preview or Picker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>写真を選択</Text>
        
        {selectedImageUri ? (
          <View style={styles.imagePreviewContainer}>
            <View
              style={[
                styles.imagePreview,
                { 
                  width: previewWidth, 
                  height: getPreviewHeight(),
                },
              ]}
            >
              <Image
                source={{ uri: selectedImageUri }}
                style={styles.previewImage}
                contentFit="cover"
              />
              
              {/* Remove Image Button */}
              {onRemoveImage && (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={onRemoveImage}
                >
                  <X size={20} color={Colors.card} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Change Image Button */}
            <TouchableOpacity
              style={styles.changeImageButton}
              onPress={showImagePickerOptions}
            >
              <Text style={styles.changeImageButtonText}>写真を変更</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.imagePickerButton,
              {
                width: previewWidth,
                height: getPreviewHeight(),
              },
            ]}
            onPress={showImagePickerOptions}
          >
            <ImageIcon size={40} color={Colors.text.secondary} />
            <Text style={styles.imagePickerText}>
              写真を選択またはカメラで撮影
            </Text>
            <Text style={styles.imagePickerSubtext}>
              タップして {aspectRatioOptions.find(opt => opt.value === aspectRatio)?.description} の写真を追加
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
  aspectRatioContainer: {
    gap: 8,
  },
  aspectRatioOption: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  aspectRatioOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#E3F2FD',
  },
  aspectRatioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  aspectRatioLabelActive: {
    color: Colors.primary,
  },
  aspectRatioDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  aspectRatioDescriptionActive: {
    color: Colors.primary,
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
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.border,
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
});