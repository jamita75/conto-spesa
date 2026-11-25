import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { computeCouponProgress, describeCoupon, newlyUnlocked } from '../features/coupons/couponLogic';
import { formatEuro } from '../lib/money';
import { useStore } from './AppStore';
import { cartCoupons } from './reducer';

/**
 * Quando la spesa raggiunge la cifra di un buono scelto per questa spesa:
 * vibrazione + messaggio (una sola volta per buono), con il pulsante per mostrare il codice.
 */
export function useCouponAlerts() {
  const { state, ready } = useStore();
  const unlocked = useMemo(
    () => computeCouponProgress(cartCoupons(state), state.items, state.settings.stackCoupons).unlocked,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.coupons, state.store, state.skipCoupons, state.items, state.settings.stackCoupons],
  );
  const prev = useRef<string[] | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    const before = prev.current;
    prev.current = unlocked.map((c) => c.id);
    if (before === undefined) return; // apertura dell'app: nessun avviso
    const fresh = newlyUnlocked(before, unlocked);
    if (!fresh.length) return;
    const c = fresh[0];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const msg =
      c.value === 0
        ? `Hai raggiunto ${formatEuro(c.minSpend)}: obiettivo «${c.name}» centrato.`
        : `Hai raggiunto ${formatEuro(c.minSpend)}: in cassa puoi usare «${c.name}» (${describeCoupon(c)}).`;
    Alert.alert('🎉 Buono sbloccato', fresh.length > 1 ? `${msg}\nSbloccati anche altri ${fresh.length - 1}.` : msg, [
      ...(c.code
        ? [{ text: 'Mostra codice', onPress: () => router.push({ pathname: '/coupon-show', params: { id: c.id } }) }]
        : []),
      { text: 'Ok' },
    ]);
  }, [ready, unlocked]);
}
