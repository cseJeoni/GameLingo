import { router, SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../hooks/use-auth';

// 세션 확인 전에 스플래시가 사라지지 않도록 대기
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // 세션 확인 완료 후 스플래시 숨김
    SplashScreen.hideAsync();

    if (session) {
      // 로그인 상태 → 탭 화면으로
      router.replace('/(tabs)');
    } else {
      // 비로그인 상태 → 로그인 화면으로
      router.replace('/(auth)/login');
    }
  }, [session, loading]);

  // 세션 확인 중에는 빈 화면 (스플래시가 덮고 있음)
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}