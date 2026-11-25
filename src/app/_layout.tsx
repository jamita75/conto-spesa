import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../lib/theme';
import { AppStoreProvider } from '../store/AppStore';

export default function RootLayout() {
  return (
    <AppStoreProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: 20, fontWeight: '800' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="add" options={{ title: 'Aggiungi prodotto', presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="store" options={{ title: 'Dove fai la spesa?', presentation: 'modal' }} />
        <Stack.Screen name="coupon-edit" options={{ title: 'Buono sconto', presentation: 'modal' }} />
        <Stack.Screen name="coupon-show" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="budget" options={{ title: 'Limite di spesa', presentation: 'modal' }} />
        <Stack.Screen name="privacy" options={{ title: 'Informativa privacy' }} />
      </Stack>
    </AppStoreProvider>
  );
}
