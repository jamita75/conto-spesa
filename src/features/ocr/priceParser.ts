import type { Cents } from '../../lib/money';

/**
 * Estrae i prezzi candidati dal testo letto su un'etichetta.
 * L'etichetta contiene spesso più numeri (prezzo, prezzo al kg, prezzo barrato,
 * date, codici): li raccogliamo tutti, assegniamo un punteggio e l'utente
 * conferma con un tocco quello giusto.
 */
export type PriceCandidate = {
  cents: Cents;
  score: number;
  /** true se sembra un prezzo al kg / al litro: mostrato ma non preselezionato */
  isUnitPrice: boolean;
  source: string;
};

const UNIT_HINT = /(\/\s*(kg|lt?|l\b|g\b|hg|pz|mt?)|al\s*(kg|lt|litro|l\b|pz|hg)|€\s*\/|prezzo\s+(al|per)|per\s*(kg|lt|litro)|eur\s*\/\s*kg)/i;
const DATE_LIKE = /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g;
const PERCENT = /\d+[.,]?\d*\s*%/g;
const PRICE_RX = /(€\s*)?(\d{1,4})\s?[.,]\s?(\d{2})(?!\d)(\s*€)?/g;
/** Etichette con euro grandi e centesimi piccoli: "1 99" oppure "1⁹⁹" letto come "1 99" */
const SPLIT_PRICE_RX = /^\s*(€\s*)?(\d{1,3})\s+(\d{2})\s*(€\s*[x×]?)?\s*(\/\s*(kg|l|lt|hg|pz)\.?)?\s*$/i;
/** cartellino elettronico senza spazio tra euro e centesimi: "279", "279 €", "1163 €/Kg" */
const COMPACT_RX = /^\s*(€\s*)?(\d{3,4})\s*(€\s*[x×]?)?\s*(\/\s*(kg|l|lt|hg|pz)\.?)?\s*$/i;
const POSITIVE_HINT = /(prezzo|offerta|ora|solo|sconto|promo|euro|€)/i;
const OLD_PRICE_HINT = /(prima|invece di|anziché|anziche|era|prezzo pieno)/i;
/** etichette del fresco pesato: importo finale da pagare */
const PAY_HINT = /(da\s*pagare|importo|totale|prezzo\s*€|prezzo\s*eur\b|euro\s*$)/i;
/** righe con un peso, non un prezzo (es. "Peso netto kg 0,53", "TARA 0,01", "0,25 kg") */
const WEIGHT_HINT = /(peso|netto|tara|\bkg\s*\d|\d\s*kg\b|\d\s*gr?\b)/i;

const MAX_CENTS = 999_99; // oltre 999,99 € su un'etichetta è quasi certamente un codice

/* ---------- cartellini elettronici (LCD a segmenti, es. Hanshow in Conad) ----------
 * Euro grandi e centesimi piccoli in alto, senza virgola: l'OCR li restituisce come
 * "279", "2 79" o su due righe ("2" e "79"); il prezzo al kg come "11 63" con "€/Kg"
 * a volte sulla riga dopo. Le cifre a segmenti vengono talvolta lette come lettere.
 */

/** righe fatte solo di cifre/simboli: lettere scambiate per cifre (O→0, I/l→1, S→5, Z→2, B→8) */
function fixSegmentDigits(line: string): string {
  if (!/^[\dOoIl|SZB\s€.,xX/Kkg]+$/.test(line)) return line;
  if ((line.match(/\d/g) ?? []).length < 2) return line;
  return line.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/Z/g, '2').replace(/B/g, '8');
}

const NUM_ONLY = /^\s*€?\s*\d{1,3}\s*€?\s*$/;
const CENTS_ONLY = /^\s*\d{2}\s*(€\s*[x×]?)?\s*(\/\s*(kg|l|lt|hg|pz)\.?)?\s*$/i;
const UNIT_ONLY = /^\s*€?\s*\/\s*(kg|l|lt|hg|pz)\.?\s*$/i;

