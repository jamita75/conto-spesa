import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ItemEditor } from '../components/ItemEditor';
import { BigButton } from '../components/ui';
import { space } from '../lib/theme';
import { useStore } from '../store/AppStore';

/** Inserimento manuale, oppure modifica di un prodotto già nel carrello (?id=...). */
export default function AddScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useStore();
  const existing = state.items.find((i) => i.id === id);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Modifica prodotto' : 'Aggiungi prodotto' }} />
      <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }} keyboardShouldPersistTaps="handled">
        <ItemEditor
          initial={existing}
          chain={state.store?.chain}
          confirmLabel={existing ? 'Salva' : 'Aggiungi'}
          onCancel={() => router.back()}
          onConfirm={(d) => {
            if (existing) dispatch({ type: 'item/update', id: existing.id, patch: d });
            else dispatch({ type: 'item/add', item: { ...d, source: 'manual' } });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          }}
        />
        {existing ? (
          <BigButton
            label="Togli dal carrello"
            variant="danger"
            style={{ marginTop: space(4) }}
            onPress={() => {
              dispatch({ type: 'item/remove', id: existing.id });
              router.back();
            }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
