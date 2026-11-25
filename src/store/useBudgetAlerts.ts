import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { budgetStatus, budgetWorsened, type BudgetLevel } from '../features/budget/budget';
import { computeCouponProgress } from '../features/coupons/couponLogic';
import { formatEuro } from '../lib/money';
import { useStore } from './AppStore';
import { cartCoupons } from './reducer';

/**
 * Avvisa una sola volta quando la spesa si avvicina al limite (vibrazione)
 * e quando lo supera (vibrazione + messaggio). Funziona da qualsiasi schermata,
 * anche mentre si inquadrano i prezzi.
 */
export function useBudgetAlerts() {
  const { state, ready } = useStore();
  const budget = state.settings.budget;
  const toPay = useMemo(() => {
    return computeCouponProgress(cartCoupons(state), state.items, state.settings.stackCoupons).toPay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.coupons, state.store, state.skipCoupons, state.items, state.settings.stackCoupons]);

  const level: BudgetLevel | null = budget ? budgetStatus(toPay, budget).level : null;
  const prev = useRef<BudgetLevel | null | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    const before = prev.current;
    prev.current = level;
    // prima lettura dopo l'apertura dell'app, o limite appena impostato/tolto: nessun avviso
    if (before === undefined || before === null || level === null) return;
    if (!budgetWorsened(before, level)) return;
    if (level === 'over' && budget) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Hai superato il limite',
        `Paghi ${formatEuro(toPay)}, il tuo limite è ${formatEuro(budget)}: ${formatEuro(toPay - budget)} in più.\nTogli qualcosa o tieni pronto un altro modo per pagare.`,
        [{ text: 'Ho capito' }],
      );
    } else if (level === 'near') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [ready, level, budget, toPay]);
}
