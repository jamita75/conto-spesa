import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BigButton, SectionTitle } from '../components/ui';
import { CHAINS, STORE_TYPE_ICON, STORE_TYPE_LABEL, type StoreType } from '../features/store/types';
import { colors, font, radius, space } from '../lib/theme';
import { useStore } from '../store/AppStore';

/** Scelta del negozio in 2 tocchi: tipologia, poi insegna (o "Altro"). */
export default function StoreScreen() {
  const { state, dispatch } = useStore();
  const [type, setType] = useState<StoreType | undefined>(state.store?.type);
  const [other, setOther] = useState('');

  const choose = (t: StoreType, chain?: string) => {
    dispatch({ type: 'store/set', store: { type: t, chain: chain?.trim() || undefined } });
    Haptics.selectionAsync();
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }} keyboardShouldPersistTaps="handled">
      <SectionTitle>1. Che tipo di negozio?</SectionTitle>
      <View style={styles.typeRow}>
        {(['food', 'nonfood'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setType(t)}
            style={[styles.typeCard, type === t && styles.typeActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: type === t }}
          >
            <Text style={styles.typeIcon}>{STORE_TYPE_ICON[t]}</Text>
            <Text style={styles.typeLabel}>{STORE_TYPE_LABEL[t]}</Text>
            <Text style={styles.typeHelp}>{t === 'food' ? 'supermercati, discount' : 'casa, bricolage, elettronica…'}</Text>
          </Pressable>
        ))}
      </View>

      {type ? (
        <>
          <SectionTitle>2. Quale negozio?</SectionTitle>
          <View style={styles.grid}>
            {CHAINS[type].map((c) => (
              <Pressable
                key={c}
                onPress={() => choose(type, c)}
                style={[styles.chain, state.store?.chain === c && styles.chainActive]}
              >
                <Text style={styles.chainText}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.otherLabel}>Non è in elenco? Scrivi il nome:</Text>
          <TextInput
            value={other}
            onChangeText={setOther}
            placeholder="es. Supermercato da Mario"
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={() => other.trim() && choose(type, other)}
          />
          <BigButton
            label={other.trim() ? `Usa «${other.trim()}»` : 'Continua senza nome'}
            onPress={() => choose(type, other)}
            variant={other.trim() ? 'primary' : 'ghost'}
            style={{ marginTop: space(3) }}
          />
        </>
      ) : null}

      {state.store ? (
        <BigButton
          label="Togli il negozio"
          variant="danger"
          onPress={() => {
            dispatch({ type: 'store/set', store: undefined });
            router.back();
          }}
          style={{ marginTop: space(8) }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', gap: space(3) },
  typeCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: space(4),
    alignItems: 'center',
  },
  typeActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeIcon: { fontSize: 40 },
  typeLabel: { fontSize: font.big, fontWeight: '800', color: colors.text, marginTop: space(1) },
  typeHelp: { fontSize: font.small, color: colors.muted, textAlign: 'center', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chain: {
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chainActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chainText: { fontSize: font.body, fontWeight: '700', color: colors.text },
  otherLabel: { fontSize: font.body, color: colors.muted, marginTop: space(6), marginBottom: space(2) },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(4),
    fontSize: font.body,
    backgroundColor: colors.card,
    color: colors.text,
  },
});
