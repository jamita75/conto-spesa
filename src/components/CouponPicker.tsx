import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { describeCoupon } from '../features/coupons/couponLogic';
import type { Coupon } from '../features/coupons/types';
import { colors, font, radius, space } from '../lib/theme';

/**
 * Scelta dei buoni da usare nella spesa in corso.
 * Di base tutti i buoni validi oggi nel negozio scelto sono inclusi: un tocco li esclude («Non oggi»).
 */
export function CouponPicker({
  coupons,
  skip,
  onToggle,
}: {
  coupons: Coupon[];
  skip: string[];
  onToggle: (id: string) => void;
}) {
  const used = coupons.filter((c) => !skip.includes(c.id)).length;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🏷️ Buoni per questa spesa</Text>
      <Text style={styles.sub}>
        {coupons.length
          ? `Ne usi ${used} su ${coupons.length}. Tocca un buono per usarlo o lasciarlo per un'altra volta.`
          : 'Nessun buono valido oggi in questo negozio.'}
      </Text>
      <View style={styles.wrap}>
        {coupons.map((c) => {
          const on = !skip.includes(c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => {
                Haptics.selectionAsync();
                onToggle(c.id);
              }}
              style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${c.name}, ${on ? 'lo uso in questa spesa' : 'non lo uso oggi'}`}
            >
              <Text style={[styles.chipName, on ? { color: '#fff' } : { color: colors.muted }]} numberOfLines={1}>
                {on ? '✓ ' : ''}
                {c.name}
              </Text>
              <Text style={[styles.chipSub, on ? { color: '#D8F2E4' } : { color: colors.muted }]} numberOfLines={1}>
                {on ? describeCoupon(c) : 'Non oggi'}
              </Text>
            </Pressable>
          );
        })}
        <Pressable style={[styles.chip, styles.chipAdd]} onPress={() => router.push('/coupon-edit')} accessibilityRole="button">
          <Text style={[styles.chipName, { color: colors.primaryDark }]}>+ Aggiungi buono</Text>
          <Text style={[styles.chipSub, { color: colors.primaryDark }]}>lo uso subito</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space(4),
    marginTop: space(3),
    padding: space(4),
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: font.big - 2, fontWeight: '800', color: colors.text },
  sub: { fontSize: font.small, color: colors.muted, marginTop: space(1), lineHeight: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  chip: { maxWidth: '100%', paddingVertical: space(2), paddingHorizontal: space(3), borderRadius: radius.md, borderWidth: 1.5 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipOff: { backgroundColor: colors.bg, borderColor: colors.border, borderStyle: 'dashed' },
  chipAdd: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  chipName: { fontSize: font.body, fontWeight: '800' },
  chipSub: { fontSize: 13, fontWeight: '600', marginTop: 1 },
});
