import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CouponProgress } from '../features/coupons/couponLogic';
import { describeCoupon } from '../features/coupons/couponLogic';
import type { Coupon } from '../features/coupons/types';
import { formatEuro, type Cents } from '../lib/money';
import { colors, radius, space } from '../lib/theme';

type Props = { progress: CouponProgress; subtotal: Cents };

/**
 * La "linea dei coupon": barra di avanzamento con un traguardo per ogni coupon.
 * Tocca un traguardo per vedere il dettaglio e copiare il codice.
 */
export function CouponLine({ progress, subtotal }: Props) {
  const { milestones, scaleMax, next, applied } = progress;
  const [selected, setSelected] = useState<Coupon | null>(null);
  if (!milestones.length) return null;

  const pct = (v: Cents) => `${Math.min(100, (v / scaleMax) * 100)}%` as const;
  const shown = selected ?? next?.coupon ?? applied[0] ?? milestones[milestones.length - 1];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Linea coupon</Text>

      {next ? (
        <Text style={styles.headline}>
          Mancano <Text style={styles.strong}>{formatEuro(next.missing)}</Text> per «{next.coupon.name}»
          {next.extraSaving > 0 ? (
            <Text style={styles.gain}>  (+{formatEuro(next.extraSaving)} di sconto)</Text>
          ) : null}
        </Text>
      ) : (
        <Text style={[styles.headline, styles.gain]}>Tutti i traguardi raggiunti ✓</Text>
      )}

      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: pct(subtotal) }]} />
        </View>
        {milestones.map((c) => {
          const reached = subtotal >= c.minSpend;
          const isApplied = applied.some((a) => a.id === c.id);
          return (
            <Pressable
              key={c.id}
              hitSlop={14}
              onPress={() => setSelected(c)}
              style={[styles.marker, { left: pct(c.minSpend) }]}
            >
              <View
                style={[
                  styles.dot,
                  reached && styles.dotReached,
                  isApplied && styles.dotApplied,
                  shown?.id === c.id && styles.dotSelected,
                ]}
              />
              <Text style={styles.markerLabel}>{Math.round(c.minSpend / 100)}€</Text>
            </Pressable>
          );
        })}
      </View>

      {shown ? (
        <View style={styles.detail}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailName}>
              {shown.name} · {describeCoupon(shown)}
            </Text>
            <Text style={styles.detailSub}>
              Spesa minima {formatEuro(shown.minSpend)}
              {subtotal >= shown.minSpend ? ' · sbloccato' : ''}
              {applied.some((a) => a.id === shown.id) ? ' · applicato' : ''}
            </Text>
          </View>
          {shown.code ? (
            <Pressable
              style={styles.codeBtn}
              onPress={async () => {
                await Clipboard.setStringAsync(shown.code!);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
            >
              <Text style={styles.codeText}>{shown.code}</Text>
              <Text style={styles.codeHint}>tocca per copiare</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space(4),
    marginHorizontal: space(4),
    marginTop: space(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  headline: { fontSize: 15, color: colors.text, marginTop: space(1) },
  strong: { fontWeight: '800', color: colors.text },
  gain: { color: colors.primary, fontWeight: '700' },
  trackWrap: { height: 44, marginTop: space(3), marginHorizontal: space(2) },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden', marginTop: 5 },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  marker: { position: 'absolute', top: 0, alignItems: 'center', width: 40, marginLeft: -20 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.muted,
  },
  dotReached: { borderColor: colors.primary },
  dotApplied: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotSelected: { transform: [{ scale: 1.25 }] },
  markerLabel: { fontSize: 11, color: colors.muted, marginTop: 2, fontWeight: '600' },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space(2),
    paddingTop: space(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space(3),
  },
  detailName: { fontSize: 15, fontWeight: '700', color: colors.text },
  detailSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  codeBtn: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  codeText: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  codeHint: { fontSize: 10, color: colors.muted },
});
