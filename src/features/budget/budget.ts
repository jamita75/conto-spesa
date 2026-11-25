import type { Cents } from '../../lib/money';

/**
 * Limite di spesa: quanto si può pagare al massimo (contanti nel portafoglio,
 * disponibilità della carta). Si confronta con quanto si paga davvero in cassa,
 * cioè il totale meno i buoni già sbloccati.
 */
export type BudgetLevel = 'ok' | 'near' | 'over';

export type BudgetStatus = {
  budget: Cents;
  toPay: Cents;
  /** quanto si può ancora spendere (0 se superato) */
  left: Cents;
  /** di quanto si è sforato (0 se dentro il limite) */
  over: Cents;
  /** 0..1 (bloccato a 1 per la barra) */
  ratio: number;
  level: BudgetLevel;
};

/** soglia di attenzione: dal 85% del limite, o quando restano meno di 5 € */
export const NEAR_RATIO = 0.85;
export const NEAR_MIN_LEFT: Cents = 500;

export function budgetStatus(toPay: Cents, budget: Cents): BudgetStatus {
  const left = Math.max(0, budget - toPay);
  const over = Math.max(0, toPay - budget);
  const ratio = budget > 0 ? Math.min(1, toPay / budget) : 1;
  let level: BudgetLevel = 'ok';
  if (toPay > budget) level = 'over';
  else if (toPay > 0 && (toPay >= budget * NEAR_RATIO || left < NEAR_MIN_LEFT)) level = 'near';
  return { budget, toPay, left, over, ratio, level };
}

const RANK: Record<BudgetLevel, number> = { ok: 0, near: 1, over: 2 };

/** true se il livello è peggiorato (serve per avvisare una sola volta al passaggio) */
export function budgetWorsened(prev: BudgetLevel, next: BudgetLevel): boolean {
  return RANK[next] > RANK[prev];
}

/** importi rapidi proposti nella schermata del limite */
export const QUICK_BUDGETS: Cents[] = [2000, 3000, 5000, 8000, 10000, 15000];
