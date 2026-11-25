import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { Text, View } from 'react-native';
import { daysToExpiry } from '../../features/coupons/couponLogic';
import { colors } from '../../lib/theme';
import { useStore } from '../../store/AppStore';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const { state, ready } = useStore();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!state.onboarded) return <Redirect href="/onboarding" />;

  // badge sui buoni che scadono entro 3 giorni
  const expiring = state.coupons.filter((c) => {
    const d = daysToExpiry(c);
    return c.active && d != null && d >= 0 && d <= 3;
  }).length;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 22, fontWeight: '800', color: colors.text },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
        tabBarStyle: { height: 68, paddingTop: 6, paddingBottom: 8 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Spesa', tabBarIcon: icon('🛒') }} />
      <Tabs.Screen
        name="coupons"
        options={{
          title: 'Buoni sconto',
          tabBarLabel: 'Buoni',
          tabBarIcon: icon('🏷️'),
          tabBarBadge: expiring || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.text },
        }}
      />
      <Tabs.Screen name="history" options={{ title: 'Le mie spese', tabBarLabel: 'Storico', tabBarIcon: icon('📊') }} />
      <Tabs.Screen name="profile" options={{ title: 'Impostazioni', tabBarLabel: 'Profilo', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
