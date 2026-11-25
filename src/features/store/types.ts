/** Negozio della spesa in corso (tipologia GDO + insegna). */
export type StoreType = 'food' | 'nonfood';

export type Store = {
  type: StoreType;
  /** insegna, es. "Conad". Vuota = non indicata */
  chain?: string;
};

export const STORE_TYPE_LABEL: Record<StoreType, string> = {
  food: 'Alimentare',
  nonfood: 'Non alimentare',
};

export const STORE_TYPE_ICON: Record<StoreType, string> = {
  food: '🛒',
  nonfood: '🏬',
};

/** Insegne proposte. Si può sempre scrivere un nome diverso con "Altro". */
export const CHAINS: Record<StoreType, string[]> = {
  food: [
    'Conad', 'Coop', 'Esselunga', 'Carrefour', 'Lidl', 'Eurospin', 'Despar', 'Famila',
    'Pam', 'Penny', 'MD', 'Aldi', 'Sì con te', 'Oasi', 'Tigre', 'Crai', 'Sigma', 'In\'s',
  ],
  nonfood: [
    'Acqua & Sapone', 'Tigotà', 'Leroy Merlin', 'Brico io', 'Bricocenter', 'OBI', 'Decathlon',
    'MediaWorld', 'Unieuro', 'Euronics', 'Action', 'Kasanova', 'Maxi Zoo', 'Arcaplanet',
  ],
};

export function storeLabel(store?: Store): string {
  if (!store) return 'Negozio non scelto';
  return store.chain ? `${store.chain} · ${STORE_TYPE_LABEL[store.type]}` : STORE_TYPE_LABEL[store.type];
}
