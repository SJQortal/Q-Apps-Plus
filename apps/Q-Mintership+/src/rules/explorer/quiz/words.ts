/**
 * The Explorer Quiz's own words (pure): each theme's heading, what it says
 * to a right or a wrong answer, a streak, and while it thinks; ordinals,
 * weekdays and a word on amounts. Light, never at anyone's expense.
 */
import type { QuizTheme } from './types';

export const KICKERS: Readonly<Record<QuizTheme, string>> = {
  history: 'Chain history',
  money: 'Follow the money',
  names: 'Name game',
  minting: 'Minting archaeology',
  groups: 'Group drama',
  blocks: 'Block party',
  people: 'Who’s who',
  detective: 'Detective work',
  time: 'Time travel',
  polls: 'The people have spoken',
  qdn: 'QDN watch',
  trading: 'Trade secrets',
};

/** One of `lines`, by `rng`. */
export function say<T>(rng: () => number, lines: readonly T[]): T {
  return lines[Math.min(lines.length - 1, Math.floor(rng() * lines.length))];
}

export const RIGHT_LINES = [
  'Right!',
  'Spot on!',
  'Correct. The chain agrees.',
  'Nailed it.',
  'Right, detective.',
  'Yes! Sharp eyes.',
] as const;

export const WRONG_LINES = [
  'Not quite. Look again, or take a hint.',
  'The chain says otherwise. Try again?',
  'Hmm, no. Have another look.',
  'Not that one. Dig a little deeper.',
] as const;

/** A multiple-choice question has one go. */
export const MISSED_CHOICE_LINES = [
  'Not this time.',
  'So close. Or not.',
  'Ah, not that one.',
] as const;

export const SHOWN_LINES = ['Here it is.', 'No shame: here it is.', 'The answer'] as const;

export const THINKING_LINES = [
  'Digging through blocks…',
  'Asking your node nicely…',
  'Picking a random corner of the chain…',
  'Reading old transactions…',
  'Following the money…',
  'Sharpening a tricky one…',
  'Dusting off some history…',
] as const;

/** Said after a right answer that makes a streak worth saying, or null. */
export function streakLine(streak: number, best: number): string | null {
  if (streak >= 10 && streak % 5 === 0) return `${streak} in a row. Are you a node?`;
  if (streak === 5) return 'Five in a row. Impressive.';
  if (streak === 3) return 'Three in a row!';
  if (streak > 3 && streak === best) return 'New best streak!';
  return null;
}

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
  'twentieth',
];

/** "first" … "twentieth", then "21st". */
export function ordinal(n: number): string {
  if (n >= 1 && n <= ORDINALS.length) return ORDINALS[n - 1];
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : n % 10 === 1
        ? 'st'
        : n % 10 === 2
          ? 'nd'
          : n % 10 === 3
            ? 'rd'
            : 'th';
  return `${n}${suffix}`;
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** The day of the week of `timestamp` here (as the Explorer shows dates), with its short forms. */
export function weekdayForms(timestamp: number): { shown: string; accepted: string[] } {
  const day = WEEKDAYS[new Date(timestamp).getDay()];
  return { shown: day, accepted: [day, day.slice(0, 3), day.slice(0, 2)] };
}

/** `text` ending a sentence: a full stop, unless it already ends with one (inside quotes too). */
export function endSentence(text: string): string {
  return /[.!?…][”"’']?$/.test(text.trim()) ? text : `${text}.`;
}

/** A word on an amount of QORT, for the fact said with the answer; null for an ordinary one. */
export function amountRemark(amount: number): string | null {
  if (amount > 0 && amount < 0.001) return 'Tiny, but every QORT counts.';
  if (amount >= 100_000) return 'That is a lot of QORT in one go.';
  if (amount >= 10_000) return 'A serious amount of QORT.';
  if (Number.isInteger(amount) && amount >= 100 && amount % 100 === 0)
    return 'A nice round number.';
  return null;
}
