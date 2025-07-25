import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth-store";
import { useLocationStore } from "@/store/location-store";
import CustomTabBar from "@/components/CustomTabBar";

export default function TabLayout() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { requestPermission } = useLocationStore();
  
  useEffect(() => {
    // Request location permission when tabs are loaded
    if (isAuthenticated) {
      requestPermission();
    }
  }, [isAuthenticated, requestPermission]);
  
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