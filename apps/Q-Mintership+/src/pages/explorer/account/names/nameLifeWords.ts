/** Words for a name's whole history (NameLife.tsx). */
import type { NameLife } from '../../../../data/explorer/nameLife';
import { formatCount, formatDate } from '../../../../utils/format';

export const LIFE_BUTTON = 'Its whole history';
export const LIFE_READING = 'Reading back through the accounts that had it…';
export const LIFE_ERROR = 'Couldn’t read its whole history.';
export const LIFE_NO_RECORD = 'Core has no record of this name now.';
/** Entries shown before "Show all". */
export const LIFE_SHOWN = 10;

const changes = (n: number) => `${formatCount(n)} ${n === 1 ? 'change' : 'changes'}`;

/**
 * The line over a name's whole history: when it was registered, how many
 * changes since (sales, listings, renames, its data), and how many
 * accounts had it, when more than one.
 */
export function lifeSummary(life: NameLife): string {
  const owners = new Set(life.owners).size;
  const parts =
    life.end.kind === 'registered'
      ? [
          `Registered ${formatDate(life.end.tx.timestamp)}`,
          life.steps.length > 1 ? `${changes(life.steps.length - 1)} since` : 'no changes since',
        ]
      : [`${changes(life.steps.length)} found`];
  if (owners > 1) parts.push(`${formatCount(owners)} owners`);
  return parts.join(' · ');
}

/** Under a history that doesn't reach the registration its record gives. */
export function otherRegistrationLine(registered: number | null): string {
  return registered === null
    ? 'It doesn’t reach the registration its record gives: part of its history is missing here.'
    : `Its record gives another registration, ${formatDate(registered)}: part of its history is missing here.`;
}

export const CUT_CAPPED_AFTER =
  '’s name transactions go back further than the 1,000 that can be read: what came before isn’t shown.';
export const CUT_NOT_FOUND_AFTER =
  ' got it isn’t among its name transactions, so what came before isn’t shown.';

export function cutHopsLine(hops: number): string {
  return `It went through more than ${formatCount(hops)} owners and names: the earliest aren’t shown.`;
}
