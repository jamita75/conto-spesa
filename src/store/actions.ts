import * as Crypto from 'expo-crypto';
import type { Consent } from '../features/consent/types';
import type { Action } from './reducer';

/** cambia i consensi; prepara un codice casuale nel caso serva crearlo (primo consenso) */
export function consentAction(patch: Partial<Pick<Consent, 'stats' | 'partners'>>): Action {
  return { type: 'consent/set', patch, newPid: Crypto.randomUUID() };
}
