/**
 * Reparti della spesa. Usati per: buoni validi solo su un reparto, controllo della spesa
 * nello storico, statistiche anonime per la distribuzione.
 * Il reparto viene proposto dal nome letto sul cartellino; l'utente lo può cambiare con un tocco.
 */
export type Segment =
  | 'fruttaVerdura'
  | 'carne'
  | 'pesce'
  | 'salumiFormaggi'
  | 'latteYogurt'
  | 'panePasticceria'
  | 'dispensa'
  | 'surgelati'
  | 'bevande'
  | 'dolciSnack'
  | 'casaIgiene'
  | 'animali'
  | 'altro';

export const SEGMENTS: { id: Segment; label: string; emoji: string }[] = [
  { id: 'fruttaVerdura', label: 'Frutta e verdura', emoji: '🥦' },
  { id: 'carne', label: 'Carne', emoji: '🥩' },
  { id: 'pesce', label: 'Pesce', emoji: '🐟' },
  { id: 'salumiFormaggi', label: 'Salumi e formaggi', emoji: '🧀' },
  { id: 'latteYogurt', label: 'Latte, yogurt, uova', emoji: '🥛' },
  { id: 'panePasticceria', label: 'Pane e forno', emoji: '🥖' },
  { id: 'dispensa', label: 'Pasta, riso, dispensa', emoji: '🍝' },
  { id: 'surgelati', label: 'Surgelati', emoji: '🧊' },
  { id: 'bevande', label: 'Bevande', emoji: '🧃' },
  { id: 'dolciSnack', label: 'Dolci e snack', emoji: '🍫' },
  { id: 'casaIgiene', label: 'Casa e igiene', emoji: '🧴' },
  { id: 'animali', label: 'Animali', emoji: '🐾' },
  { id: 'altro', label: 'Altro', emoji: '📦' },
];

export const segmentInfo = (id?: Segment) => SEGMENTS.find((s) => s.id === id) ?? SEGMENTS[SEGMENTS.length - 1];

/** Parole chiave per reparto (radici, in minuscolo). L'ordine conta: il primo reparto che corrisponde vince. */
const KEYWORDS: [Segment, string[]][] = [
  ['surgelati', ['surgel', 'congel', 'bastoncini', 'gelato', 'gelati', 'frozen']],
  ['animali', ['crocchette', 'gatto', 'gatti', 'cane', 'cani', 'pet ', 'lettiera', 'umido per']],
  ['casaIgiene', ['detersiv', 'ammorbid', 'sapone', 'shampoo', 'bagnoschiuma', 'dentifric', 'spazzolin', 'carta igien', 'scottex', 'tovagliol', 'candeggin', 'sgrassat', 'pannolin', 'assorbent', 'deodorant', 'lavastoviglie', 'pastiglie', 'spugn', 'sacchetti', 'rotolo']],
  ['pesce', ['salmone', 'merluzz', 'orata', 'branzin', 'spigol', 'gamber', 'cozze', 'vongole', 'calamar', 'polpo', 'seppi', 'pesce', 'alici', 'acciughe', 'sgombro', 'tonno fresco', 'filetti di platessa', 'platessa', 'baccal']],
  ['carne', ['pollo', 'tacchino', 'manzo', 'bovino', 'vitello', 'vitellone', 'suino', 'maiale', 'agnello', 'coniglio', 'macinat', 'salsicc', 'hamburger', 'bistecc', 'fesa', 'petto di', 'cosce', 'sovracosc', 'arrosto', 'spezzatino', 'fettine', 'braciol', 'costine', 'scottona', 'polpett', 'wurstel']],
  ['salumiFormaggi', ['prosciutto', 'salame', 'mortadella', 'bresaola', 'speck', 'coppa', 'pancetta', 'guanciale', 'parmigiano', 'grana', 'pecorino', 'gorgonzola', 'formaggi', 'provolone', 'asiago', 'fontina', 'taleggio', 'stracchino', 'ricotta', 'mozzarella', 'scamorza', 'burrata', 'emmental', 'ciauscolo']],
  ['latteYogurt', ['latte', 'yogurt', 'uova', 'burro', 'panna', 'kefir', 'skyr', 'mascarpone', 'besciamella']],
  ['fruttaVerdura', ['mela', 'mele', 'banan', 'aranc', 'limon', 'mandarin', 'clementin', 'pera', 'pere', 'kiwi', 'uva', 'fragol', 'pesche', 'albicocc', 'ananas', 'melon', 'anguria', 'insalat', 'lattug', 'rucola', 'spinaci', 'pomodor', 'zucchin', 'melanzan', 'peperon', 'carot', 'patat', 'cipoll', 'aglio', 'finocch', 'broccol', 'cavol', 'sedano', 'funghi', 'zucca', 'carciof', 'fagiolin', 'verdur', 'frutta', 'avocado', 'mirtill', 'basilico', 'prezzemolo']],
  ['panePasticceria', ['pane', 'panino', 'panini', 'focaccia', 'piadin', 'grissin', 'cracker', 'fette biscottate', 'cornett', 'brioche', 'pizza']],
  ['bevande', ['acqua', 'birra', 'vino', 'spumante', 'prosecco', 'succo', 'aranciata', 'cola', 'tè ', 'the ', 'caffè', 'caffe', 'bibita', 'energy', 'tonica', 'amaro', 'liquore', 'gin', 'vodka', 'aperitivo', 'spritz']],
  ['dolciSnack', ['biscott', 'cioccolat', 'merend', 'patatine', 'snack', 'caramell', 'wafer', 'torta', 'crostat', 'nutella', 'gomme', 'chewing', 'barrett', 'dolce', 'pandoro', 'panettone', 'colomba', 'marmellat', 'confettur', 'miele']],
  ['dispensa', ['pasta', 'spaghetti', 'penne', 'fusilli', 'rigatoni', 'riso', 'farina', 'zucchero', 'sale', 'olio', 'aceto', 'passata', 'pelati', 'sugo', 'pesto', 'legumi', 'ceci', 'lenticchie', 'fagioli', 'tonno', 'sottoli', 'maionese', 'ketchup', 'cereali', 'muesli', 'brodo', 'dado', 'spezie', 'gnocchi', 'lasagne', 'tortellini', 'ravioli', 'polenta', 'cous cous']],
];

export function guessSegment(name?: string): Segment | undefined {
  if (!name) return undefined;
  const n = ` ${name.toLowerCase()} `;
  for (const [segment, words] of KEYWORDS) {
    if (words.some((w) => n.includes(w))) return segment;
  }
  return undefined;
}
