/**
 * The Explorer Quiz's state (jotai, default store), kept on this device
 * (`<prefix>explorer-quiz`) so the open question stays at the bottom of the
 * screen while its answer is looked for across Explorer pages, and after a
 * reload: whether the quiz is on and folded, the question and how it
 * stands, the level picked, the score, and the questions already asked
 * (their keys only, the newest 300), so none comes twice.
 *
 * Every storage access is guarded: without storage the quiz still works,
 * for the session.
 */
import { atom, getDefaultStore, useAtomValue } from 'jotai';
import { STORAGE_PREFIX } from '../constants/plus';
import type { QuizLevel, QuizQuestion } from '../rules/explorer/quiz/types';

export const QUIZ_KEY = `${STORAGE_PREFIX}explorer-quiz`;
export const ASKED_MAX = 300;

export type QuizStatus = 'asking' | 'right' | 'shown';

export interface QuizScore {
  /** Questions asked. */
  asked: number;
  right: number;
  /** Right in a row; a shown answer or a skipped question ends it. */
  streak: number;
  best: number;
}

export interface QuizState {
  v: 1;
  /** The bar is on screen (on Explorer pages). */
  on: boolean;
  /** Folded to one line. */
  folded: boolean;
  question: QuizQuestion | null;
  status: QuizStatus;
  /** Wrong answers to this question. */
  misses: number;
  hinted: boolean;
  /** The level asked for; null for any. */
  level: QuizLevel | null;
  score: QuizScore;
  asked: string[];
}

export const EMPTY_QUIZ: QuizState = {
  v: 1,
  on: false,
  folded: false,
  question: null,
  status: 'asking',
  misses: 0,
  hinted: false,
  level: null,
  score: { asked: 0, right: 0, streak: 0, best: 0 },
  asked: [],
};

const LEVELS: ReadonlySet<unknown> = new Set(['easy', 'medium', 'tricky']);

function isQuestion(value: unknown): value is QuizQuestion {
  const q = value as Partial<QuizQuestion> | null;
  return (
    Boolean(q) &&
    q?.v === 1 &&
    typeof q.key === 'string' &&
    Array.isArray(q.parts) &&
    Boolean(q.answer) &&
    typeof q.hint === 'string'
  );
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

/** What this device kept, checked field by field (anything odd reads as the default). */
export function parseQuiz(raw: string | null): QuizState {
  try {
    const saved = raw ? (JSON.parse(raw) as Partial<QuizState>) : null;
    if (!saved || saved.v !== 1) return EMPTY_QUIZ;
    const score = (saved.score ?? {}) as Partial<QuizScore>;
    const question = isQuestion(saved.question) ? saved.question : null;
    return {
      v: 1,
      on: saved.on === true,
      folded: saved.folded === true,
      question,
      status:
        question && (saved.status === 'right' || saved.status === 'shown')
          ? saved.status
          : 'asking',
      misses: count(saved.misses),
      hinted: saved.hinted === true,
      level: LEVELS.has(saved.level) ? (saved.level as QuizLevel) : null,
      score: {
        asked: count(score.asked),
        right: count(score.right),
        streak: count(score.streak),
        best: count(score.best),
      },
      asked: Array.isArray(saved.asked)
        ? saved.asked.filter((key): key is string => typeof key === 'string').slice(-ASKED_MAX)
        : [],
    };
  } catch {
    return EMPTY_QUIZ;
  }
}

function load(): QuizState {
  try {
    return parseQuiz(window.localStorage.getItem(QUIZ_KEY));
  } catch {
    return EMPTY_QUIZ;
  }
}

export const quizAtom = atom<QuizState>(load());
/** A question is being made (not kept). */
export const quizBusyAtom = atom(false);
/** The last try made no question (not kept). */
export const quizFailedAtom = atom(false);

const store = getDefaultStore();

export function getQuiz(): QuizState {
  return store.get(quizAtom);
}

export function setQuiz(update: (state: QuizState) => QuizState): QuizState {
  const next = update(store.get(quizAtom));
  store.set(quizAtom, next);
  try {
    window.localStorage.setItem(QUIZ_KEY, JSON.stringify(next));
  } catch {
    // Kept for the session only.
  }
  return next;
}

export function useQuiz(): QuizState {
  return useAtomValue(quizAtom);
}

export function useQuizBusy(): boolean {
  return useAtomValue(quizBusyAtom);
}

export function setQuizBusy(busy: boolean): void {
  store.set(quizBusyAtom, busy);
}

export function useQuizFailed(): boolean {
  return useAtomValue(quizFailedAtom);
}

export function setQuizFailed(failed: boolean): void {
  store.set(quizFailedAtom, failed);
}

/** For tests: back to a fresh quiz (storage too). */
export function resetQuiz(): void {
  store.set(quizAtom, EMPTY_QUIZ);
  store.set(quizBusyAtom, false);
  store.set(quizFailedAtom, false);
  try {
    window.localStorage.removeItem(QUIZ_KEY);
  } catch {
    // Nothing kept.
  }
}
