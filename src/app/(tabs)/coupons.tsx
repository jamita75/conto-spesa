import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Switch, Text, View } from 'react-native';
import { OffersBox } from '../../components/OffersBox';
import { BigButton } from '../../components/ui';
import {
  couponState,
  daysToExpiry,
  daysToStart,
  describeCoupon,
  describeScope,
  sortCoupons,
  type CouponState,
} from '../../features/coupons/couponLogic';
import type { Coupon } from '../../features/coupons/types';
import { formatEuro } from '../../lib/money';
import { colors, font, radius, space } from '../../lib/theme';
import { useStore } from '../../store/AppStore';

const itDay = (iso: string) => iso.split('-').reverse().join('/');

function expiryText(c: Coupon): { text: string; urgent: boolean } | null {
  const s = daysToStart(c);
  if (s != null && s > 0) return { text: s === 1 ? 'Valido da domani' : `Valido dal ${itDay(c.startsOn!)}`, urgent: false };
  const d = daysToExpiry(c);
  if (d == null) return null;
  if (d < 0) return { text: 'Scaduto', urgent: true };
  if (d === 0) return { text: 'Scade oggi', urgent: true };
  if (d === 1) return { text: 'Scade domani', urgent: true };
  if (d <= 7) return { text: `Scade tra ${d} giorni`, urgent: d <= 3 };
  const [y, m, dd] = c.expiresOn!.split('-');
  return { text: `Scade il ${dd}/${m}/${y}`, urgent: false };
}

const SECTION: Record<CouponState, { title: string; badge: string; color: string; bg: string }> = {
  usable: { title: 'Da usare', badge: '✓ Valido oggi', color: colors.primaryDark, bg: colors.primarySoft },
  upcoming: { title: 'Validi più avanti', badge: '⏳ Non ancora valido', color: '#8A5A00', bg: colors.accentSoft },
  off: { title: 'Spenti', badge: 'Spento', color: colors.muted, bg: colors.track },
  expired: { title: 'Scaduti', badge: 'Scaduto', color: colors.danger, bg: colors.dangerSoft },
  used: { title: 'Già usati', badge: '✔ Usato', color: colors.muted, bg: colors.track },
};
const ORDER: CouponState[] = ['usable', 'upcoming', 'off', 'expired', 'used'];

export default function CouponsScreen() {
  const { state, dispatch } = useStore();
  const sorted = sortCoupons(state.coupons);
  const sections = ORDER.map((k) => ({ key: k, data: sorted.filter((c) => couponState(c) === k) })).filter(
    (sec) => sec.data.length,
  );
  const oldOnes = sorted.filter((c) => {
    const st = couponState(c);
    return st === 'expired' || st === 'used';
  });

  const cleanUp = () =>
    Alert.alert('Togliere i buoni vecchi?', `Elimino ${oldOnes.length} buoni scaduti o già usati.`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () => oldOnes.forEach((c) => dispatch({ type: 'coupon/remove', id: c.id })),
      },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: space(4), paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            <OffersBox />
            {sorted.length ? (
              <Text style={styles.intro}>
                In alto i buoni che puoi usare oggi, con la scadenza più vicina prima. Tocca un buono per modificarlo.
              </Text>
            ) : null}
          </>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>
            {SECTION[section.key as CouponState].title} · {section.data.length}
          </Text>
        )}
        ListFooterComponent={
          oldOnes.length ? (
            <Pressable style={styles.cleanBtn} onPress={cleanUp} accessibilityRole="button">
              <Text style={styles.cleanTxt}>🧹 Togli i buoni scaduti e usati ({oldOnes.length})</Text>
            </Pressable>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>🏷️</Text>
            <Text style={styles.emptyTitle}>Nessun buono</Text>
            <Text style={styles.emptyText}>
              Aggiungi i buoni sconto che hai (dal volantino, dalla carta fedeltà, dallo scontrino). Mentre fai la spesa ti dico quanto manca per usarli.
            </Text>
          </View>
        }
        renderItem={({ item: c }) => {
          const st = couponState(c);
          const look = SECTION[st];
          const exp = st === 'used' ? null : expiryText(c);
          const dim = st !== 'usable';
          return (
            <Pressable
              style={[styles.card, dim && { opacity: st === 'upcoming' ? 0.85 : 0.6 }]}
              onPress={() => router.push({ pathname: '/coupon-edit', params: { id: c.id } })}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.badge, { color: look.color, backgroundColor: look.bg }]}>
                    {st === 'used' && c.usedOn ? `✔ Usato il ${itDay(c.usedOn)}` : look.badge}
                  </Text>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.rule}>
                    {c.value === 0
                      ? `Obiettivo: arrivare a ${formatEuro(c.minSpend)}`
                      : `${describeCoupon(c)} se spendi almeno ${formatEuro(c.minSpend)}`}
                  </Text>
                  <Text style={styles.meta}>
                    Su {describeScope(c.scope)} · {c.chain ? `solo da ${c.chain}` : 'in tutti i negozi'}
                  </Text>
                  {exp ? <Text style={[styles.meta, exp.urgent && { color: colors.danger, fontWeight: '800' }]}>{exp.text}</Text> : null}
                </View>
                <Switch
                  value={c.active}
                  onValueChange={(v) =>
                    dispatch({ type: 'coupon/update', id: c.id, patch: v ? { active: true, usedOn: undefined } : { active: false } })
                  }
                  trackColor={{ true: colors.primary }}
                  accessibilityLabel="Buono attivo"
                />
              </View>
              {c.code && (st === 'usable' || st === 'upcoming') ? (
                <Pressable
                  style={styles.showBtn}
                  onPress={() => router.push({ pathname: '/coupon-show', params: { id: c.id } })}
                >
                  <Text style={styles.showText}>▮▯▮▮▯ Mostra in cassa</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
      />
      <View style={styles.bottomBar}>
        <BigButton label="+ Aggiungi buono" onPress={() => router.push('/coupon-edit')} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: font.small, color: colors.muted, marginBottom: space(1) },
  sectionTitle: {
    fontSize: font.small,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: space(4),
    marginBottom: space(2),
  },
  badge: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 4, overflow: 'hidden' },
  cleanBtn: { padding: space(4), alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: space(2) },
  cleanTxt: { fontSize: font.body, fontWeight: '700', color: colors.muted },
  empty: { alignItems: 'center', padding: space(8) },
  emptyTitle: { fontSize: font.big, fontWeight: '800', color: colors.text, marginTop: space(2) },
  emptyText: { fontSize: font.body, color: colors.muted, textAlign: 'center', marginTop: space(2), lineHeight: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space(4),
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space(3),
  },
  cardTop: { flexDirection: 'row', gap: space(3) },
  name: { fontSize: font.big, fontWeight: '800', color: colors.text },
  rule: { fontSize: font.body, color: colors.text, marginTop: 4 },
  meta: { fontSize: font.small, color: colors.muted, marginTop: 4 },
  showBtn: {
    marginTop: space(3),
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingVertical: space(3),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  showText: { fontSize: font.body, fontWeight: '800', color: colors.text },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space(3),
    paddingHorizontal: space(4),
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },
});
