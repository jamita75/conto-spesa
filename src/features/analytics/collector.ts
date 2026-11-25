import type { Consent } from '../consent/types';
import type { ShoppingSession } from '../history/types';

/**
 * Record ANONIMO di una spesa, preparato solo se l'utente ha dato il consenso.
 * Volutamente NON contiene: identificativo del telefono o dell'utente, posizione,
 * orario preciso (solo giorno), nome libero del negozio se scritto a mano.
 *
 * L'invio richiede un server (non ancora presente): finché UPLOAD_ENDPOINT è null
 * i record restano in coda sul telefono e vengono cancellati se il consenso viene revocato.
 */
export const UPLOAD_ENDPOINT: string | null = null;
export const QUEUE_LIMIT = 300;

export type AnonymousPurchase = {
  v: 1;
  day: string; // yyyy-mm-dd
  weekday: number; // 0 = domenica
  storeType?: 'food' | 'nonfood';
  chain?: string; // solo insegne della lista predefinita
  items: { name?: string; price: number; qty: number; scanned: boolean }[];
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
    day,
    weekday: d.getDay(),
    storeType: s.store?.type,
    chain: s.store?.chain && knownChains.includes(s.store.chain) ? s.store.chain : undefined,
    items: s.items.map((i) => ({
      name: i.label?.slice(0, 40),
      price: i.price,
      qty: i.qty,
      scanned: i.source === 'scan',
    })),
    total: s.toPay,
    discount: s.discount,
    couponsUsed: s.couponsUsed.length,
    shareWithPartners: consent.partners,
  };
}
