/**
 * How the Explorer Quiz picks its next question (pure; data/explorer/quiz/
 * generators.ts makes it):
 *
 * - **The level**, unless one is picked: about a quarter easy, a third
 *   medium, a quarter tricky, the rest expert. Each right answer in a row
 *   moves the odds a little toward the harder ones (up to 6 in a row); an
 *   answer just shown (given up) moves them back toward easy; the first two
 *   questions are never expert.
 * - **The kind of question** at that level: none of the last 3 kinds
 *   asked, the ones asked less lately more often, and a different theme
 *   than the last question's more often than the same.
 */
import type { QuizLevel, QuizTheme } from './types';

export const LEVEL_ORDER: readonly QuizLevel[] = ['easy', 'medium', 'tricky', 'expert'];

/** The kinds asked lately, oldest first (the newest 40 are kept). */
export const RECENT_TEMPLATES = 40;
/** What questions were about lately (accounts, names, blocks, groups). */
export const RECENT_SUBJECTS = 60;

export interface PickHistory {
  /** Kinds asked, oldest first. */
  templates: readonly string[];
  streak: number;
  /** How the last question went. */
  lastOutcome: 'right' | 'shown' | 'skipped' | null;
  /** Questions asked so far. */
  asked: number;
}

export type Weights = Record<QuizLevel, number>;

export function levelWeights(history: PickHistory): Weights {
  const s = Math.min(Math.max(history.streak, 0), 6);
  const w: Weights = {
    easy: Math.max(0.08, 0.27 - 0.03 * s),
    medium: 0.34,
    tricky: 0.24 + 0.015 * s,
    expert: 0.15 + 0.015 * s,
  };
  if (history.lastOutcome === 'shown') {
    w.easy += 0.15;
    w.expert *= 0.5;
  }
  // A gentle start.
  if (history.asked < 2) {
    w.expert = 0;
    w.tricky *= 0.5;
  }
  const total = LEVEL_ORDER.reduce((sum, level) => sum + w[level], 0);
  return Object.fromEntries(LEVEL_ORDER.map((level) => [level, w[level] / total])) as Weights;
}

/** One of `items`, each as likely as its weight (none above 0: null). */
export function pickWeighted<T>(
  rng: () => number,
  items: readonly T[],
  weightOf: (item: T) => number
): T | null {
  const weights = items.map((item) => Math.max(0, weightOf(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}

export function pickLevel(rng: () => number, weights: Weights): QuizLevel {
  return pickWeighted(rng, LEVEL_ORDER, (level) => weights[level]) ?? 'medium';
}

export interface TemplateInfo {
  id: string;
  level: QuizLevel;
  theme: QuizTheme;
  /** How often it comes up against the others of its level (1 by default). */
  weight?: number;
}

/**
 * A kind of question of `level`: not one of the last 3 asked, weighted by
 * how rarely it came up lately, a theme other than the last one's favoured,
 * and the kinds already tried for this question (`tried`) much less likely.
 * Null when the level has none left.
 */
export function pickTemplate<T extends TemplateInfo>(
  rng: () => number,
  templates: readonly T[],
  level: QuizLevel,
  recent: readonly string[],
  tried: ReadonlyMap<string, number> = new Map()
): T | null {
  const lastThree = new Set(recent.slice(-3));
  const last = recent.length ? recent[recent.length - 1] : null;
  const lastTheme = templates.find((t) => t.id === last)?.theme ?? null;
  const uses = new Map<string, number>();
  for (const id of recent) uses.set(id, (uses.get(id) ?? 0) + 1);
  const pool = templates.filter((t) => t.level === level && !lastThree.has(t.id));
  return pickWeighted(
    rng,
    pool,
    (t) =>
      ((t.weight ?? 1) / (1 + (uses.get(t.id) ?? 0))) *
      (t.theme === lastTheme ? 0.4 : 1) *
      (1 / (1 + 3 * (tried.get(t.id) ?? 0)))
  );
}

/** `list` with `items` added at its end, without repeats, the newest `max` kept. */
export function remember(list: readonly string[], items: readonly string[], max: number): string[] {
  const added = new Set(items);
  return [...list.filter((item) => !added.has(item)), ...items].slice(-max);
}
