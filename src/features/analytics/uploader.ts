import type { AnonymousPurchase } from './collector';

/**
 * Collegamento al server di raccolta (plugin WordPress «Conto Spesa – Statistiche» su creaitivity.it,
 * sorgente in server/wordpress/). Finché il plugin non è attivo le chiamate falliscono e i dati
 * restano in coda sul telefono (max QUEUE_LIMIT spese): nessun aggiornamento dell'app necessario.
 */
export const API_BASE = 'https://www.creaitivity.it/wp-json/contospesa/v1';
/** deve coincidere con CS_APP_KEY nel plugin (filtro anti-spam, non è un segreto) */
export const APP_KEY = '2f596d4986ea489f344e7ee39541fae7';
const BATCH = 50;

async function post(path: string, body: unknown): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CS-Key': APP_KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** invia le spese in coda; restituisce gli id confermati dal server */
export async function sendRecords(pid: string, records: AnonymousPurchase[], appVersion?: string): Promise<string[]> {
  const confirmed: string[] = [];
  for (let i = 0; i < records.length; i += BATCH) {
    const res = await post('/records', { pid, appVersion, records: records.slice(i, i + BATCH) });
    if (!res?.ok || !Array.isArray(res.received)) break;
    confirmed.push(...res.received);
  }
  return confirmed;
}

/** diritto alla cancellazione: elimina dal server tutto ciò che è legato al codice */
export async function forgetOnServer(pid: string): Promise<boolean> {
  const res = await post('/forget', { pid });
  return res?.ok === true;
}

/** revoca del solo consenso ai partner */
export async function partnersOffOnServer(pid: string): Promise<boolean> {
  const res = await post('/partners-off', { pid });
  return res?.ok === true;
}

/** diritto di accesso: i dati legati al codice, così come li ha il server */
export async function exportFromServer(pid: string): Promise<unknown | null> {
  return post('/export', { pid });
}
