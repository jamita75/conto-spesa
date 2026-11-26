/**
 * Prova a riconoscere il NOME del prodotto tra le righe lette sul cartellino.
 * Scarta prezzi, codici, date e parole tipiche dell'etichetta; preferisce righe
 * con molte lettere, in maiuscolo e in alto. Il risultato è solo un suggerimento:
 * l'utente può sempre correggerlo.
 */
const STOP_WORDS =
  /\b(prezzo|offerta|promo|sconto|risparmi|euro|eur|al\s*kg|al\s*lt|al\s*litro|kg|cod|codice|art|lotto|scad|scadenza|iva|valido|fino|dal|al\b|carta|tessera|fedelt|soci|cad|pz|confezione|conf\b|confezionato|consumarsi|entro|peso|netto|tara|ean|sottocosto|prendi|paghi|anzich|invece|prima|ora\b|solo|hanshow|vusion|ses|imagotag|pricer|imb)\b/i;
const PRICE_LIKE = /\d+\s?[.,]\s?\d{2}/;

export function extractProductName(lines: string[]): string | undefined {
  let best: { text: string; score: number } | undefined;

  lines.forEach((raw, index) => {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 3 || line.length > 60) return;
    // «100%» nel nome è normale (es. «100% farina di piselli»); «-30%» invece è uno sconto
    if (PRICE_LIKE.test(line) || /€/.test(line) || /-\s*\d+\s*%/.test(line)) return;
    if (STOP_WORDS.test(line)) return;

    const letters = (line.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
    const digits = (line.match(/\d/g) ?? []).length;
    if (letters < 3 || digits > letters / 2) return;

    const upper = (line.match(/[A-ZÀ-Ý]/g) ?? []).length;
    let score = Math.min(letters, 30);
    if (upper / letters > 0.7) score += 8; // i nomi sui cartellini sono spesso in maiuscolo
    score -= index; // il nome di solito è in alto (ma sui cartellini elettronici è sotto il prezzo)
    if (line.split(' ').length >= 2) score += 3;
    if (line.length >= 15) score += 4;

    if (!best || score > best.score) best = { text: line, score };
  });

  return best ? toNiceCase(best.text) : undefined;
}

/** "LATTE INTERO PARMALAT 1L" -> "Latte intero parmalat 1L" */
export function toNiceCase(text: string): string {
  const t = text.trim().slice(0, 40);
  const isUpper = t === t.toUpperCase();
  const lower = isUpper ? t.toLowerCase().replace(/(\d)\s?(l|g|kg|ml|cl)\b/g, (_, n, u) => `${n}${u === 'l' ? 'L' : u}`) : t;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
