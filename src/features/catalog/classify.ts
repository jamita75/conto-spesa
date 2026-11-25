import type { Segment } from './segments';
import { guessSegment } from './segments';
import { guessPrivateLabel } from './privateLabel';

/** Proposta automatica di reparto e marca del negozio a partire dal nome letto. */
export function classifyProduct(name?: string, chain?: string): { segment?: Segment; privateLabel?: boolean } {
  return { segment: guessSegment(name), privateLabel: guessPrivateLabel(name, chain) };
}
