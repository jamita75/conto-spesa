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
const SPLIT_PRICE_RX = /^\s*(€\s*)?(\d{1,3})\s+(\d{2})\s*(€)?\s*$/;
const POSITIVE_HINT = /(prezzo|offerta|ora|solo|sconto|promo|euro|€)/i;
const OLD_PRICE_HINT = /(prima|invece di|anziché|anziche|era|prezzo pieno)/i;

const MAX_CENTS = 999_99; // oltre 999,99 € su un'etichetta è quasi certamente un codice

export function extractPriceCandidates(lines: string[]): PriceCandidate[] {
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

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    const cleaned = line.replace(DATE_LIKE, ' ').replace(PERCENT, ' ');
    const isUnit = UNIT_HINT.test(line);
    const isOld = OLD_PRICE_HINT.test(line);

    let matchedSomething = false;
    for (const m of cleaned.matchAll(PRICE_RX)) {
      matchedSomething = true;
      const cents = parseInt(m[2], 10) * 100 + parseInt(m[3], 10);
      let score = 1;
      if (m[1] || m[4]) score += 3; // simbolo € vicino
      if (cleaned.trim().length <= m[0].trim().length + 2) score += 2; // riga che contiene solo il prezzo
      if (POSITIVE_HINT.test(line)) score += 1;
      if (isUnit) score -= 4;
      if (isOld) score -= 2;
      add(cents, score, isUnit, line);
    }

    if (!matchedSomething) {
      const split = cleaned.match(SPLIT_PRICE_RX);
      if (split) {
        const cents = parseInt(split[2], 10) * 100 + parseInt(split[3], 10);
        add(cents, split[1] || split[4] ? 3 : 1, isUnit, line);
      }
    }
  }

  return [...found.values()]
    .sort((a, b) => (Number(a.isUnitPrice) - Number(b.isUnitPrice)) || b.score - a.score)
    .slice(0, 6);
}
