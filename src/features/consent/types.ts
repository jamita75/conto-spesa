/**
 * Consensi privacy (GDPR): due consensi SEPARATI, facoltativi, spenti di default,
 * revocabili in qualsiasi momento dalla scheda "Profilo".
 * Ogni modifica registra data e versione dell'informativa accettata.
 */
export const PRIVACY_POLICY_VERSION = '2026-11-25-v2-bozza';

export type Consent = {
  /** statistiche anonime e aggregate per migliorare l'app */
  stats: boolean;
  /** condivisione di statistiche anonime e aggregate con insegne/partner della distribuzione */
  partners: boolean;
  policyVersion?: string;
  updatedAt?: number;
};

export const NO_CONSENT: Consent = { stats: false, partners: false };
