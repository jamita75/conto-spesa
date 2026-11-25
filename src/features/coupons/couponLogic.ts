import type { Cents } from '../../lib/money';
import type { CartItem } from '../cart/types';
import { segmentInfo } from '../catalog/segments';
import type { Store } from '../store/types';
import type { Coupon, CouponScope } from './types';

/** Buoni validi nel negozio scelto: quelli senza insegna valgono ovunque. */
export function couponsForStore(coupons: Coupon[], store?: Store): Coupon[] {
  if (!store?.chain) return coupons;
  const chain = store.chain.toLowerCase();
  return coupons.filter((c) => !c.chain || c.chain.toLowerCase() === chain);
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const isoToTime = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

/** giorni mancanti alla scadenza (0 = scade oggi, negativo = scaduto) */
export function daysToExpiry(c: Coupon, today = new Date()): number | undefined {
  if (!c.expiresOn) return undefined;
  return Math.round((isoToTime(c.expiresOn) - dayStart(today)) / 86_400_000);
}

/** giorni mancanti all'inizio di validità (positivo = non ancora valido) */
export function daysToStart(c: Coupon, today = new Date()): number | undefined {
  if (!c.startsOn) return undefined;
  return Math.round((isoToTime(c.startsOn) - dayStart(today)) / 86_400_000);
}

export function isExpired(c: Coupon, today = new Date()): boolean {
  const d = daysToExpiry(c, today);
  return d != null && d < 0;
}

export function isNotYetValid(c: Coupon, today = new Date()): boolean {
  const d = daysToStart(c, today);
  return d != null && d > 0;
}

/** valido oggi: attivo, già iniziato e non scaduto */
export function isUsableToday(c: Coupon, today = new Date()): boolean {
  return c.active && !isExpired(c, today) && !isNotYetValid(c, today);
}

export function itemInScope(item: CartItem, scope?: CouponScope): boolean {
  if (!scope || scope.kind === 'all') return true;
  if (scope.kind === 'privateLabel') return item.privateLabel === true;
  if (scope.kind === 'otherBrands') return item.privateLabel !== true;
  return item.segment != null && scope.segments.includes(item.segment);
}

/** totale dei soli prodotti su cui vale il buono */
export function eligibleSubtotal(c: Coupon, items: CartItem[]): Cents {
  return items.filter((i) => itemInScope(i, c.scope)).reduce((s, i) => s + i.price * i.qty, 0);
}

export function couponSaving(c: Pick<Coupon, 'kind' | 'value' | 'minSpend'>, base: Cents): Cents {
  if (base < c.minSpend || base <= 0) return 0;
  const raw = c.kind === 'percent' ? Math.round((base * c.value) / 100) : c.value;
  return Math.min(raw, base);
}

export type CouponStatus = {
  coupon: Coupon;
  /** spesa che conta per questo buono */
  base: Cents;
  missing: Cents;
  unlocked: boolean;
  saving: Cents;
};

export type CouponProgress = {
  /** buoni su tutta la spesa, validi oggi, ordinati per spesa minima (la "linea") */
  milestones: Coupon[];
  /** buoni limitati a marca o reparto, ciascuno con il suo avanzamento */
  scoped: CouponStatus[];
  /** buoni attivi ma non ancora validi oggi (promemoria) */
  upcoming: Coupon[];
  unlocked: Coupon[];
  /** buoni applicati al conto (uno solo, o tutti se cumulabili) */
  applied: Coupon[];
  discount: Cents;
  toPay: Cents;
  /** prossimo traguardo sulla linea */
  next?: { coupon: Coupon; missing: Cents; extraSaving: Cents };
  scaleMax: Cents;
};

const isWholeCart = (c: Coupon) => !c.scope || c.scope.kind === 'all';

export function computeCouponProgress(
  coupons: Coupon[],
  items: CartItem[],
  stackable: boolean,
  today = new Date(),
): CouponProgress {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const usable = coupons.filter((c) => isUsableToday(c, today));
  const upcoming = coupons.filter((c) => c.active && isNotYetValid(c, today));

  const statuses: CouponStatus[] = usable.map((c) => {
    const base = isWholeCart(c) ? subtotal : eligibleSubtotal(c, items);
    return {
      coupon: c,
      base,
      missing: Math.max(0, c.minSpend - base),
      unlocked: base >= c.minSpend && base > 0,
      saving: couponSaving(c, base),
    };
  });

  let applied: CouponStatus[];
  if (stackable) {
    applied = statuses.filter((s) => s.saving > 0);
  } else {
    const best = statuses.reduce<CouponStatus | undefined>((acc, s) => (!acc || s.saving > acc.saving ? s : acc), undefined);
    applied = best && best.saving > 0 ? [best] : [];
  }
  const discount = Math.min(subtotal, applied.reduce((sum, s) => sum + s.saving, 0));

  const milestones = statuses
    .filter((s) => isWholeCart(s.coupon))
    .map((s) => s.coupon)
    .sort((a, b) => a.minSpend - b.minSpend);
  const nextCoupon = milestones.find((c) => c.minSpend > subtotal);
  let next: CouponProgress['next'];
  if (nextCoupon) {
    const savingThen = couponSaving(nextCoupon, nextCoupon.minSpend);
    next = {
      coupon: nextCoupon,
      missing: nextCoupon.minSpend - subtotal,
      extraSaving: Math.max(0, stackable ? savingThen : savingThen - discount),
    };
  }
  const top = milestones.length ? milestones[milestones.length - 1].minSpend : 0;

  return {
    milestones,
    scoped: statuses.filter((s) => !isWholeCart(s.coupon)).sort((a, b) => a.missing - b.missing),
    upcoming,
    unlocked: statuses.filter((s) => s.unlocked).map((s) => s.coupon),
    applied: applied.map((s) => s.coupon),
    discount,
    toPay: subtotal - discount,
    next,
    scaleMax: Math.max(Math.round(top * 1.1), subtotal, 1),
  };
}

export function describeCoupon(c: Pick<Coupon, 'kind' | 'value'>): string {
  if (c.value === 0) return 'Obiettivo di spesa';
  return c.kind === 'percent' ? `-${c.value}%` : `-${(c.value / 100).toFixed(2).replace('.', ',')} €`;
}

/** "tutta la spesa", "prodotti a marchio del negozio", "Carne e Pesce"… */
export function describeScope(scope?: CouponScope): string {
  if (!scope || scope.kind === 'all') return 'tutta la spesa';
  if (scope.kind === 'privateLabel') return 'prodotti a marchio del negozio';
  if (scope.kind === 'otherBrands') return 'prodotti di altre marche';
  const names = scope.segments.map((s) => segmentInfo(s).label);
  if (names.length === 0) return 'nessun reparto';
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
