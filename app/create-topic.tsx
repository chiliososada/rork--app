import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, ChevronLeft, X } from "lucide-react-native";
import Colors from "@/constants/colors";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { useLocationStore } from "@/store/location-store";
import { useTopicStore } from "@/store/topic-store";
import { useAuthStore } from "@/store/auth-store";

export default function CreateTopicScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentLocation, requestPermission } = useLocationStore();
  const { createTopic, isLoading } = useTopicStore();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  
  useEffect(() => {
    if (!currentLocation) {
      requestPermission();
    }
  }, []);
  
  const validateForm = () => {
    let isValid = true;
    
    if (!title.trim()) {
      setTitleError("タイトルは必須です");
      isValid = false;
    } else {
      setTitleError("");
    }
    
    if (!description.trim()) {
      setDescriptionError("内容は必須です");
      isValid = false;
    } else {
      setDescriptionError("");
    }
    
    return isValid;
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
      await createTopic({
        title,
        description,
        author: user,
        location: currentLocation,
      });
      
      router.push("/(tabs)");
    } catch (error) {
      Alert.alert(
        "エラー",
        "トピックの作成に失敗しました。もう一度お試しください。",
        [
          { text: "OK" }
        ]
      );
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>新しいトピックを作成</Text>
        <View style={styles.placeholder} />
      </View>
      
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
          
          <Input
            label="タイトル"
            placeholder="トピックのタイトルを入力"
            value={title}
            onChangeText={setTitle}
            error={titleError}
            maxLength={100}
          />
          
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
            title="トピックを作成"
            onPress={handleCreateTopic}
            isLoading={isLoading}
            style={styles.createButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginHorizontal: 16,
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
  },
  descriptionInput: {
    height: 120,
    textAlignVertical: "top",
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
    backgroundColor: 'rgba(91, 114, 242, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  locationText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 8,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: 'rgba(91, 114, 242, 0.1)',
    padding: 12,
    borderRadius: 12,
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