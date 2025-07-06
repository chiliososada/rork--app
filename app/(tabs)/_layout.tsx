import React, { useEffect } from "react";
import { Tabs } from "expo-router";
<<<<<<< HEAD
import { MapPin, Compass, PlusCircle, MessageCircle, User } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
=======
import { View } from "react-native";
>>>>>>> 715cca6 (初始化项目结构)
import { useRouter, Redirect } from "expo-router";
import Colors from "@/constants/colors";
import { useAuthStore } from "@/store/auth-store";
import { useLocationStore } from "@/store/location-store";
import CustomTabBar from "@/components/CustomTabBar";

export default function TabLayout() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { requestPermission } = useLocationStore();
  
  // If user is not authenticated, redirect to auth flow
  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }
  
  useEffect(() => {
    // Request location permission when tabs are loaded
    requestPermission();
  }, []);
  
  const handleCreateTopic = () => {
    router.push('/create-topic');
  };
  
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Hide default tab bar
        }}
<<<<<<< HEAD
      />
      
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <Compass size={24} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: ({ color }) => <PlusCircle size={24} color={color} />,
          tabBarButton: (props) => (
            <TouchableOpacity
              onPress={handleCreateTopic}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <PlusCircle 
                  size={24} 
                  color={props.accessibilityState?.selected ? Colors.primary : Colors.inactive} 
                />
              </View>
            </TouchableOpacity>
          ),
        }}
      />
      
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => <MessageCircle size={24} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
=======
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="chats" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <CustomTabBar />
    </View>
>>>>>>> 715cca6 (初始化项目结构)
  );
}