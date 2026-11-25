import { buildAnonymousRecord, QUEUE_LIMIT, type AnonymousPurchase } from '../features/analytics/collector';
import { cartSubtotal, type CartItem } from '../features/cart/types';
import { NO_CONSENT, PRIVACY_POLICY_VERSION, type Consent } from '../features/consent/types';
import { computeCouponProgress, couponsForStore } from '../features/coupons/couponLogic';
import type { Coupon } from '../features/coupons/types';
import type { ShoppingSession } from '../features/history/types';
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
};

export const SCHEMA_VERSION = 2;
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
  | { type: 'consent/set'; patch: Partial<Pick<Consent, 'stats' | 'partners'>> }
  | { type: 'data/wipe' };

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
        subtotal,
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
      return {
        ...state,
        consent,
        analyticsQueue: revoked
          ? []
          : state.analyticsQueue.map((r) => ({ ...r, shareWithPartners: r.shareWithPartners && consent.partners })),
      };
    }
    case 'data/wipe':
      return { ...initialState, onboarded: true };
    default:
      return state;
  }
}

export function migrate(saved: any): AppState {
  if (!saved || typeof saved !== 'object') return initialState;
  const from = Number(saved.schema ?? 1);
  let s = { ...saved };
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

