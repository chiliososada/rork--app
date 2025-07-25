import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, ChevronLeft, X } from "lucide-react-native";
import Colors from "@/constants/colors";
import Input from "@/components/Input";
import Button from "@/components/Button";
import ImagePicker from "@/components/ImagePicker";
import { useLocationStore } from "@/store/location-store";
import { useTopicDetailsStore } from "@/store/topic-details-store";
import { useAuthStore } from "@/store/auth-store";
import { uploadTopicImage } from "@/lib/image-upload";
import { createTopicSchema } from "@/lib/validation";

export default function CreateTopicScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentLocation, requestPermission } = useLocationStore();
  const { createTopic, isLoading } = useTopicDetailsStore();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [titleFocused, setTitleFocused] = useState(false);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  
  // Image states
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  useEffect(() => {
    if (!currentLocation) {
      requestPermission();
    }
  }, []);
  
  const validateForm = () => {
    try {
      createTopicSchema.parse({
        title: title.trim(),
        description: description.trim(),
        location: currentLocation || { latitude: 0, longitude: 0 },
        imageUrl: selectedImageUri || undefined,
        aspectRatio: undefined,
        originalWidth: undefined,
        originalHeight: undefined
      });
      
      setTitleError("");
      setDescriptionError("");
      return true;
    } catch (error: any) {
      if (error.errors) {
        // Zod validation errors
        error.errors.forEach((err: any) => {
          if (err.path.includes('title')) {
            setTitleError(err.message);
          } else if (err.path.includes('description')) {
            setDescriptionError(err.message);
          }
        });
      }
      return false;
    }
  };
  
  const handleImageSelected = (uri: string) => {
    setSelectedImageUri(uri);
  };

  const handleRemoveImage = () => {
    setSelectedImageUri(null);
  };

  const handleCreateTopic = async () => {
    if (!validateForm()) return;
    
    if (!currentLocation) {
      Alert.alert(
        "位置情報が必要です",
        "トピックを作成するには位置情報サービスを有効にしてください。",
        [
          { text: "OK" }
        ]
      );
      return;
    }
    
    if (!user) {
      Alert.alert(
        "認証が必要です",
        "トピックを作成するにはログインしてください。",
        [
          { text: "OK" }
        ]
      );
      return;
    }
    
    try {
      let imageUrl: string | undefined;
      let imageAspectRatio: '1:1' | '4:5' | '1.91:1' | undefined;
      
      // Upload image if selected
      let originalWidth: number | undefined;
      let originalHeight: number | undefined;
      
      if (selectedImageUri) {
        setUploadingImage(true);
        try {
          const uploadResult = await uploadTopicImage(selectedImageUri);
          imageUrl = uploadResult.url;
          imageAspectRatio = uploadResult.aspectRatio;
          originalWidth = uploadResult.originalWidth;
          originalHeight = uploadResult.originalHeight;
        } catch (imageError: any) {
          setUploadingImage(false);
          console.error('Image upload error details:', imageError);
          Alert.alert(
            "画像アップロードエラー",
            `画像のアップロードに失敗しました。\n\nエラー詳細: ${imageError.message || imageError}\n\n画像なしで投稿しますか？`,
            [
              { text: "キャンセル", style: "cancel" },
              { 
                text: "画像なしで投稿", 
                onPress: () => proceedWithTopicCreation(undefined, undefined, undefined, undefined)
              }
            ]
          );
          return;
        }
        setUploadingImage(false);
      }
      
      await proceedWithTopicCreation(imageUrl, imageAspectRatio, originalWidth, originalHeight);
    } catch (error) {
      setUploadingImage(false);
      Alert.alert(
        "エラー",
        "トピックの作成に失敗しました。もう一度お試しください。",
        [
          { text: "OK" }
        ]
      );
    }
  };

  const proceedWithTopicCreation = async (
    imageUrl?: string, 
    imageAspectRatio?: '1:1' | '4:5' | '1.91:1',
    originalWidth?: number,
    originalHeight?: number
  ) => {
    await createTopic({
      title,
      description,
      author: user!,
      location: currentLocation!,
      imageUrl,
      aspectRatio: imageAspectRatio,
      originalWidth,
      originalHeight,
    });
    
    router.push("/(tabs)");
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen 
        options={{
          title: '新しいトピックを作成',
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.card,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '600',
            color: Colors.text.primary,
          },
          headerTintColor: Colors.text.primary,
          headerBackTitle: '',
          headerBackVisible: true,
          headerShadowVisible: true,
        }} 
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>あなたの周りで起きていることを共有しましょう</Text>
          
          <View style={styles.formCard}>
            <View style={styles.titleInputContainer}>
              <Input
                label="タイトル"
                placeholder="トピックのタイトルを入力"
                value={title}
                onChangeText={setTitle}
                error={titleError}
                maxLength={50}
                onFocus={() => setTitleFocused(true)}
                onBlur={() => setTitleFocused(false)}
                inputStyle={titleFocused ? styles.inputFocused : {}}
              />
              <Text style={styles.titleCharCount}>
                {title.length} / 50
              </Text>
            </View>
          
          <View style={styles.descriptionContainer}>
            <Input
            label="内容"
            placeholder="トピックの詳細を入力"
            value={description}
            onChangeText={setDescription}
            error={descriptionError}
            multiline
            numberOfLines={4}
            style={styles.descriptionInput}
            maxLength={500}
            onFocus={() => setDescriptionFocused(true)}
            onBlur={() => setDescriptionFocused(false)}
            inputStyle={descriptionFocused ? styles.inputFocused : {}}
            />
            <Text style={styles.charCount}>
              {description.length} / 500
            </Text>
          </View>
          </View>
          
          {/* Image Picker */}
          <ImagePicker
            onImageSelected={handleImageSelected}
            selectedImageUri={selectedImageUri || undefined}
            onRemoveImage={handleRemoveImage}
          />
          
          <View style={styles.locationSection}>
            <Text style={styles.locationLabel}>位置情報</Text>
            
            {currentLocation ? (
              <View style={styles.locationContainer}>
                <MapPin size={16} color={Colors.primary} />
                <Text style={styles.locationText}>
                  {currentLocation.name || '現在地を使用中'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.locationButton}
                onPress={requestPermission}
              >
                <MapPin size={16} color={Colors.primary} />
                <Text style={styles.locationButtonText}>
                  位置情報サービスを有効にする
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Button
            title={
              uploadingImage ? "画像を最適化中..." : 
              isLoading ? "トピックを作成中..." : 
              "トピックを作成"
            }
            onPress={handleCreateTopic}
            isLoading={isLoading || uploadingImage}
            style={styles.createButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  titleInputContainer: {
    marginBottom: 20,
  },
  titleCharCount: {
    textAlign: 'right',
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    marginRight: 4,
  },
  descriptionContainer: {
    position: 'relative',
  },
  descriptionInputContainer: {
    marginBottom: 0,
  },
  inputFocused: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  charCount: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 24,
    lineHeight: 24,
  },
  descriptionInput: {
    height: 160,
    textAlignVertical: "top",
    paddingBottom: 28,
  },
  locationSection: {
    marginBottom: 24,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text.primary,
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  locationText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 8,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  locationButtonText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 8,
  },
  createButton: {
    marginTop: 16,
  },
});