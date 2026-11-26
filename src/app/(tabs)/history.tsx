import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SEGMENTS } from '../../features/catalog/segments';
import { formatDay, monthName, monthSummary } from '../../features/history/types';
import { STORE_TYPE_ICON, storeLabel } from '../../features/store/types';
import { formatEuro } from '../../lib/money';
import { colors, font, radius, space } from '../../lib/theme';
import { useStore } from '../../store/AppStore';

/** Controllo della spesa: totale del mese, divisione alimentare / non alimentare, elenco spese. */
export default function HistoryScreen() {
  const { state, dispatch } = useStore();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [open, setOpen] = useState<string | null>(null);

  const summary = useMemo(() => monthSummary(state.history, cursor.y, cursor.m), [state.history, cursor]);
  const sessions = useMemo(
    () =>
      state.history.filter((s) => {
        const d = new Date(s.date);
        return d.getFullYear() === cursor.y && d.getMonth() === cursor.m;
      }),
    [state.history, cursor],
  );

  const move = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const isCurrent = cursor.y === now.getFullYear() && cursor.m === now.getMonth();

  return (
    <FlatList
      data={sessions}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}
      ListHeaderComponent={
        <>
          <View style={styles.monthRow}>
            <Pressable style={styles.arrow} onPress={() => move(-1)} accessibilityLabel="Mese precedente">
              <Text style={styles.arrowText}>‹</Text>
            </Pressable>
            <Text style={styles.month}>
              {monthName(cursor.m)} {cursor.y}
            </Text>
            <Pressable style={[styles.arrow, isCurrent && { opacity: 0.3 }]} disabled={isCurrent} onPress={() => move(1)} accessibilityLabel="Mese successivo">
              <Text style={styles.arrowText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.summary}>
            <Text style={styles.sumLabel}>Hai speso</Text>
            <Text style={styles.sumValue}>{formatEuro(summary.spent)}</Text>
            <Text style={styles.sumSub}>
              {summary.count} {summary.count === 1 ? 'spesa' : 'spese'}
              {summary.saved > 0 ? ` · risparmiati ${formatEuro(summary.saved)} con i buoni` : ''}
            </Text>
            <View style={styles.split}>
              <View style={styles.splitBox}>
                <Text style={styles.splitLabel}>🛒 Alimentare</Text>
                <Text style={styles.splitValue}>{formatEuro(summary.byType.food)}</Text>
              </View>
              <View style={styles.splitBox}>
                <Text style={styles.splitLabel}>🏬 Non alimentare</Text>
                <Text style={styles.splitValue}>{formatEuro(summary.byType.nonfood)}</Text>
              </View>
            </View>
            {summary.byType.unknown > 0 ? (
              <Text style={styles.sumSub}>Senza negozio indicato: {formatEuro(summary.byType.unknown)}</Text>
            ) : null}
          </View>

          {!state.consent.partners && summary.count > 0 ? (
            <Pressable style={styles.teaser} onPress={() => router.push('/(tabs)/coupons')}>
              <Text style={styles.teaserText}>
                🎁 Scopri buoni sconto che non conosci: con la tua autorizzazione li ricevi qui. Tocca per vederli.
              </Text>
            </Pressable>
          ) : null}

          {summary.count ? (
            <View style={styles.segCard}>
              <Text style={styles.segTitle}>Per reparto</Text>
              {(() => {
                const rows = SEGMENTS.map((x) => ({ ...x, v: summary.bySegment[x.id] ?? 0 }))
                  .filter((r) => r.v > 0)
                  .sort((a, b) => b.v - a.v);
                const max = rows[0]?.v ?? 1;
                return rows.map((r) => (
                  <View key={r.id} style={styles.segRow}>
                    <Text style={styles.segName}>
                      {r.emoji} {r.label}
                    </Text>
                    <View style={styles.segBarTrack}>
                      <View style={[styles.segBar, { width: `${(r.v / max) * 100}%` }]} />
                    </View>
                    <Text style={styles.segValue}>{formatEuro(r.v)}</Text>
                  </View>
                ));
              })()}
              {summary.privateLabel > 0 ? (
                <Text style={styles.cardSub}>🏷️ Di cui a marchio del negozio: {formatEuro(summary.privateLabel)}</Text>
              ) : null}
            </View>
          ) : null}
        </>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          Nessuna spesa salvata in questo mese.{'\n'}A fine spesa premi «Spesa finita» per ritrovarla qui.
        </Text>
      }
      renderItem={({ item: s }) => {
        const expanded = open === s.id;
        return (
          <Pressable
            style={styles.card}
            onPress={() => setOpen(expanded ? null : s.id)}
            onLongPress={() =>
              Alert.alert('Eliminare questa spesa?', `${formatDay(s.date)} · ${formatEuro(s.toPay)}`, [
                { text: 'No', style: 'cancel' },
                { text: 'Elimina', style: 'destructive', onPress: () => dispatch({ type: 'history/remove', id: s.id }) },
              ])
            }
          >
            <View style={styles.cardRow}>
              <Text style={{ fontSize: 28 }}>{s.store ? STORE_TYPE_ICON[s.store.type] : '🧾'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{s.store ? storeLabel(s.store) : 'Negozio non indicato'}</Text>
                <Text style={styles.cardSub}>
                  {formatDay(s.date)} · {s.items.reduce((n, i) => n + i.qty, 0)} prodotti
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardTotal}>{formatEuro(s.toPay)}</Text>
                {s.discount > 0 ? <Text style={styles.saved}>−{formatEuro(s.discount)}</Text> : null}
              </View>
            </View>
            {expanded ? (
              <View style={styles.items}>
                {s.items.map((i) => (
                  <View key={i.id} style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {i.qty > 1 ? `${i.qty} × ` : ''}
                      {i.label ?? 'Prodotto senza nome'}
                    </Text>
                    <Text style={styles.itemPrice}>{formatEuro(i.price * i.qty)}</Text>
                  </View>
                ))}
                {s.couponsUsed.length ? <Text style={styles.cardSub}>Buoni usati: {s.couponsUsed.join(', ')}</Text> : null}
              </View>
            ) : (
              <Text style={styles.more}>Tocca per vedere i prodotti</Text>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(3) },
  arrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  arrowText: { fontSize: 28, fontWeight: '800', color: colors.primaryDark, marginTop: -3 },
  month: { fontSize: font.big, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  summary: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: space(5), marginBottom: space(4) },
  sumLabel: { color: '#D8F2E4', fontSize: font.body, fontWeight: '600' },
  sumValue: { color: '#fff', fontSize: 40, fontWeight: '800' },
  sumSub: { color: '#E8F7EF', fontSize: font.small, marginTop: space(1) },
  split: { flexDirection: 'row', gap: space(2), marginTop: space(4) },
  splitBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.md, padding: space(3) },
  splitLabel: { color: '#fff', fontSize: font.small, fontWeight: '700' },
  splitValue: { color: '#fff', fontSize: font.big, fontWeight: '800', marginTop: 2 },
  teaser: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space(4), marginBottom: space(4), borderWidth: 1.5, borderColor: colors.accent, borderStyle: 'dashed' },
  teaserText: { fontSize: font.body - 1, color: colors.text, fontWeight: '700', lineHeight: 22 },
  segCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), marginBottom: space(4), borderWidth: 1, borderColor: colors.border, gap: space(2) },
  segTitle: { fontSize: font.small, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  segRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  segName: { width: 150, fontSize: 14, color: colors.text, fontWeight: '600' },
  segBarTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden' },
  segBar: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  segValue: { width: 78, textAlign: 'right', fontSize: 14, fontWeight: '800', color: colors.text },
  empty: { fontSize: font.body, color: colors.muted, textAlign: 'center', marginTop: space(6), lineHeight: 24 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), marginBottom: space(3), borderWidth: 1, borderColor: colors.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  cardTitle: { fontSize: font.body, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  cardTotal: { fontSize: font.big, fontWeight: '800', color: colors.text },
  saved: { fontSize: font.small, fontWeight: '700', color: colors.primary },
  more: { fontSize: font.small, color: colors.primaryDark, marginTop: space(2), fontWeight: '600' },
  items: { marginTop: space(3), borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space(2), gap: space(1) },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space(3) },
  itemName: { flex: 1, fontSize: font.body - 1, color: colors.text },
  itemPrice: { fontSize: font.body - 1, fontWeight: '700', color: colors.text },
});
