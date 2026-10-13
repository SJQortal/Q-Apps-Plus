/**
 * The words for a double (rules/double.ts), kept pure so tests can pin
 * them: the chip's full name, the note on its card and why Sign several
 * leaves it out.
 */
import { heightToTime, type ChainNow } from '../../data/chain';
import type { Decision } from '../../rules/decision';
import type { DecisionDouble } from '../../rules/double';
import { formatBlock, formatDateTime, plural } from '../../utils/format';

type DoubleView = Pick<Decision, 'kind'> & { double: DecisionDouble };

/** What the "Double" chip says in full (the rest is for screen readers). */
export function doubleChipText(d: DoubleView): string {
  if (d.double.reason === 'duplicate') return 'Double: the same change is already waiting';
  return d.kind === 'removeAdmin' ? 'Double: nothing to remove' : 'Double: changes nothing';
}

/** Why Sign several leaves a double out. */
export function doubleLeftOutText(d: DoubleView): string {
  if (d.double.reason === 'duplicate')
    return 'Left out: a double, the same change is already waiting';
  return d.kind === 'removeAdmin'
    ? 'Left out: a double, there’s nothing to remove'
    : 'Left out: a double, it changes nothing';
}

/**
 * "It runs out by itself at block 2,760,156 (about 20 Oct 2026, 16:02).",
 * while nothing else would end it first (null otherwise, or before it is in
 * a block). `subject` starts the sentence.
 */
export function runsOutLine(
  d: Pick<Decision, 'phase' | 'window'>,
  now: ChainNow,
  subject = 'It'
): string | null {
  if (!d.window) return null;
  if (d.phase !== 'open' && d.phase !== 'early' && d.phase !== 'tooLate') return null;
  const h = d.window.expiresAtHeight;
  return `${subject} runs out by itself at ${formatBlock(h)} (about ${formatDateTime(heightToTime(now, h))}).`;
}

/**
 * The note on a double's card: why it is a double, and when it runs out.
 * With `advice` (Minter Admins, who can answer it), also that there's no
 * need to sign it and what to do instead. `name` is the subject as shown.
 * The card links to the other decision when there is one.
 */
export function doubleNote(
  d: Pick<Decision, 'kind' | 'phase' | 'window'> & { double: DecisionDouble },
  name: string,
  now: ChainNow,
  advice = true
): string {
  let why: string;
  if (d.double.reason === 'duplicate')
    why = advice
      ? 'The same change is already waiting in an earlier proposal: answer that one instead. Once one of them passes, there’s no need to sign the other.'
      : 'The same change is already waiting in an earlier proposal.';
  else if (d.kind === 'addAdmin')
    why = `${name} is already a Minter Admin, from an earlier proposal. As things stand, if this one passes, nothing changes${advice ? ', so there’s no need to sign it' : ''}.`;
  else
    why = `${name} isn’t a Minter Admin, so there’s nothing to remove.${advice ? ' There’s no need to sign it: reject it, or let it run out.' : ''}`;
  const out = runsOutLine(d, now, d.double.reason === 'duplicate' ? 'This one' : 'It');
  return out ? `${why} ${out}` : why;
}

/** "Plus 2 doubles, marked on their cards: no need to sign them." */
export function doublesAsideText(count: number): string {
  return count === 1
    ? 'Plus 1 double, marked on its card: no need to sign it.'
    : `Plus ${plural(count, 'double')}, marked on their cards: no need to sign them.`;
}
