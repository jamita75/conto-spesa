import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { budgetStatus } from '../features/budget/budget';
import { formatEuro, type Cents } from '../lib/money';
import { colors, font, radius, space } from '../lib/theme';

const LOOK = {
  ok: { bar: colors.primary, bg: colors.card, border: colors.border, fg: colors.primaryDark },
  near: { bar: colors.accent, bg: colors.accentSoft, border: colors.accent, fg: '#8A5A00' },
  over: { bar: colors.danger, bg: colors.dangerSoft, border: colors.danger, fg: colors.danger },
};

/** Barra del limite di spesa sotto il totale. Senza limite mostra solo l'invito a impostarlo. */
export function BudgetBar({ budget, toPay }: { budget?: Cents; toPay: Cents }) {
  if (!budget) {
    return (
      <Pressable style={styles.hint} onPress={() => router.push('/budget')} accessibilityRole="button">
        <Text style={styles.hintTxt}>💶 Hai una cifra massima (contanti o carta)? Imposta il limite: ti avviso prima della cassa.</Text>
      </Pressable>
    );
  }
  const s = budgetStatus(toPay, budget);
  const look = LOOK[s.level];
  const title =
    s.level === 'over'
      ? `⛔ Limite superato di ${formatEuro(s.over)}`
      : s.level === 'near'
        ? `⚠️ Attenzione: restano ${formatEuro(s.left)}`
        : `Puoi spendere ancora ${formatEuro(s.left)}`;
  return (
    <Pressable
      style={[styles.box, { backgroundColor: look.bg, borderColor: look.border }]}
      onPress={() => router.push('/budget')}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Limite ${formatEuro(budget)}. Tocca per cambiarlo`}
    >
      <View style={styles.row}>
        <Text style={[styles.title, { color: look.fg }]}>{title}</Text>
        <Text style={styles.edit}>Cambia</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(s.ratio * 100)}%`, backgroundColor: look.bar }]} />
      </View>
      <Text style={styles.sub}>
        Paghi {formatEuro(toPay)} su un limite di {formatEuro(budget)}
      </Text>
      {s.level === 'over' ? (
        <Text style={[styles.sub, { color: colors.danger, fontWeight: '700' }]}>
          Togli qualcosa dal carrello o tieni pronto un altro modo per pagare.
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginHorizontal: space(4),
    marginTop: space(3),
    padding: space(4),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  hintTxt: { fontSize: font.body, color: colors.text, fontWeight: '600', lineHeight: 23 },
  box: { marginHorizontal: space(4), marginTop: space(3), padding: space(4), borderRadius: radius.md, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  title: { flex: 1, fontSize: font.big - 2, fontWeight: '800' },
  edit: { fontSize: font.small, fontWeight: '800', color: colors.primaryDark },
  track: { height: 12, borderRadius: 6, backgroundColor: colors.track, marginTop: space(3), overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6 },
  sub: { fontSize: font.small, color: colors.muted, marginTop: space(2) },
});
