/**
 * The Explorer Quiz's shapes (Simon, 2026-10-16): a question made from the
 * chain's own data (data/explorer/quiz/), the answer it expects, and where
 * in the Explorer it can be found. A question is kept on this device while
 * it is open, so it survives moving between Explorer pages.
 */

export type QuizLevel = 'easy' | 'medium' | 'tricky' | 'expert';

export const QUIZ_LEVELS: ReadonlyArray<{ value: QuizLevel; label: string }> = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'tricky', label: 'Tricky' },
  { value: 'expert', label: 'Expert' },
];

export function isQuizLevel(value: unknown): value is QuizLevel {
  return QUIZ_LEVELS.some((level) => level.value === value);
}

/** What a question is about: its heading, and spread so two in a row differ. */
export type QuizTheme =
  | 'history'
  | 'money'
  | 'names'
  | 'minting'
  | 'groups'
  | 'blocks'
  | 'people'
  | 'detective'
  | 'time'
  | 'polls'
  | 'qdn'
  | 'trading';

/** A piece of a question: words, or something to look up, shown as it is. */
export type QuizPart =
  | { kind: 'text'; text: string }
  /** An account: its primary name when it has one, else its whole address. */
  | { kind: 'account'; address: string; name: string | null }
  | { kind: 'name'; name: string }
  | { kind: 'group'; id: number; name: string | null }
  | { kind: 'block'; height: number };

/** One option of a multiple-choice question: shown as parts, said as `label`. */
export interface QuizOption {
  parts: QuizPart[];
  label: string;
}

export type QuizAnswer =
  /** An account: its address, or any name it owns now. */
  | { kind: 'account'; address: string; name: string | null }
  /** A number; `value` as Core writes it ("5.67890000", "12"). */
  | { kind: 'number'; value: string; unit?: string }
  /** Words, any of `accepted` (compared ignoring case, spaces and punctuation). */
  | { kind: 'text'; accepted: string[]; shown: string }
  /** The start of a signature (at least `min` characters), or all of it. */
  | { kind: 'prefix'; value: string; min: number }
  /** One of the options, picked once. */
  | { kind: 'choice'; options: QuizOption[]; correct: number };

export interface QuizQuestion {
  v: 1;
  /** Never asked twice on this device. */
  key: string;
  template: string;
  level: QuizLevel;
  theme?: QuizTheme;
  /** A heading over the question: "Follow the money". */
  kicker?: string;
  parts: QuizPart[];
  answer: QuizAnswer;
  /** What to type: "A name or an address". */
  placeholder: string;
  /** Where to look, without giving it away. */
  hint: string;
  /** A closer hint, offered after another miss once the first was read. */
  hint2?: string;
  /** How the answer is found, said once it is answered or shown. */
  how: string;
  /** Something true and worth knowing, said with the answer. */
  fact?: string;
  /** The page that shows it, and its link's words. */
  link: string;
  linkLabel: string;
  /** The chain's height when it was asked. */
  tip: number;
  /**
   * The answer can change with time (a level, how many names): checked
   * again when an answer doesn't match, from `args`.
   */
  live?: boolean;
  args?: Record<string, string | number>;
  /** What it was about (accounts, names, blocks, groups), kept a while so they don't come back soon. */
  subjects?: string[];
}
