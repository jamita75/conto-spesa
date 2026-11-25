import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { CartItem } from '../features/cart/types';
import type { Coupon } from '../features/coupons/types';

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
  items: CartItem[];
  coupons: Coupon[];
  settings: Settings;
};

const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'conto-spesa/state';

const initialState: AppState = {
  schema: SCHEMA_VERSION,
  items: [],
  coupons: [],
  settings: { stackCoupons: false, autoScan: true },
};

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'item/add'; item: Omit<CartItem, 'id' | 'createdAt'>; id?: string }
  | { type: 'item/update'; id: string; patch: Partial<Omit<CartItem, 'id'>> }
  | { type: 'item/remove'; id: string }
  | { type: 'cart/clear' }
  | { type: 'coupon/add'; coupon: Omit<Coupon, 'id'> }
  | { type: 'coupon/update'; id: string; patch: Partial<Omit<Coupon, 'id'>> }
  | { type: 'coupon/remove'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> };

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
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
    case 'coupon/add':
      return { ...state, coupons: [...state.coupons, { ...action.coupon, id: newId() }] };
    case 'coupon/update':
      return {
        ...state,
        coupons: state.coupons.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case 'coupon/remove':
      return { ...state, coupons: state.coupons.filter((c) => c.id !== action.id) };
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    default:
      return state;
  }
}

function migrate(saved: any): AppState {
  if (!saved || typeof saved !== 'object') return initialState;
  // schema 1: nessuna migrazione necessaria. Aggiungere qui i passaggi futuri.
  return {
    ...initialState,
    ...saved,
    settings: { ...initialState.settings, ...(saved.settings ?? {}) },
    schema: SCHEMA_VERSION,
  };
}

type Ctx = { state: AppState; dispatch: React.Dispatch<Action>; ready: boolean };
const StoreContext = createContext<Ctx | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = React.useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) dispatch({ type: 'hydrate', state: migrate(JSON.parse(raw)) });
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const value = useMemo(() => ({ state, dispatch, ready }), [state, ready]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore deve stare dentro AppStoreProvider');
  return ctx;
}
