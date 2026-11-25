import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CouponProgress } from '../features/coupons/couponLogic';
import { daysToStart, describeCoupon, describeScope } from '../features/coupons/couponLogic';
import type { Coupon } from '../features/coupons/types';
import { formatEuro, type Cents } from '../lib/money';
import { colors, font, radius, space } from '../lib/theme';

type Props = { progress: CouponProgress; subtotal: Cents };

/**
 * La "linea dei buoni":
 * - barra unica con un traguardo per ogni buono su tutta la spesa
 * - una barra per ogni buono limitato a marca o reparto (conta solo quei prodotti)
 * - promemoria dei buoni non ancora validi
 */
export function CouponLine({ progress, subtotal }: Props) {
  const { milestones, scaleMax, next, applied, scoped, upcoming } = progress;
  const [selected, setSelected] = useState<Coupon | null>(null);
  if (!milestones.length && !scoped.length && !upcoming.length) return null;

  const pct = (v: Cents, max: Cents) => `${Math.min(100, (v / Math.max(max, 1)) * 100)}%` as const;
  const shown = selected ?? next?.coupon ?? applied.find((a) => milestones.includes(a)) ?? milestones[milestones.length - 1];
  const isApplied = (c: Coupon) => applied.some((a) => a.id === c.id);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>I tuoi buoni</Text>

      {milestones.length ? (
        <>
          {next ? (
            <Text style={styles.headline}>
              Mancano <Text style={styles.strong}>{formatEuro(next.missing)}</Text> per «{next.coupon.name}»
              {next.extraSaving > 0 ? <Text style={styles.gain}> (+{formatEuro(next.extraSaving)} di sconto)</Text> : null}
            </Text>
          ) : (
            <Text style={[styles.headline, styles.gain]}>Traguardi sulla spesa raggiunti ✓</Text>
          )}

          <View style={styles.trackWrap}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: pct(subtotal, scaleMax) }]} />
            </View>
            {milestones.map((c) => {
              const reached = subtotal >= c.minSpend;
              return (
                <Pressable
                  key={c.id}
                  hitSlop={14}
                  onPress={() => setSelected(c)}
                  style={[styles.marker, { left: pct(c.minSpend, scaleMax) }]}
                >
                  <View
                    style={[
                      styles.dot,
                      reached && styles.dotReached,
                      isApplied(c) && styles.dotApplied,
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
                  {isApplied(shown) ? ' · applicato' : ''}
                </Text>
              </View>
              <CodeButton coupon={shown} />
            </View>
          ) : null}
        </>
      ) : null}

      {scoped.map((s) => (
        <View key={s.coupon.id} style={styles.scoped}>
          <View style={styles.scopedHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>
                {s.coupon.name} · {describeCoupon(s.coupon)}
              </Text>
              <Text style={styles.detailSub}>
                Su {describeScope(s.coupon.scope)}: {formatEuro(s.base)} di {formatEuro(s.coupon.minSpend)}
              </Text>
            </View>
            <CodeButton coupon={s.coupon} />
          </View>
          <View style={[styles.track, { marginTop: space(2) }]}>
            <View
              style={[styles.fill, { width: pct(s.base, s.coupon.minSpend) }, isApplied(s.coupon) && { backgroundColor: colors.accent }]}
            />
          </View>
          <Text style={[styles.scopedMsg, s.unlocked && styles.gain]}>
            {s.unlocked
              ? isApplied(s.coupon)
                ? `Sbloccato e applicato: −${formatEuro(s.saving)}`
                : 'Sbloccato (ne conviene un altro)'
              : `Mancano ${formatEuro(s.missing)} in questi prodotti`}
          </Text>
        </View>
      ))}

      {upcoming.map((c) => {
        const d = daysToStart(c) ?? 0;
        return (
          <Text key={c.id} style={styles.upcoming}>
            ⏳ «{c.name}» vale {d === 1 ? 'da domani' : `tra ${d} giorni`}: oggi non conta
          </Text>
        );
      })}
    </View>
  );
}

/** Pulsante per mostrare il codice a barre in cassa (o copiarlo con pressione lunga). */
function CodeButton({ coupon }: { coupon: Coupon }) {
  if (!coupon.code) return null;
  return (
    <Pressable
      style={styles.codeBtn}
      onPress={() => router.push({ pathname: '/coupon-show', params: { id: coupon.id } })}
      onLongPress={async () => {
        await Clipboard.setStringAsync(coupon.code!);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }}
    >
      <Text style={styles.codeText}>▮▯▮▮</Text>
      <Text style={styles.codeHint}>codice</Text>
    </Pressable>
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
  title: { fontSize: font.small, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  headline: { fontSize: font.body, color: colors.text, marginTop: space(1) },
  strong: { fontWeight: '800', color: colors.text },
  gain: { color: colors.primary, fontWeight: '700' },
  trackWrap: { height: 46, marginTop: space(3), marginHorizontal: space(2) },
  track: { height: 12, borderRadius: 6, backgroundColor: colors.track, overflow: 'hidden', marginTop: 5 },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 6 },
  marker: { position: 'absolute', top: 0, alignItems: 'center', width: 44, marginLeft: -22 },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.muted },
  dotReached: { borderColor: colors.primary },
  dotApplied: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotSelected: { transform: [{ scale: 1.25 }] },
  markerLabel: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: '700' },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space(2),
    paddingTop: space(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space(3),
  },
  detailName: { fontSize: font.body - 1, fontWeight: '800', color: colors.text },
  detailSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  scoped: { marginTop: space(3), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.border },
  scopedHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  scopedMsg: { fontSize: 14, color: colors.text, marginTop: space(1), fontWeight: '600' },
  upcoming: { fontSize: 14, color: colors.muted, marginTop: space(3) },
  codeBtn: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  codeText: { fontSize: 16, fontWeight: '800', color: colors.text },
  codeHint: { fontSize: 11, color: colors.muted },
});
