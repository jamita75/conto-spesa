import type { Cents } from '../../lib/money';
import type { Segment } from '../catalog/segments';

export type CouponKind = 'amount' | 'percent';

/** Su quali prodotti vale il buono. */
export type CouponScope =
  | { kind: 'all' }
  /** solo prodotti a marchio del negozio (private label) */
  | { kind: 'privateLabel' }
  /** solo prodotti di altre marche (non a marchio del negozio) */
  | { kind: 'otherBrands' }
  /** solo alcuni reparti (es. carne, frutta e verdura) */
  | { kind: 'segments'; segments: Segment[] };

export type Coupon = {
  id: string;
  /** es. "Buono Conad 5€" */
  name: string;
  /** codice promozionale da mostrare in cassa (facoltativo) */
  code?: string;
  /** spesa minima per sbloccarlo, in centesimi (calcolata solo sui prodotti del suo ambito) */
  minSpend: Cents;
  kind: CouponKind;
  /** amount: centesimi di sconto · percent: percentuale intera (10 = 10%). 0 = solo obiettivo */
  value: number;
  active: boolean;
  /** inizio validità ISO yyyy-mm-dd (facoltativo) */
  startsOn?: string;
  /** scadenza ISO yyyy-mm-dd (facoltativa) */
  expiresOn?: string;
  /** insegna dove vale il buono; vuoto = tutti i negozi */
  chain?: string;
  /** prodotti su cui vale; assente = tutta la spesa */
  scope?: CouponScope;
  /** chi l'ha inserito: l'utente o (in futuro) un'insegna partner per promozioni dirette */
  source?: 'user' | 'partner';
  /** giorno in cui è stato usato in cassa (ISO yyyy-mm-dd): da allora è spento */
  usedOn?: string;
  /** id dell'offerta partner da cui è stato preso */
  offerId?: string;
};
