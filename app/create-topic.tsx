import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin } from "lucide-react-native";
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
      setTitleError("Title is required");
      isValid = false;
    } else {
      setTitleError("");
    }
    
    if (!description.trim()) {
      setDescriptionError("Description is required");
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
        "Location Required",
        "Please enable location services to create a topic.",
        [
          { text: "OK" }
        ]
      );
      return;
    }
    
    if (!user) {
      Alert.alert(
        "Authentication Required",
        "Please log in to create a topic.",
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
        "Error",
        "Failed to create topic. Please try again.",
        [
          { text: "OK" }
        ]
      );
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{
          title: "Create Topic",
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
          <Text style={styles.title}>Create a New Topic</Text>
          <Text style={styles.subtitle}>Share what's happening around you</Text>
          
          <Input
            label="Title"
            placeholder="Enter a title for your topic"
            value={title}
            onChangeText={setTitle}
            error={titleError}
            maxLength={100}
          />
          
          <Input
            label="Description"
            placeholder="Provide more details about your topic"
            value={description}
            onChangeText={setDescription}
            error={descriptionError}
            multiline
            numberOfLines={4}
            style={styles.descriptionInput}
            maxLength={500}
          />
          
          <View style={styles.locationSection}>
            <Text style={styles.locationLabel}>Location</Text>
            
            {currentLocation ? (
              <View style={styles.locationContainer}>
                <MapPin size={16} color={Colors.primary} />
                <Text style={styles.locationText}>
                  Using your current location
                </Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.locationButton}
                onPress={requestPermission}
              >
                <MapPin size={16} color={Colors.primary} />
                <Text style={styles.locationButtonText}>
                  Enable location services
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Button
            title="Create Topic"
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