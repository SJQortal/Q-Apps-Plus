/**
 * Incoming green, outgoing red (Simon, 2026-10-16), for transactions told
 * from an account's viewpoint: the amounts in a sentence take the colour,
 * and DirectionMark adds an arrow and the word for screen readers, so the
 * colour is never the only sign. A row carries `data-direction="in|out"`;
 * these rules colour the `<strong>` amounts inside it (TxSentence).
 */
import type { Theme } from '@mui/material/styles';
import { readableTone } from '../../utils/readable';

export type Flow = 'in' | 'out';

/** Each way in words (for screen readers, beside the arrow). */
export const FLOW_WORD: Record<Flow, string> = { in: 'Incoming', out: 'Outgoing' };

/** The colour of each way, as text that reads at 4.5:1. */
export function directionColor(theme: Theme, flow: Flow): string {
  return readableTone(theme, flow === 'in' ? 'success' : 'error');
}

/** Rules for an element holding `data-direction` rows (or being one). */
export function directionRules(theme: Theme) {
  return {
    '&[data-direction="in"] strong, & [data-direction="in"] strong': {
      color: directionColor(theme, 'in'),
    },
    '&[data-direction="out"] strong, & [data-direction="out"] strong': {
      color: directionColor(theme, 'out'),
    },
  };
}
