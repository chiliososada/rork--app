import React from "react";
import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, Settings, MapPin, Bell, Shield, HelpCircle } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useAuthStore } from "@/store/auth-store";
import CustomHeader from "@/components/CustomHeader";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  
  const handleLogout = () => {
    Alert.alert(
      "ログアウト",
      "本当にログアウトしますか？",
      [
        {
          text: "キャンセル",
          style: "cancel"
        },
        {
          text: "ログアウト",
          onPress: logout,
          style: "destructive"
        }
      ]
    );
  };
  
  const menuItems = [
    {
      icon: <Settings size={20} color={Colors.text.primary} />,
      title: "アカウント設定",
      onPress: () => {}
    },
    {
      icon: <MapPin size={20} color={Colors.text.primary} />,
      title: "位置情報設定",
      onPress: () => {}
    },
    {
      icon: <Bell size={20} color={Colors.text.primary} />,
      title: "通知設定",
      onPress: () => {}
    },
    {
      icon: <Shield size={20} color={Colors.text.primary} />,
      title: "プライバシー設定",
      onPress: () => {}
    },
    {
      icon: <HelpCircle size={20} color={Colors.text.primary} />,
      title: "ヘルプとサポート",
      onPress: () => {}
    }
  ];
  
  return (
    <View style={styles.container}>
      <CustomHeader
        title="プロフィール"
        subtitle={`👋 おかえりなさい、${user?.name || 'LocalTalkユーザー'}さん`}
      />
      
      <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
        <ScrollView>
          <View style={styles.profileSection}>
            <Image 
              source={{ uri: user?.avatar }} 
              style={styles.avatar}
            />
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email || "メールアドレスなし"}</Text>
          </View>
          
          <View style={styles.menuSection}>
            {menuItems.map((item, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuIcon}>
                  {item.icon}
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LogOut size={20} color={Colors.error} />
            <Text style={styles.logoutText}>ログアウト</Text>
          </TouchableOpacity>
          
          <Text style={styles.versionText}>バージョン 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    padding: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.text.primary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  menuSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  menuTitle: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 24,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.error,
    marginLeft: 8,
  },
  versionText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: "center",
    marginBottom: 24,
  },
});