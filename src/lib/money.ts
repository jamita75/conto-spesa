/**
 * Tutti gli importi sono gestiti in CENTESIMI (interi) per evitare
 * errori di arrotondamento dei numeri decimali (0,1 + 0,2 ≠ 0,3).
 */
export type Cents = number;

const formatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

export function formatEuro(cents: Cents): string {
  return formatter.format(cents / 100);
}

/** Converte testo digitato dall'utente ("12,5" / "12.50" / "€ 3") in centesimi. */
export function parseEuroInput(text: string): Cents | null {
  const clean = text.replace(/[€\s]/g, '').replace(',', '.');
  if (!/^\d{0,5}(\.\d{0,2})?$/.test(clean) || clean === '' || clean === '.') return null;
  const value = Math.round(parseFloat(clean) * 100);
  return Number.isFinite(value) ? value : null;
}

/** Centesimi -> testo per campo di input ("12,50"). */
export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
