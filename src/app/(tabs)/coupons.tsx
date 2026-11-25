import { router } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BigButton } from '../../components/ui';
import { daysToExpiry, describeCoupon, isExpired } from '../../features/coupons/couponLogic';
import type { Coupon } from '../../features/coupons/types';
import { formatEuro } from '../../lib/money';
import { colors, font, radius, space } from '../../lib/theme';
import { useStore } from '../../store/AppStore';

function expiryText(c: Coupon): { text: string; urgent: boolean } | null {
  const d = daysToExpiry(c);
  if (d == null) return null;
  if (d < 0) return { text: 'Scaduto', urgent: true };
  if (d === 0) return { text: 'Scade oggi', urgent: true };
  if (d === 1) return { text: 'Scade domani', urgent: true };
  if (d <= 7) return { text: `Scade tra ${d} giorni`, urgent: d <= 3 };
  const [y, m, dd] = c.expiresOn!.split('-');
  return { text: `Scade il ${dd}/${m}/${y}`, urgent: false };
}

export default function CouponsScreen() {
  const { state, dispatch } = useStore();
  const sorted = [...state.coupons].sort(
    (a, b) => Number(isExpired(a)) - Number(isExpired(b)) || a.minSpend - b.minSpend,
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={sorted}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space(4), paddingBottom: 120 }}
        ListHeaderComponent={
          sorted.length ? (
            <Text style={styles.intro}>Tocca un buono per modificarlo. Con «Mostra in cassa» compare il codice a barre.</Text>
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
          const exp = expiryText(c);
          const off = !c.active || isExpired(c);
          return (
            <Pressable
              style={[styles.card, off && { opacity: 0.55 }]}
              onPress={() => router.push({ pathname: '/coupon-edit', params: { id: c.id } })}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.rule}>
                    {c.value === 0
                      ? `Obiettivo: arrivare a ${formatEuro(c.minSpend)}`
                      : `${describeCoupon(c)} se spendi almeno ${formatEuro(c.minSpend)}`}
                  </Text>
                  <Text style={styles.meta}>{c.chain ? `Solo da ${c.chain}` : 'In tutti i negozi'}</Text>
                  {exp ? <Text style={[styles.meta, exp.urgent && { color: colors.danger, fontWeight: '800' }]}>{exp.text}</Text> : null}
                </View>
                <Switch
                  value={c.active}
                  onValueChange={(v) => dispatch({ type: 'coupon/update', id: c.id, patch: { active: v } })}
                  trackColor={{ true: colors.primary }}
                  accessibilityLabel="Buono attivo"
                />
              </View>
              {c.code ? (
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
  intro: { fontSize: font.small, color: colors.muted, marginBottom: space(3) },
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
