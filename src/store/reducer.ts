import { buildAnonymousRecord, QUEUE_LIMIT, type AnonymousPurchase } from '../features/analytics/collector';
import { cartSubtotal, type CartItem } from '../features/cart/types';
import { NO_CONSENT, PRIVACY_POLICY_VERSION, type Consent } from '../features/consent/types';
import { computeCouponProgress, couponsForStore } from '../features/coupons/couponLogic';
import type { Coupon } from '../features/coupons/types';
import type { ShoppingSession } from '../features/history/types';
import { isFounderEligible, offerToCoupon, type PartnerOffer } from '../features/offers/feed';
import { CHAINS, type Store } from '../features/store/types';

/**
 * Stato unico dell'app. Per aggiungere una funzione futura:
 * 1. aggiungi il campo in AppState + valore in initialState
 * 2. aggiungi le azioni in Action e il caso nel reducer
 * 3. se cambia la forma dei dati salvati, alza SCHEMA_VERSION e gestisci migrate()
 */
export type Settings = {
  /** se true i coupon sbloccati si sommano, altrimenti si applica il migliore */
  stackCoupons: boolean;
  /** modalità automatica: legge di continuo e aggiunge da solo i prezzi sicuri */
  autoScan: boolean;
};

export type AppState = {
  schema: number;
  onboarded: boolean;
  /** negozio della spesa in corso */
  store?: Store;
  items: CartItem[];
  coupons: Coupon[];
  history: ShoppingSession[];
  settings: Settings;
  consent: Consent;
  /** record anonimi in attesa di invio (solo con consenso) */
  analyticsQueue: AnonymousPurchase[];
  /** «Socio fondatore»: data in cui ha accettato la condivisione entro la scadenza della promozione */
  founderSince?: number;
  /** offerte dei negozi partner lette dal file online (copia locale) */
  offers: PartnerOffer[];
  offersFetchedAt?: number;
  /** codice casuale (pseudonimo) del telefono, esiste solo finché c'è almeno un consenso */
  pid?: string;
  /** richieste al server ancora da inviare (cancellazione / revoca partner) */
  pendingOps: ServerOp[];
};

export type ServerOp = { type: 'forget' | 'partnersOff'; pid: string };

export const SCHEMA_VERSION = 4;
export const STORAGE_KEY = 'conto-spesa/state';
const HISTORY_LIMIT = 500;

