import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ItemEditor } from '../components/ItemEditor';
import { space } from '../lib/theme';
import { useStore } from '../store/AppStore';

export default function AddManualScreen() {
  const { dispatch } = useStore();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space(4) }} keyboardShouldPersistTaps="handled">
        <ItemEditor
          onCancel={() => router.back()}
          onConfirm={({ price, qty, label }) => {
            dispatch({ type: 'item/add', item: { price, qty, label, source: 'manual' } });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
