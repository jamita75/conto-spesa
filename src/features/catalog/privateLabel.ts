/**
 * Riconoscimento dei prodotti a MARCHIO DEL DISTRIBUTORE (private label) dal nome letto.
 * Elenco iniziale da verificare e ampliare: basta aggiungere nomi qui sotto.
 * Se il nome non è riconosciuto, l'utente può sempre segnare a mano «Marca del negozio».
 */
export const PRIVATE_LABEL_BRANDS: Record<string, string[]> = {
  Conad: ['conad', 'sapori & dintorni', 'sapori e dintorni', 'verso natura', 'percorso qualità'],
  Coop: ['coop', 'fior fiore', 'vivi verde', 'bene.sì', 'bene si', 'crescendo'],
  Esselunga: ['esselunga', 'naturama', 'equilibrio esselunga'],
  Carrefour: ['carrefour', "terre d'italia"],
  Despar: ['despar', 'premium despar', 'vital despar'],
  Lidl: ['lidl', 'milbona', 'italiamo', 'deluxe lidl'],
  Eurospin: ['eurospin', 'tre mulini'],
  Pam: ['pam ', 'panorama'],
  Penny: ['penny'],
  Crai: ['crai'],
  Sigma: ['sigma'],
  Famila: ['famila'],
};

/** true se il nome contiene un marchio del distributore (del negozio scelto, o di qualsiasi insegna nota). */
export function guessPrivateLabel(name?: string, chain?: string): boolean | undefined {
  if (!name) return undefined;
  const n = ` ${name.toLowerCase()} `;
  const lists = chain && PRIVATE_LABEL_BRANDS[chain] ? [PRIVATE_LABEL_BRANDS[chain]] : Object.values(PRIVATE_LABEL_BRANDS);
  return lists.some((brands) => brands.some((b) => n.includes(b))) ? true : undefined;
}
