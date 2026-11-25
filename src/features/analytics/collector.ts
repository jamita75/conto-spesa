import type { Consent } from '../consent/types';
import type { ShoppingSession } from '../history/types';

/**
 * Record di una spesa, preparato solo se l'utente ha dato il consenso.
 * Volutamente NON contiene: nome, telefono, email, identificativi del dispositivo, posizione,
 * orario preciso (solo giorno), nome libero del negozio se scritto a mano.
 * L'invio (uploader.ts) lo collega al codice casuale (pseudonimo) del telefono.
 */
export const QUEUE_LIMIT = 300;

export type AnonymousPurchase = {
  v: 1;
  /** id della spesa sul telefono: evita doppioni se l'invio viene ripetuto */
  rid: string;
  day: string; // yyyy-mm-dd
  weekday: number; // 0 = domenica
  storeType?: 'food' | 'nonfood';
  chain?: string; // solo insegne della lista predefinita
  items: { name?: string; price: number; qty: number; scanned: boolean; segment?: string; privateLabel?: boolean }[];
  total: number;
  discount: number;
  couponsUsed: number;
  shareWithPartners: boolean;
};

export function buildAnonymousRecord(
  s: ShoppingSession,
  consent: Consent,
  knownChains: string[],
): AnonymousPurchase | null {
  if (!consent.stats && !consent.partners) return null;
  const d = new Date(s.date);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    v: 1,
    rid: s.id,
    day,
    weekday: d.getDay(),
    storeType: s.store?.type,
    chain: s.store?.chain && knownChains.includes(s.store.chain) ? s.store.chain : undefined,
    items: s.items.map((i) => ({
      name: i.label?.slice(0, 40),
      price: i.price,
      qty: i.qty,
      scanned: i.source === 'scan',
      segment: i.segment,
      privateLabel: i.privateLabel,
    })),
    total: s.toPay,
    discount: s.discount,
    couponsUsed: s.couponsUsed.length,
    shareWithPartners: consent.partners,
  };
}
