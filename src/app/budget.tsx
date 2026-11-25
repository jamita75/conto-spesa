import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigButton, SectionTitle } from '../components/ui';
import { QUICK_BUDGETS } from '../features/budget/budget';
import { centsToInput, formatEuro, parseEuroInput } from '../lib/money';
import { colors, font, radius, space } from '../lib/theme';
import { useStore } from '../store/AppStore';

/** Limite di spesa: quanto hai in contanti o quanto puoi spendere con la carta. */
export default function BudgetScreen() {
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const current = state.settings.budget;
  const [text, setText] = useState(current ? centsToInput(current) : '');
  const value = parseEuroInput(text);
  const valid = value != null && value > 0;

  const save = (cents: number) => {
    dispatch({ type: 'settings/update', patch: { budget: cents } });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const remove = () => {
    dispatch({ type: 'settings/update', patch: { budget: undefined } });
    Haptics.selectionAsync();
    router.back();
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10) + insets.bottom }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>
        Quanto puoi spendere al massimo? Per esempio i contanti che hai nel portafoglio o la cifra disponibile sulla carta.
        Ti avviso quando ti avvicini e se lo superi, così in cassa non hai sorprese.
      </Text>

      <SectionTitle>Scegli un importo</SectionTitle>
      <View style={styles.grid}>
        {QUICK_BUDGETS.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, value === c && styles.chipOn]}
            onPress={() => save(c)}
            accessibilityRole="button"
            accessibilityLabel={`Limite ${formatEuro(c)}`}
          >
            <Text style={[styles.chipTxt, value === c && { color: '#fff' }]}>{formatEuro(c)}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Oppure scrivi la cifra esatta</SectionTitle>
      <View style={styles.inputRow}>
        <Text style={styles.euro}>€</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="es. 47,50"
          keyboardType="decimal-pad"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => valid && save(value)}
          accessibilityLabel="Limite di spesa in euro"
        />
      </View>
      <BigButton label="Salva il limite" onPress={() => valid && save(value)} disabled={!valid} style={{ marginTop: space(4) }} />

      {current ? (
        <BigButton label="Togli il limite" variant="danger" onPress={remove} style={{ marginTop: space(3) }} />
      ) : null}

      <Text style={styles.note}>
        Il limite resta salvato anche per le prossime spese: cambialo quando vuoi. Conta quello che paghi davvero, cioè il
        totale meno i buoni già sbloccati. Per i prodotti a peso lascia un piccolo margine.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: font.body, color: colors.text, lineHeight: 24, marginBottom: space(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: {
    width: '31%',
    paddingVertical: space(4),
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: font.big, fontWeight: '800', color: colors.text },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: space(4),
  },
  euro: { fontSize: font.title, fontWeight: '800', color: colors.muted, marginRight: space(2) },
  input: { flex: 1, fontSize: font.title, fontWeight: '800', color: colors.text, paddingVertical: space(3) },
  note: { fontSize: font.small, color: colors.muted, lineHeight: 20, marginTop: space(5) },
});
