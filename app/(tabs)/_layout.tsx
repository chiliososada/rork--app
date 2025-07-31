import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth-store";
import { useLocationStore } from "@/store/location-store";
import { useLocationSettingsStore } from "@/store/location-settings-store";
import { useChatStore } from "@/store/chat-store";
import { useAdultContentStore } from "@/store/adult-content-store";
import CustomTabBar from "@/components/CustomTabBar";

export default function TabLayout() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { requestPermission } = useLocationStore();
  const { loadSettings } = useLocationSettingsStore();
  const { initializeConnection, disconnectConnection } = useChatStore();
  const { initializeServerVerification } = useAdultContentStore();
  
  useEffect(() => {
    // Initialize security systems when user is authenticated
    if (isAuthenticated && user?.id) {
      // Request location permission with privacy protection
      requestPermission();
      
      // Load location privacy settings
      loadSettings(user.id);
      
      // Initialize real-time chat connection
      initializeConnection(user.id);
      
      // Initialize server-side age verification
      initializeServerVerification();
    }
  }, [isAuthenticated, user?.id, requestPermission, loadSettings, initializeConnection, initializeServerVerification]);
  
  // Cleanup connections when component unmounts
  useEffect(() => {
    return () => {
      if (isAuthenticated && user?.id) {
        disconnectConnection();
      }
    };
  }, []);
  
  // If user is not authenticated, redirect to auth flow
  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }
  
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Hide default tab bar
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="chats" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <CustomTabBar />
      </View>
    </View>
  );
}