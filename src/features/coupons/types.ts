import type { Cents } from '../../lib/money';

export type CouponKind = 'amount' | 'percent';

export type Coupon = {
  id: string;
  /** es. "Buono Conad 5€" */
  name: string;
  /** codice promozionale da mostrare in cassa (facoltativo) */
  code?: string;
  /** spesa minima per sbloccarlo, in centesimi */
  minSpend: Cents;
  kind: CouponKind;
  /** amount: centesimi di sconto · percent: percentuale intera (10 = 10%). 0 = solo obiettivo */
  value: number;
  active: boolean;
  /** scadenza ISO yyyy-mm-dd (facoltativa) */
  expiresOn?: string;
};
