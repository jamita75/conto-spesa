import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetBar } from '../../components/BudgetBar';
import { CouponLine } from '../../components/CouponLine';
import { CouponPicker } from '../../components/CouponPicker';
import { cartCount, cartSubtotal, type CartItem } from '../../features/cart/types';
import { segmentInfo } from '../../features/catalog/segments';
import { computeCouponProgress, couponsForStore, selectableCoupons } from '../../features/coupons/couponLogic';
import { STORE_TYPE_ICON, storeLabel } from '../../features/store/types';
import { formatEuro } from '../../lib/money';
import { colors, font, radius, space } from '../../lib/theme';
import { newId, useStore } from '../../store/AppStore';
import { cartCoupons } from '../../store/reducer';

export default function CartScreen() {
  const { state, dispatch } = useStore();
  const subtotal = cartSubtotal(state.items);
  const storeCoupons = useMemo(() => couponsForStore(state.coupons, state.store), [state.coupons, state.store]);
  const selectable = useMemo(() => selectableCoupons(state.coupons, state.store), [state.coupons, state.store]);
  const skip = state.skipCoupons ?? [];
  const progress = useMemo(
    () => computeCouponProgress(cartCoupons(state), state.items, state.settings.stackCoupons),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.coupons, state.store, state.skipCoupons, state.items, state.settings.stackCoupons],
  );
  const pieces = cartCount(state.items);

  const finish = () => {
    const save = (markUsed: boolean) => {
      dispatch({ type: 'session/finish', id: newId(), markUsed });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    const where = state.store?.chain ? ` da ${state.store.chain}` : '';
    const names = progress.applied.map((c) => `«${c.name}»`).join(', ');
    if (!progress.applied.length) {
      Alert.alert('Spesa finita?', `Salvo ${formatEuro(progress.toPay)} nelle tue spese${where} e svuoto il carrello.`, [
        { text: 'Non ancora', style: 'cancel' },
        { text: 'Sì, salva', onPress: () => save(false) },
      ]);
      return;
    }
    Alert.alert(
      'Spesa finita?',
      `Salvo ${formatEuro(progress.toPay)} nelle tue spese${where}.\n\nHai usato in cassa ${names}? Se sì lo segno come «usato» e non lo conto più nelle prossime spese.`,
      [
        { text: 'Non ancora', style: 'cancel' },
        { text: 'Salva, non usato', onPress: () => save(false) },
        { text: 'Salva, buono usato', onPress: () => save(true) },
      ],
    );
  };

  const clear = () =>
    Alert.alert('Svuotare il carrello?', 'I prodotti verranno tolti senza salvare la spesa.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Svuota', style: 'destructive', onPress: () => dispatch({ type: 'cart/clear' }) },
    ]);

  const changeQty = (item: CartItem, delta: number) => {
    Haptics.selectionAsync();
    if (item.qty + delta <= 0) {
      Alert.alert('Togliere il prodotto?', item.label ?? formatEuro(item.price), [
        { text: 'No', style: 'cancel' },
        { text: 'Togli', style: 'destructive', onPress: () => dispatch({ type: 'item/remove', id: item.id }) },
      ]);
      return;
    }
    dispatch({ type: 'item/update', id: item.id, patch: { qty: item.qty + delta } });
  };

  const header = (
    <>
      <Pressable style={styles.storeChip} onPress={() => router.push('/store')} accessibilityRole="button">
        <Text style={styles.storeIcon}>{state.store ? STORE_TYPE_ICON[state.store.type] : '📍'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.storeSmall}>{state.store ? 'Stai facendo la spesa da' : 'Dove fai la spesa?'}</Text>
          <Text style={styles.storeName}>{state.store ? storeLabel(state.store) : 'Tocca per scegliere il negozio'}</Text>
        </View>
        <Text style={styles.storeEdit}>Cambia</Text>
      </Pressable>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>
          Totale · {pieces} {pieces === 1 ? 'prodotto' : 'prodotti'}
        </Text>
        <Text style={styles.total} accessibilityLabel={`Totale ${formatEuro(subtotal)}`}>
          {formatEuro(subtotal)}
        </Text>
        {progress.discount > 0 ? (
          <View style={styles.payRow}>
            <Text style={styles.discount}>Buono −{formatEuro(progress.discount)}</Text>
            <Text style={styles.toPay}>Paghi {formatEuro(progress.toPay)}</Text>
          </View>
        ) : null}
        {state.items.length ? (
          <View style={styles.headerBtns}>
            <Pressable style={[styles.smallBtn, { flex: 2, backgroundColor: '#fff' }]} onPress={finish}>
              <Text style={[styles.smallBtnText, { color: colors.primaryDark }]}>✓ Spesa finita</Text>
            </Pressable>
            <Pressable style={[styles.smallBtn, { flex: 1 }]} onPress={clear}>
              <Text style={styles.smallBtnText}>Svuota</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <BudgetBar budget={state.settings.budget} toPay={progress.toPay} />

      {selectable.length ? (
        <CouponPicker coupons={selectable} skip={skip} onToggle={(id) => dispatch({ type: 'cart/toggleCoupon', id })} />
      ) : null}
      {storeCoupons.length ? (
        <CouponLine progress={progress} subtotal={subtotal} />
      ) : (
        <Pressable style={styles.addCouponHint} onPress={() => router.push('/coupon-edit')}>
          <Text style={styles.addCouponText}>🏷️ Hai un buono sconto? Aggiungilo: ti dico quanto manca per usarlo.</Text>
        </Pressable>
      )}
      {state.items.length ? <Text style={styles.section}>Nel carrello</Text> : null}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={state.items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Il carrello è vuoto</Text>
            <Text style={styles.emptyText}>Premi «Inquadra prezzo» qui sotto e punta il telefono sul cartellino dello scaffale o sull'etichetta della vaschetta.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => router.push({ pathname: '/add', params: { id: item.id } })}>
            <Text style={{ fontSize: 26 }}>{segmentInfo(item.segment).emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.label ?? 'Prodotto senza nome'}
              </Text>
              {item.privateLabel ? <Text style={styles.plTag}>Marca del negozio</Text> : null}
              <Text style={styles.itemSub}>
                {formatEuro(item.price)}
                {item.qty > 1 ? ` × ${item.qty} = ${formatEuro(item.price * item.qty)}` : ''}
              </Text>
            </View>
            <View style={styles.qtyBox}>
              <Pressable hitSlop={8} onPress={() => changeQty(item, -1)} style={styles.qtyBtn} accessibilityLabel="Togli uno">
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{item.qty}</Text>
              <Pressable hitSlop={8} onPress={() => changeQty(item, +1)} style={styles.qtyBtn} accessibilityLabel="Aggiungi uno">
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      <View style={styles.bottomBar}>
        <Pressable style={[styles.mainBtn, styles.manualBtn]} onPress={() => router.push('/add')}>
          <Text style={[styles.mainBtnText, { color: colors.primaryDark }]}>⌨️ Scrivi</Text>
        </Pressable>
        <Pressable style={[styles.mainBtn, { flex: 2 }]} onPress={() => router.push('/scan')}>
          <Text style={styles.mainBtnText}>📷 Inquadra prezzo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.card,
    marginHorizontal: space(4),
    marginTop: space(2),
    padding: space(3),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeIcon: { fontSize: 28 },
  storeSmall: { fontSize: font.small, color: colors.muted },
  storeName: { fontSize: font.body, fontWeight: '800', color: colors.text },
  storeEdit: { fontSize: font.small, fontWeight: '800', color: colors.primaryDark },
  totalCard: {
    backgroundColor: colors.primary,
    marginHorizontal: space(4),
    marginTop: space(3),
    borderRadius: radius.lg,
    padding: space(5),
  },
  totalLabel: { color: '#D8F2E4', fontSize: font.body, fontWeight: '600' },
  total: { color: '#fff', fontSize: font.huge, fontWeight: '800', marginTop: space(1) },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(2) },
  discount: { color: colors.accentSoft, fontSize: font.body, fontWeight: '700' },
  toPay: { color: '#fff', fontSize: font.title - 2, fontWeight: '800' },
  headerBtns: { flexDirection: 'row', gap: space(2), marginTop: space(4) },
  smallBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.md,
    paddingVertical: space(3),
    alignItems: 'center',
  },
  smallBtnText: { color: '#fff', fontWeight: '800', fontSize: font.body },
  addCouponHint: {
    marginHorizontal: space(4),
    marginTop: space(3),
    padding: space(4),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  addCouponText: { fontSize: font.body, color: colors.text, fontWeight: '600', lineHeight: 23 },
  section: {
    marginHorizontal: space(4),
    marginTop: space(5),
    marginBottom: space(2),
    fontSize: font.small,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  empty: { alignItems: 'center', padding: space(8) },
  emptyTitle: { fontSize: font.big, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: font.body, color: colors.muted, textAlign: 'center', marginTop: space(2), lineHeight: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: space(4),
    marginBottom: space(2),
    borderRadius: radius.md,
    padding: space(4),
    gap: space(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  plTag: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', color: colors.primaryDark, backgroundColor: colors.primarySoft, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginTop: 3 },
  itemSub: { fontSize: font.body - 1, color: colors.muted, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.lg },
  qtyBtn: { paddingHorizontal: space(4), paddingVertical: space(2) },
  qtyBtnText: { fontSize: 26, fontWeight: '800', color: colors.primary },
  qty: { minWidth: 26, textAlign: 'center', fontWeight: '800', fontSize: font.big, color: colors.text },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mainBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space(5),
    alignItems: 'center',
  },
  manualBtn: { backgroundColor: colors.primarySoft },
  mainBtnText: { color: '#fff', fontSize: font.big - 1, fontWeight: '800' },
});
