/**
 * Configurazione a distanza: un file JSON pubblico (config/app.json nel repo GitHub)
 * letto all'apertura dell'app. Permette, senza pubblicare una nuova versione:
 *  - di OBBLIGARE l'aggiornamento (minVersionCode) o di suggerirlo (latestVersionCode);
 *  - di accendere/spegnere gli spazi sponsorizzati e di cambiarne il contenuto.
 * Se il file non si legge (offline, errore) l'app funziona normalmente.
 */

export const CONFIG_URL = 'https://raw.githubusercontent.com/jamita75/conto-spesa/main/config/app.json';
export const DEFAULT_UPDATE_URL = 'https://github.com/jamita75/conto-spesa/releases/latest';

export type Sponsored = {
  id: string;
  /** chi paga lo spazio: sempre mostrato («Sponsorizzato da …») */
  advertiser: string;
  title: string;
  text?: string;
  /** link da aprire (sito, pagina offerta, WhatsApp del negozio) */
  url?: string;
  /** testo del pulsante, es. «Vedi l'offerta» */
  cta?: string;
  /** solo per chi fa la spesa in questa insegna (vuoto = tutti) */
  chain?: string;
  startsOn?: string;
  endsOn?: string;
};

export type RemoteConfig = {
  minVersionCode: number;
  latestVersionCode: number;
  updateUrl: string;
  updateMessage?: string;
  adsEnabled: boolean;
  sponsored: Sponsored[];
};

export const EMPTY_CONFIG: RemoteConfig = {
  minVersionCode: 0,
  latestVersionCode: 0,
  updateUrl: DEFAULT_UPDATE_URL,
  adsEnabled: false,
  sponsored: [],
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const url = (v: unknown) => {
  const s = str(v, 500);
  return s && /^https:\/\//i.test(s) ? s : undefined;
};

/** legge il file in modo prudente: tutto ciò che non è valido viene ignorato */
export function parseRemoteConfig(raw: unknown): RemoteConfig {
  if (!raw || typeof raw !== 'object') return EMPTY_CONFIG;
  const r = raw as Record<string, unknown>;
  const ads = (r.ads && typeof r.ads === 'object' ? r.ads : {}) as Record<string, unknown>;
  const list = Array.isArray(ads.items) ? ads.items : [];
  const sponsored: Sponsored[] = [];
  for (const it of list.slice(0, 20)) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const id = str(o.id, 60);
    const advertiser = str(o.advertiser, 60);
    const title = str(o.title, 80);
    if (!id || !advertiser || !title) continue;
    sponsored.push({
      id,
      advertiser,
      title,
      text: str(o.text, 160),
      url: url(o.url),
      cta: str(o.cta, 30),
      chain: str(o.chain, 40),
      startsOn: typeof o.startsOn === 'string' && ISO.test(o.startsOn) ? o.startsOn : undefined,
      endsOn: typeof o.endsOn === 'string' && ISO.test(o.endsOn) ? o.endsOn : undefined,
    });
  }
  return {
    minVersionCode: int(r.minVersionCode),
    latestVersionCode: int(r.latestVersionCode),
    updateUrl: url(r.updateUrl) ?? DEFAULT_UPDATE_URL,
    updateMessage: str(r.updateMessage, 300),
    adsEnabled: ads.enabled === true,
    sponsored,
  };
}

export type UpdateNeed = 'force' | 'suggest' | null;

/** versionCode installato confrontato con quelli del file */
export function updateNeed(current: number | null | undefined, cfg: RemoteConfig): UpdateNeed {
  if (!current) return null; // versione sconosciuta (es. Expo Go): mai bloccare
  if (cfg.minVersionCode > current) return 'force';
  if (cfg.latestVersionCode > current) return 'suggest';
  return null;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** spazi sponsorizzati da mostrare oggi in questo negozio (al massimo uno: niente pubblicità invadente) */
export function pickSponsored(cfg: RemoteConfig, chain: string | undefined, today = new Date()): Sponsored | null {
  if (!cfg.adsEnabled) return null;
  const day = iso(today);
  const ok = cfg.sponsored.filter(
    (s) =>
      (!s.startsOn || s.startsOn <= day) &&
      (!s.endsOn || s.endsOn >= day) &&
      (!s.chain || (chain && s.chain.toLowerCase() === chain.toLowerCase())),
  );
  if (!ok.length) return null;
  // prima quelli della propria insegna, poi a rotazione giornaliera
  const mine = ok.filter((s) => s.chain);
  const pool = mine.length ? mine : ok;
  const n = Math.floor(today.getTime() / 86400000);
  return pool[n % pool.length];
}

export async function fetchRemoteConfig(): Promise<RemoteConfig | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { signal: ctrl.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    return parseRemoteConfig(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