export const initialState: AppState = {
  schema: SCHEMA_VERSION,
  onboarded: false,
  items: [],
  coupons: [],
  history: [],
  settings: { stackCoupons: false, autoScan: true },
  consent: NO_CONSENT,
  analyticsQueue: [],
  offers: [],
  pendingOps: [],
};

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'onboarding/done' }
  | { type: 'store/set'; store?: Store }
  | { type: 'item/add'; item: Omit<CartItem, 'id' | 'createdAt'>; id?: string }
  | { type: 'item/update'; id: string; patch: Partial<Omit<CartItem, 'id'>> }
  | { type: 'item/remove'; id: string }
  | { type: 'cart/clear' }
  | { type: 'session/finish'; id: string }
  | { type: 'history/remove'; id: string }
  | { type: 'coupon/add'; coupon: Omit<Coupon, 'id'> }
  | { type: 'coupon/update'; id: string; patch: Partial<Omit<Coupon, 'id'>> }
  | { type: 'coupon/remove'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }
  /** newPid: codice casuale generato dall'interfaccia, usato solo se serve crearne uno */
  | { type: 'consent/set'; patch: Partial<Pick<Consent, 'stats' | 'partners'>>; newPid?: string }
  | { type: 'data/wipe' }
  | { type: 'offers/set'; offers: PartnerOffer[] }
  | { type: 'offer/claim'; offer: PartnerOffer }
  | { type: 'analytics/sent'; rids: string[] }
  | { type: 'ops/done'; op: ServerOp };

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'onboarding/done':
      return { ...state, onboarded: true };
    case 'store/set':
      return { ...state, store: action.store };
    case 'item/add':
      return {
        ...state,
        items: [{ ...action.item, id: action.id ?? newId(), createdAt: Date.now() }, ...state.items],
      };
    case 'item/update':
      return {
        ...state,
        items: state.items
          .map((i) => (i.id === action.id ? { ...i, ...action.patch } : i))
          .filter((i) => i.qty > 0),
      };
    case 'item/remove':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case 'cart/clear':
      return { ...state, items: [] };
    case 'session/finish': {
      if (!state.items.length) return state;
      const subtotal = cartSubtotal(state.items);
      const progress = computeCouponProgress(
        couponsForStore(state.coupons, state.store),
        state.items,
        state.settings.stackCoupons,
      );
      const session: ShoppingSession = {
        id: action.id,
        date: Date.now(),
        store: state.store,
        items: state.items,
        subtotal,
        discount: progress.discount,
        toPay: progress.toPay,
        couponsUsed: progress.applied.map((c) => c.name),
      };
      const record = buildAnonymousRecord(session, state.consent, [...CHAINS.food, ...CHAINS.nonfood]);
      return {
        ...state,
        items: [],
        history: [session, ...state.history].slice(0, HISTORY_LIMIT),
        analyticsQueue: record ? [...state.analyticsQueue, record].slice(-QUEUE_LIMIT) : state.analyticsQueue,
      };
    }
    case 'history/remove':
      return { ...state, history: state.history.filter((h) => h.id !== action.id) };
    case 'coupon/add':
      return { ...state, coupons: [...state.coupons, { source: 'user', ...action.coupon, id: newId() }] };
    case 'coupon/update':
      return {
        ...state,
        coupons: state.coupons.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case 'coupon/remove':
      return { ...state, coupons: state.coupons.filter((c) => c.id !== action.id) };
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'consent/set': {
      const consent: Consent = {
        ...state.consent,
        ...action.patch,
        policyVersion: PRIVACY_POLICY_VERSION,
        updatedAt: Date.now(),
      };
      // revoca: i dati in coda non ancora inviati vengono cancellati subito
      const revoked = !consent.stats && !consent.partners;
      // primo consenso ai partner entro la data della promozione → Socio fondatore (resta per sempre)
      const founderSince =
        state.founderSince ?? (consent.partners && isFounderEligible() ? Date.now() : undefined);
      // codice pseudonimo: nasce col primo consenso, alla revoca totale si chiede al server di cancellare tutto
      let pid = state.pid;
      let pendingOps = state.pendingOps;
      if (revoked && pid) {
        pendingOps = [...pendingOps.filter((o) => o.pid !== pid), { type: 'forget', pid }];
        pid = undefined;
      } else if (!revoked && !pid && action.newPid) {
        pid = action.newPid;
      } else if (!revoked && pid && state.consent.partners && !consent.partners) {
        pendingOps = [...pendingOps, { type: 'partnersOff', pid }];
      }
      return {
        ...state,
        consent,
        founderSince,
        pid,
        pendingOps,
        analyticsQueue: revoked
          ? []
          : state.analyticsQueue.map((r) => ({ ...r, shareWithPartners: r.shareWithPartners && consent.partners })),
      };
    }
    case 'data/wipe':
      // anche i dati sul server: la richiesta di cancellazione sopravvive alla pulizia
      return {
        ...initialState,
        onboarded: true,
        pendingOps: state.pid ? [...state.pendingOps, { type: 'forget', pid: state.pid }] : state.pendingOps,
      };
    case 'analytics/sent': {
      const sent = new Set(action.rids);
      return { ...state, analyticsQueue: state.analyticsQueue.filter((r) => !sent.has(r.rid)) };
    }
    case 'ops/done':
      return {
        ...state,
        pendingOps: state.pendingOps.filter((o) => !(o.type === action.op.type && o.pid === action.op.pid)),
      };
    case 'offers/set':
      return { ...state, offers: action.offers, offersFetchedAt: Date.now() };
    case 'offer/claim':
      if (state.coupons.some((c) => c.offerId === action.offer.id)) return state;
      return { ...state, coupons: [...state.coupons, { ...offerToCoupon(action.offer), id: newId() }] };
    default:
      return state;
  }
}

export function migrate(saved: any): AppState {
  if (!saved || typeof saved !== 'object') return initialState;
  const from = Number(saved.schema ?? 1);
  let s = { ...saved };
  if (from < 4) {
    // i record in coda creati prima del codice pseudonimo non hanno l'id spesa: si scartano
    s = { ...s, pendingOps: s.pendingOps ?? [], analyticsQueue: [] };
    // il codice pseudonimo è un trattamento nuovo: chi aveva già acconsentito deve riconfermare
    // con la nuova informativa → consensi azzerati e schermata di benvenuto di nuovo
    if (s.consent?.stats || s.consent?.partners) s = { ...s, consent: NO_CONSENT, onboarded: false };
  }
  if (from < 3) {
    s = { ...s, offers: s.offers ?? [] };
  }
  if (from < 2) {
    // v1 → v2: arrivano negozio, storico, consensi. Chi aveva già la v1 ha già visto l'app.
    s = { ...s, onboarded: true, history: [], consent: NO_CONSENT, analyticsQueue: [] };
  }
  return {
    ...initialState,
    ...s,
    settings: { ...initialState.settings, ...(s.settings ?? {}) },
    consent: { ...NO_CONSENT, ...(s.consent ?? {}) },
    schema: SCHEMA_VERSION,
  };
}

