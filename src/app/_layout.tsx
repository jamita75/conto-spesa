import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppStoreProvider } from '../store/AppStore';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <AppStoreProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Conto Spesa' }} />
        <Stack.Screen name="coupons" options={{ title: 'Coupon e obiettivi' }} />
        <Stack.Screen name="add" options={{ title: 'Aggiungi prodotto', presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
    </AppStoreProvider>
  );
}