/** unisce le righe spezzate dall'OCR: "2" + "79" → "2 79"; "11 63" + "€/Kg" → "11 63 €/Kg" */
function mergeLines(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (NUM_ONLY.test(line) && i + 1 < lines.length && CENTS_ONLY.test(lines[i + 1])) {
      line = `${line} ${lines[++i]}`;
    }
    if (i + 1 < lines.length && UNIT_ONLY.test(lines[i + 1]) && /\d\s*€?\s*$/.test(line)) {
      line = `${line} ${lines[++i]}`;
    }
    out.push(line);
  }
  return out;
}

/** quantità della confezione in kg o litri, lette dal nome sul cartellino */
export function extractQuantities(lines: string[]): number[] {
  const text = lines.join(' ').replace(/,/g, '.');
  const toBase = (v: number, u: string) => {
    const k = u.toLowerCase();
    if (k === 'g' || k === 'gr' || k === 'ml') return v / 1000;
    if (k === 'cl') return v / 100;
    if (k === 'hg') return v / 10;
    return v; // kg, l, lt
  };
  const found = new Set<number>();
  const push = (v: number, u: string, n = 1) => {
    const q = Math.round(toBase(v, u) * n * 10000) / 10000;
    if (q >= 0.005 && q <= 50) found.add(q);
  };
  const U = '(kg|gr|g|hg|ml|cl|lt|l)';
  // "6x33cl", "6 x 0.33 l"
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*${U}\\b`, 'gi')))
    push(parseFloat(m[2]), m[3], parseInt(m[1], 10));
  // "G240", "CL33X6", "KG1", "LT1.5" (unità prima del numero, tipico dei cartellini)
  for (const m of text.matchAll(new RegExp(`(?<![/\\w])${U}\\.?(\\d+(?:\\.\\d+)?)(?:[x×](\\d{1,2}))?(?![\\d.])`, 'gi')))
    push(parseFloat(m[2]), m[1], m[3] ? parseInt(m[3], 10) : 1);
  // "240 g", "1.5 L", "33cl x6"
  for (const m of text.matchAll(new RegExp(`(?<![\\d.])(\\d+(?:\\.\\d+)?)\\s*${U}\\b(?:\\s*[x×]\\s*(\\d{1,2})\\b)?`, 'gi')))
    push(parseFloat(m[1]), m[2], m[3] ? parseInt(m[3], 10) : 1);
  return [...found];
}

export function extractPriceCandidates(rawLines: string[]): PriceCandidate[] {
  const lines = mergeLines(rawLines.map((l) => fixSegmentDigits(l.replace(/\s+/g, ' ').trim())).filter(Boolean));
  const found = new Map<Cents, PriceCandidate>();

  const add = (cents: Cents, score: number, isUnitPrice: boolean, source: string) => {
    if (cents <= 0 || cents > MAX_CENTS) return;
    const prev = found.get(cents);
    if (prev) {
      // lo stesso importo letto più volte è più affidabile
      prev.score = Math.max(prev.score, score) + 1;
      prev.isUnitPrice = prev.isUnitPrice && isUnitPrice;
    } else {
      found.set(cents, { cents, score, isUnitPrice, source });
    }
  };

  let prevLine = '';
  for (const line of lines) {
    const prev = prevLine;
    prevLine = line;

    const cleaned = line.replace(DATE_LIKE, ' ').replace(PERCENT, ' ');
    // un numero da solo eredita il significato della riga sopra ("€/kg" → "12,90")
    const onlyNumber = /^[€\s]*\d{1,4}\s?[.,]\s?\d{2}[€\s]*$/.test(cleaned);
    const ctx = onlyNumber ? `${prev} ${line}` : line;
    if (WEIGHT_HINT.test(ctx) && !/€/.test(line) && !UNIT_HINT.test(ctx)) continue;
    const isUnit = UNIT_HINT.test(ctx);
    const isOld = OLD_PRICE_HINT.test(ctx);
    const isPay = PAY_HINT.test(ctx);

    let matchedSomething = false;
    for (const m of cleaned.matchAll(PRICE_RX)) {
      matchedSomething = true;
      const cents = parseInt(m[2], 10) * 100 + parseInt(m[3], 10);
      let score = 1;
      if (m[1] || m[4]) score += 3; // simbolo € vicino
      if (cleaned.trim().length <= m[0].trim().length + 2) score += 2; // riga che contiene solo il prezzo
      if (POSITIVE_HINT.test(ctx)) score += 1;
      if (isPay && !isUnit) score += 4;
      if (isUnit) score -= 4;
      if (isOld) score -= 2;
      add(cents, score, isUnit, line);
    }

    if (!matchedSomething) {
      const split = cleaned.match(SPLIT_PRICE_RX);
      if (split) {
        const cents = parseInt(split[2], 10) * 100 + parseInt(split[3], 10);
        add(cents, split[1] || split[4] ? 3 : 1, isUnit, line);
        continue;
      }
      // cartellino elettronico letto senza spazio: "279", "2 79 €x" già gestito sopra, "1163 €/Kg"
      // più prezzi «a segmenti» sulla stessa riga: "11 63 2 79"
      if (/^[\d\s€x×/.]+(kg|l|lt)?[\d\s€x×/.]*$/i.test(cleaned)) {
        const pairs = [...cleaned.matchAll(/(?<!\d)(\d{1,3}) (\d{2})(?!\d)/g)];
        if (pairs.length > 1) {
          for (const m of pairs) add(parseInt(m[1], 10) * 100 + parseInt(m[2], 10), 1, false, line);
          continue;
        }
      }
      const compact = cleaned.match(COMPACT_RX);
      if (compact) {
        const n = parseInt(compact[2], 10);
        if (!(compact[2].length === 4 && n >= 1900 && n <= 2099 && !compact[1] && !compact[3])) {
          add(n, compact[1] || compact[3] ? 2 : 0, isUnit, line);
        }
      }
    }
  }

  // prezzo × quantità: se un prezzo al kg/l per la grammatura dà un altro prezzo, quello è il prezzo giusto
  const qs = extractQuantities(lines);
  const all = [...found.values()];
  let confirmed = false;
  for (const p of all) {
    for (const u of all) {
      if (u === p) continue;
      for (const q of qs) {
        if (q === 1) continue;
        const expected = u.cents * q;
        if (Math.abs(expected - p.cents) <= Math.max(2, p.cents * 0.01)) {
          if (!confirmed || !p.isUnitPrice) {
            p.score += 6;
            p.isUnitPrice = false;
            u.isUnitPrice = true;
            confirmed = true;
          }
        }
      }
    }
  }
  // c'è il prezzo al kg/l e la grammatura ma il prezzo grande non si legge: lo calcoliamo
  if (!confirmed && qs.length === 1 && qs[0] !== 1) {
    const units = all.filter((c) => c.isUnitPrice);
    if (units.length === 1 && !all.some((c) => !c.isUnitPrice && c.score >= 4)) {
      add(Math.round(units[0].cents * qs[0]), 3, false, 'calcolato: prezzo al kg/l × confezione');
    }
  }

  return [...found.values()]
    .sort((a, b) => (Number(a.isUnitPrice) - Number(b.isUnitPrice)) || b.score - a.score)
    .slice(0, 6);
}

/**
 * Modalità automatica: restituisce il prezzo SOLO se la lettura non è ambigua,
 * cioè il primo candidato non è un prezzo al kg/l, ha un punteggio buono
 * e stacca nettamente il secondo. Altrimenti null → si chiede conferma.
 */
export function pickConfidentPrice(candidates: PriceCandidate[]): PriceCandidate | null {
  const real = candidates.filter((c) => !c.isUnitPrice);
  const [first, second] = real;
  if (!first || first.score < 4) return null;
  if (second && first.score - second.score < 3) return null;
  return first;
}
