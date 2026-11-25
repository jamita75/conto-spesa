import type { Cents } from '../../lib/money';
import type { Segment } from '../catalog/segments';

export type CartItem = {
  id: string;
  /** prezzo unitario in centesimi (per i prodotti pesati: importo dell'etichetta) */
  price: Cents;
  qty: number;
  label?: string;
  source: 'scan' | 'manual';
  createdAt: number;
  /** reparto (proposto dal nome, modificabile) */
  segment?: Segment;
  /** prodotto a marchio del negozio (private label) */
  privateLabel?: boolean;
};

export function cartSubtotal(items: CartItem[]): Cents {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}
