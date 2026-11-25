import type { Segment } from '../catalog/segments';
import { SEGMENTS } from '../catalog/segments';
import type { Coupon, CouponScope } from '../coupons/types';

/**
 * OFFERTE RISERVATE DEI NEGOZI PARTNER, lette da un file online.
 * Per pubblicare un'offerta su TUTTI i telefoni senza aggiornare l'app basta modificare
 * `offers/offerte.json` nel repository GitHub (vedi GUIDA.md). L'app lo rilegge a ogni apertura.
 * Le offerte si vedono solo con il consenso «Condividi con i negozi partner».
 */
export const OFFERS_URL = 'https://raw.githubusercontent.com/jamita75/conto-spesa/main/offers/offerte.json';

/** chi accetta la condivisione entro questa data diventa «Socio fondatore» */
export const FOUNDER_UNTIL = '2027-06-30';

export type PartnerOffer = {
  id: string;
  /** insegna che offre il buono (vuoto = valido ovunque) */
  chain?: string;
  title: string;
  description?: string;
  kind: 'amount' | 'percent';
  /** amount: centesimi · percent: percentuale intera */
  value: number;
  minSpend: number;
  scope?: CouponScope;
  code?: string;
  startsOn?: string;
  expiresOn?: string;
  /** visibile solo ai Soci fondatori (accesso anticipato) */
  foundersOnly?: boolean;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SEGMENT_IDS = new Set(SEGMENTS.map((s) => s.id));

function parseScope(raw: any): CouponScope | undefined {
  if (!raw || raw.kind === 'all') return undefined;
  if (raw.kind === 'privateLabel' || raw.kind === 'otherBrands') return { kind: raw.kind };
  if (raw.kind === 'segments' && Array.isArray(raw.segments)) {
    const segments = raw.segments.filter((s: string) => SEGMENT_IDS.has(s as Segment)) as Segment[];
    return segments.length ? { kind: 'segments', segments } : undefined;
  }
  return undefined;
}

/** Legge il file in modo tollerante: le voci non valide vengono scartate, mai un errore all'utente. */
export function parseOffersFile(json: unknown): PartnerOffer[] {
  const list = (json as any)?.offers;
  if (!Array.isArray(list)) return [];
  const out: PartnerOffer[] = [];
  for (const o of list) {
    if (!o || typeof o.id !== 'string' || typeof o.title !== 'string') continue;
    const kind = o.kind === 'percent' ? 'percent' : 'amount';
    const value = Number(o.value);
    const minSpend = Number(o.minSpend ?? 0);
    if (!Number.isFinite(value) || value < 0 || !Number.isFinite(minSpend) || minSpend < 0) continue;
    if (kind === 'percent' && value > 100) continue;
    out.push({
      id: o.id.slice(0, 60),
      chain: typeof o.chain === 'string' && o.chain.trim() ? o.chain.trim() : undefined,
      title: o.title.slice(0, 80),
      description: typeof o.description === 'string' ? o.description.slice(0, 200) : undefined,
      kind,
      value: Math.round(value),
      minSpend: Math.round(minSpend),
      scope: parseScope(o.scope),
      code: typeof o.code === 'string' && o.code.trim() ? o.code.trim().slice(0, 40) : undefined,
      startsOn: typeof o.startsOn === 'string' && ISO.test(o.startsOn) ? o.startsOn : undefined,
      expiresOn: typeof o.expiresOn === 'string' && ISO.test(o.expiresOn) ? o.expiresOn : undefined,
      foundersOnly: o.foundersOnly === true,
    });
  }
  return out;
}

/** offerte visibili oggi (non scadute) per questo utente */
export function visibleOffers(offers: PartnerOffer[], isFounder: boolean, today = new Date()): PartnerOffer[] {
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return offers.filter((o) => (!o.expiresOn || o.expiresOn >= t) && (!o.foundersOnly || isFounder));
}

export function offerToCoupon(o: PartnerOffer): Omit<Coupon, 'id'> {
  return {
    name: o.title,
    code: o.code,
    minSpend: o.minSpend,
    kind: o.kind,
    value: o.value,
    active: true,
    startsOn: o.startsOn,
    expiresOn: o.expiresOn,
    chain: o.chain,
    scope: o.scope,
    source: 'partner',
    offerId: o.id,
  };
}

export function isFounderEligible(now = new Date()): boolean {
  const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return t <= FOUNDER_UNTIL;
}

/** scarica il file delle offerte (max 8 secondi); in caso di problemi restituisce null */
export async function fetchOffers(): Promise<PartnerOffer[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${OFFERS_URL}?t=${Date.now()}`, { signal: ctrl.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    return parseOffersFile(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
