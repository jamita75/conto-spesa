import * as Haptics from 'expo-haptics';
import { Link, router } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CouponLine } from '../components/CouponLine';
import { cartCount, cartSubtotal, type CartItem } from '../features/cart/types';
import { computeCouponProgress } from '../features/coupons/couponLogic';
import { formatEuro } from '../lib/money';
import { colors, radius, space } from '../lib/theme';
import { useStore } from '../store/AppStore';

export default function CartScreen() {
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const subtotal = cartSubtotal(state.items);
  const progress = useMemo(
    () => computeCouponProgress(state.coupons, subtotal, state.settings.stackCoupons),
    [state.coupons, subtotal, state.settings.stackCoupons],
  );

  const clearCart = () =>
    Alert.alert('Nuova spesa', 'Svuotare il carrello? I coupon restano salvati.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Svuota', style: 'destructive', onPress: () => dispatch({ type: 'cart/clear' }) },
    ]);

  const changeQty = (item: CartItem, delta: number) => {
    Haptics.selectionAsync();
    dispatch({ type: 'item/update', id: item.id, patch: { qty: item.qty + delta } });
  };

  const header = (
    <>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>
          Totale · {cartCount(state.items)} {cartCount(state.items) === 1 ? 'pezzo' : 'pezzi'}
        </Text>
        <Text style={styles.total}>{formatEuro(subtotal)}</Text>
        {progress.discount > 0 ? (
          <View style={styles.payRow}>
            <Text style={styles.discount}>
              Coupon −{formatEuro(progress.discount)}
            </Text>
            <Text style={styles.toPay}>Paghi {formatEuro(progress.toPay)}</Text>
          </View>
        ) : null}
        <View style={styles.headerLinks}>
          <Link href="/coupons" asChild>
            <Pressable style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>
                🏷️ Coupon{state.coupons.length ? ` (${state.coupons.length})` : ''}
              </Text>
            </Pressable>
          </Link>
          {state.items.length ? (
            <Pressable style={styles.smallBtn} onPress={clearCart}>
              <Text style={styles.smallBtnText}>🧹 Nuova spesa</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <CouponLine progress={progress} subtotal={subtotal} />
      {state.items.length ? <Text style={styles.section}>Prodotti</Text> : null}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={state.items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Carrello vuoto</Text>
            <Text style={styles.emptyText}>
              Inquadra il prezzo sull'etichetta: il totale si aggiorna da solo.{'\n'}
              Aggiungi i tuoi buoni da «Coupon» per vedere quanto manca allo sconto.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onLongPress={() =>
              Alert.alert('Rimuovere?', item.label ?? formatEuro(item.price), [
                { text: 'No', style: 'cancel' },
                { text: 'Rimuovi', style: 'destructive', onPress: () => dispatch({ type: 'item/remove', id: item.id }) },
              ])
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.label ?? (item.source === 'scan' ? 'Prodotto scansionato' : 'Prodotto')}</Text>
              <Text style={styles.itemSub}>
                {formatEuro(item.price)} {item.qty > 1 ? `× ${item.qty}` : ''}
              </Text>
            </View>
            <View style={styles.qtyBox}>
              <Pressable hitSlop={8} onPress={() => changeQty(item, -1)} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{item.qty}</Text>
              <Pressable hitSlop={8} onPress={() => changeQty(item, +1)} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.itemTotal}>{formatEuro(item.price * item.qty)}</Text>
          </Pressable>
        )}
      />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space(3) }]}>
        <Pressable style={[styles.mainBtn, styles.manualBtn]} onPress={() => router.push('/add')}>
          <Text style={[styles.mainBtnText, { color: colors.primaryDark }]}>⌨️ A mano</Text>
        </Pressable>
        <Pressable style={[styles.mainBtn, { flex: 2 }]} onPress={() => router.push('/scan')}>
          <Text style={styles.mainBtnText}>📷 Inquadra prezzo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    backgroundColor: colors.primary,
    marginHorizontal: space(4),
    marginTop: space(2),
    borderRadius: radius.lg,
    padding: space(5),
  },
  totalLabel: { color: '#D8F2E4', fontSize: 14, fontWeight: '600' },
  total: { color: '#fff', fontSize: 46, fontWeight: '800', marginTop: space(1) },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(2) },
  discount: { color: colors.accentSoft, fontSize: 15, fontWeight: '700' },
  toPay: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerLinks: { flexDirection: 'row', gap: space(2), marginTop: space(4) },
  smallBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.lg,
    paddingVertical: space(2),
    paddingHorizontal: space(3),
  },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  section: {
    marginHorizontal: space(4),
    marginTop: space(5),
    marginBottom: space(2),
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  empty: { alignItems: 'center', padding: space(8) },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: space(2), lineHeight: 22 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: space(4),
    marginBottom: space(2),
    borderRadius: radius.md,
    padding: space(3),
    gap: space(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.lg },
  qtyBtn: { paddingHorizontal: space(3), paddingVertical: space(1) },
  qtyBtnText: { fontSize: 20, fontWeight: '700', color: colors.primary },
  qty: { minWidth: 22, textAlign: 'center', fontWeight: '700', color: colors.text },
  itemTotal: { width: 78, textAlign: 'right', fontSize: 16, fontWeight: '800', color: colors.text },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingTop: space(3),
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mainBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
  },
  manualBtn: { backgroundColor: colors.primarySoft },
  mainBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
