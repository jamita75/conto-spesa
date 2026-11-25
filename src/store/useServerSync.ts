import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { forgetOnServer, partnersOffOnServer, sendRecords } from '../features/analytics/uploader';
import { useStore } from './AppStore';

/**
 * Sincronizza col server, in silenzio e solo quando serve:
 * 1. prima le richieste di cancellazione / revoca (diritti dell'utente hanno la precedenza)
 * 2. poi le spese in coda, solo se c'è un consenso attivo e un codice.
 * Se il server non risponde si riprova alla prossima apertura o alla prossima spesa.
 */
export function useServerSync() {
  const { state, dispatch, ready } = useStore();
  const running = useRef(false);
  const { pendingOps, analyticsQueue, pid, consent } = state;
  const active = consent.stats || consent.partners;

  useEffect(() => {
    if (!ready || running.current) return;
    if (!pendingOps.length && !(active && pid && analyticsQueue.length)) return;
    running.current = true;
    (async () => {
      try {
        for (const op of pendingOps) {
          const ok = op.type === 'forget' ? await forgetOnServer(op.pid) : await partnersOffOnServer(op.pid);
          if (ok) dispatch({ type: 'ops/done', op });
          else return;
        }
        if (active && pid && analyticsQueue.length) {
          const rids = await sendRecords(pid, analyticsQueue, Constants.expoConfig?.version);
          if (rids.length) dispatch({ type: 'analytics/sent', rids });
        }
      } finally {
        running.current = false;
      }
    })();
  }, [ready, pendingOps, analyticsQueue, pid, active, dispatch]);
}
