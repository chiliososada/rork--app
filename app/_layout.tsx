import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme, Platform, View, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc';
import { useAuthStore } from '@/store/auth-store';
import { useAdultContentStore } from '@/store/adult-content-store';
import ToastContainer from '@/components/ToastContainer';
import AdultContentModal from '@/components/AdultContentModal';
import { AgeVerificationModal } from '@/components/AgeVerificationModal';
import NotificationProvider from '@/components/NotificationProvider';

// Only import reanimated on native platforms to avoid web bundling issues
if (Platform.OS !== 'web') {
  require('react-native-reanimated');
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create a client
const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({});
  const { checkAuth, isAuthenticated, user } = useAuthStore();
  const { 
    checkConfirmationNeeded, 
    hasConfirmedAdultContent, 
    confirmAdultContent,
    canAccessAdultContent,
    serverVerificationStatus,
    markConfirmationShown
  } = useAdultContentStore();
  const [showAdultModal, setShowAdultModal] = useState(false);
  const [showAgeVerificationModal, setShowAgeVerificationModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasShownAgeModal, setHasShownAgeModal] = useState(false);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      checkAuth();
      
      // 延遲檢查成人內容確認狀態，讓 store 有時間恢復
      setTimeout(() => {
        setIsInitialized(true);
      }, 100);
    }
  }, [loaded, checkAuth]);

  // 年齢確認システムのチェック
  useEffect(() => {
    if (isInitialized && isAuthenticated && user?.id && !hasShownAgeModal) {
      const checkTimer = setTimeout(() => {
        console.log('Checking age verification status:', {
          canAccess: canAccessAdultContent(),
          serverVerified: serverVerificationStatus?.isVerified,
          hasConfirmed: hasConfirmedAdultContent,
          hasShownModal: hasShownAgeModal
        });
        
        // サーバーサイド年齢確認が必要かチェック
        if (!canAccessAdultContent()) {
          // サーバー確認が未完了の場合は年齢確認モーダルを表示
          if (!serverVerificationStatus?.isVerified && !showAgeVerificationModal) {
            console.log('Showing age verification modal');
            setShowAgeVerificationModal(true);
            setHasShownAgeModal(true);
          } else {
            // 宽限期内のクライアント確認が必要
            const needsConfirmation = checkConfirmationNeeded();
            if (needsConfirmation && !hasConfirmedAdultContent && !showAdultModal) {
              console.log('Showing adult content confirmation modal');
              setShowAdultModal(true);
            }
          }
        }
      }, 200);
      
      return () => clearTimeout(checkTimer);
    }
  }, [
    isInitialized, 
    isAuthenticated, 
    user?.id,
    canAccessAdultContent,
    serverVerificationStatus?.isVerified,
    hasShownAgeModal
  ]);

  const handleAdultContentConfirm = () => {
    setShowAdultModal(false);
  };

  const handleAdultContentDecline = () => {
    setShowAdultModal(false);
    // 在實際應用中，這裡可能需要退出應用或返回到登錄頁面
  };

  const handleAgeVerificationComplete = () => {
    setShowAgeVerificationModal(false);
    // 验证完成时也标记确认已显示
    markConfirmationShown();
    console.log('Age verification completed, marked as shown');
  };

  const handleAgeVerificationClose = () => {
    setShowAgeVerificationModal(false);
    // 标记确认已显示，防止重复弹出
    markConfirmationShown();
    console.log('Age verification modal closed, marked as shown');
  };

  if (!loaded || !isInitialized) {
    return null;
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <NotificationProvider>
            <View style={styles.container}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen 
                  name="adult-content-confirmation" 
                  options={{ 
                    headerShown: true,
                    gestureEnabled: false,
                    headerBackVisible: false,
                  }} 
                />
                <Stack.Screen 
                  name="favorites" 
                  options={{ 
                    headerBackTitle: '',
                    headerBackVisible: true,
                  }} 
                />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <ToastContainer />
              
              {/* サーバーサイド年齢確認モーダル */}
              <AgeVerificationModal
                visible={showAgeVerificationModal}
                onClose={handleAgeVerificationClose}
                onVerified={handleAgeVerificationComplete}
              />
              
              {/* 成人內容確認模態框（宽限期用） */}
              <AdultContentModal
                visible={showAdultModal}
                onConfirm={handleAdultContentConfirm}
                onDecline={handleAdultContentDecline}
                isFirstTime={true}
              />
            </View>
          </NotificationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});