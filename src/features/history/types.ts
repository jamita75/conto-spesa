import type { Cents } from '../../lib/money';
import type { CartItem } from '../cart/types';
import type { Segment } from '../catalog/segments';
import type { Store, StoreType } from '../store/types';

/** Una spesa conclusa e salvata nello storico (solo sul telefono). */
export type ShoppingSession = {
  id: string;
  /** timestamp di chiusura */
  date: number;
  store?: Store;
  items: CartItem[];
  subtotal: Cents;
  discount: Cents;
  toPay: Cents;
  couponsUsed: string[];
};

export type MonthSummary = {
  count: number;
  spent: Cents;
  saved: Cents;
  byType: Record<StoreType | 'unknown', Cents>;
  /** spesa per reparto (prezzi pieni, prima degli sconti) */
  bySegment: Partial<Record<Segment, Cents>>;
  /** quanto speso in prodotti a marchio del negozio */
  privateLabel: Cents;
};

export function monthSummary(history: ShoppingSession[], year: number, month: number): MonthSummary {
  const res: MonthSummary = { count: 0, spent: 0, saved: 0, byType: { food: 0, nonfood: 0, unknown: 0 }, bySegment: {}, privateLabel: 0 };
  for (const s of history) {
    const d = new Date(s.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    res.count++;
    res.spent += s.toPay;
    res.saved += s.discount;
    res.byType[s.store?.type ?? 'unknown'] += s.toPay;
    for (const i of s.items) {
      const seg: Segment = i.segment ?? 'altro';
      res.bySegment[seg] = (res.bySegment[seg] ?? 0) + i.price * i.qty;
      if (i.privateLabel) res.privateLabel += i.price * i.qty;
    }
  }
  return res;
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const monthName = (m: number) => MONTHS[m];

export function formatDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
