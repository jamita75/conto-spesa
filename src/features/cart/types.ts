import type { Cents } from '../../lib/money';

export type CartItem = {
  id: string;
  /** prezzo unitario in centesimi */
  price: Cents;
  qty: number;
  label?: string;
  source: 'scan' | 'manual';
  createdAt: number;
};

export function cartSubtotal(items: CartItem[]): Cents {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}
