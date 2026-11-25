/**
 * Codici a barre generati sul telefono, senza internet.
 * - EAN-13: se il codice è di 13 cifre valide (o 12 cifre: si calcola la cifra di controllo)
 * - Code 128: per tutto il resto (lettere e numeri), il formato più letto dalle casse
 * Il risultato è una stringa di moduli: "1" = barra nera, "0" = spazio.
 */
export type Barcode = { format: 'EAN13' | 'CODE128'; modules: string; text: string };

// --- Code 128 ---
const C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;

function widthsToModules(widths: string): string {
  let out = '';
  for (let i = 0; i < widths.length; i++) out += (i % 2 === 0 ? '1' : '0').repeat(Number(widths[i]));
  return out;
}

/** Code 128 con passaggio automatico al set C per le sequenze di cifre (più compatto). */
export function encodeCode128(text: string): string {
  if (!text || /[^\x20-\x7E]/.test(text)) throw new Error('Caratteri non supportati');
  const values: number[] = [];
  let i = 0;
  const digitRun = (from: number) => {
    let n = 0;
    while (from + n < text.length && /\d/.test(text[from + n])) n++;
    return n;
  };
  let set: 'B' | 'C' = digitRun(0) >= 4 && digitRun(0) % 2 === 0 ? 'C' : 'B';
  if (set === 'C' && digitRun(0) === text.length) set = 'C';
  values.push(set === 'C' ? START_C : START_B);

  while (i < text.length) {
    const run = digitRun(i);
    if (set === 'B' && run >= 6) {
      // passa a C solo per un numero pari di cifre
      if (run % 2 === 1) {
        values.push(text.charCodeAt(i) - 32);
        i++;
      }
      values.push(CODE_C);
      set = 'C';
      continue;
    }
    if (set === 'C') {
      if (run >= 2) {
        values.push(Number(text.slice(i, i + 2)));
        i += 2;
        continue;
      }
      values.push(CODE_B);
      set = 'B';
      continue;
    }
    values.push(text.charCodeAt(i) - 32);
    i++;
  }

  let sum = values[0];
  for (let k = 1; k < values.length; k++) sum += values[k] * k;
  values.push(sum % 103, STOP);
  return values.map((v) => widthsToModules(C128[v])).join('');
}

// --- EAN-13 ---
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((p) => [...p].map((b) => (b === '1' ? '0' : '1')).join(''));
const G = R.map((p) => [...p].reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function ean13CheckDigit(first12: string): number {
  const sum = [...first12].reduce((s, d, idx) => s + Number(d) * (idx % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function encodeEan13(code: string): string {
  const parity = PARITY[Number(code[0])];
  let out = '101';
  for (let k = 1; k <= 6; k++) out += (parity[k - 1] === 'L' ? L : G)[Number(code[k])];
  out += '01010';
  for (let k = 7; k <= 12; k++) out += R[Number(code[k])];
  return out + '101';
}

/** Sceglie il formato migliore per il codice del buono. */
export function makeBarcode(raw: string): Barcode | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^\d{12}$/.test(text)) {
    const full = text + ean13CheckDigit(text);
    return { format: 'EAN13', modules: encodeEan13(full), text: full };
  }
  if (/^\d{13}$/.test(text) && ean13CheckDigit(text.slice(0, 12)) === Number(text[12])) {
    return { format: 'EAN13', modules: encodeEan13(text), text };
  }
  try {
    return { format: 'CODE128', modules: encodeCode128(text), text };
  } catch {
    return null;
  }
}
