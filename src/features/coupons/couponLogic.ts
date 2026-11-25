import type { Cents } from '../../lib/money';
import type { Coupon } from './types';

export function couponSaving(c: Coupon, subtotal: Cents): Cents {
  if (subtotal < c.minSpend) return 0;
  const raw = c.kind === 'percent' ? Math.round((subtotal * c.value) / 100) : c.value;
  return Math.min(raw, subtotal);
}

export function isExpired(c: Coupon, today = new Date()): boolean {
  if (!c.expiresOn) return false;
  const end = new Date(c.expiresOn + 'T23:59:59');
  return end.getTime() < today.getTime();
}

export type CouponProgress = {
  /** coupon attivi e non scaduti, ordinati per spesa minima */
  milestones: Coupon[];
  /** coupon già sbloccati */
  unlocked: Coupon[];
  /** coupon applicati al conto (uno solo, o tutti se cumulabili) */
  applied: Coupon[];
  discount: Cents;
  toPay: Cents;
  /** prossimo traguardo da raggiungere */
  next?: { coupon: Coupon; missing: Cents; extraSaving: Cents };
  /** fondo scala della linea: traguardo più alto (+10%) o il totale */
  scaleMax: Cents;
};

export function computeCouponProgress(
  coupons: Coupon[],
  subtotal: Cents,
  stackable: boolean,
  today = new Date(),
): CouponProgress {
  const milestones = coupons
    .filter((c) => c.active && !isExpired(c, today))
    .sort((a, b) => a.minSpend - b.minSpend);

  const unlocked = milestones.filter((c) => subtotal >= c.minSpend);

  let applied: Coupon[] = [];
  if (stackable) {
    applied = unlocked.filter((c) => couponSaving(c, subtotal) > 0);
  } else {
    const best = unlocked.reduce<Coupon | undefined>(
      (acc, c) => (!acc || couponSaving(c, subtotal) > couponSaving(acc, subtotal) ? c : acc),
      undefined,
    );
    if (best && couponSaving(best, subtotal) > 0) applied = [best];
  }

  const discount = Math.min(
    subtotal,
    applied.reduce((sum, c) => sum + couponSaving(c, subtotal), 0),
  );

  const nextCoupon = milestones.find((c) => c.minSpend > subtotal);
  let next: CouponProgress['next'];
  if (nextCoupon) {
    const savingThen = stackable
      ? discount + couponSaving(nextCoupon, nextCoupon.minSpend)
      : Math.max(discount, couponSaving(nextCoupon, nextCoupon.minSpend));
    next = {
      coupon: nextCoupon,
      missing: nextCoupon.minSpend - subtotal,
      extraSaving: Math.max(0, savingThen - discount),
    };
  }

  const top = milestones.length ? milestones[milestones.length - 1].minSpend : 0;
  const scaleMax = Math.max(Math.round(top * 1.1), subtotal, 1);

  return { milestones, unlocked, applied, discount, toPay: subtotal - discount, next, scaleMax };
}

export function describeCoupon(c: Coupon): string {
  if (c.value === 0) return 'Obiettivo di spesa';
  return c.kind === 'percent' ? `-${c.value}%` : `-${(c.value / 100).toFixed(2).replace('.', ',')} €`;
}
