/**
 * What the Explorer Quiz does: start it, make the next question (one at a
 * time; a second press waits for the first), check an answer, give a hint,
 * show the answer, pick a level, fold and close the bar. State in
 * state/explorerQuiz.ts; questions from data/explorer/quiz/generators.ts.
 */
import { getNameData } from '../../../data/explorer/account';
import { makeQuestion } from '../../../data/explorer/quiz/generators';
import { checkAnswer } from '../../../rules/explorer/quiz/check';
import type { QuizLevel } from '../../../rules/explorer/quiz/types';
import {
  ASKED_MAX,
  getQuiz,
  setQuiz,
  setQuizBusy,
  setQuizFailed,
} from '../../../state/explorerQuiz';

let making: Promise<boolean> | null = null;

/** A new question in place of the open one; false when none could be made. */
export function askNext(): Promise<boolean> {
  if (making) return making;
  setQuizBusy(true);
  setQuizFailed(false);
  making = (async () => {
    try {
      const before = getQuiz();
      const asked = new Set(before.asked);
      const question = await makeQuestion({
        level: before.level,
        seen: (key) => asked.has(key),
        last: before.question?.template ?? null,
      });
      if (!question) {
        setQuizFailed(true);
        return false;
      }
      setQuiz((state) => {
        // Leaving a question unanswered ends the streak.
        const skipped = state.question !== null && state.status === 'asking';
        return {
          ...state,
          on: true,
          folded: false,
          question,
          status: 'asking',
          misses: 0,
          hinted: false,
          score: {
            ...state.score,
            asked: state.score.asked + 1,
            streak: skipped ? 0 : state.score.streak,
          },
          asked: [...state.asked.filter((key) => key !== question.key), question.key].slice(
            -ASKED_MAX
          ),
        };
      });
      return true;
    } catch {
      setQuizFailed(true);
      return false;
    } finally {
      setQuizBusy(false);
      making = null;
    }
  })();
  return making;
}

/** The bar on screen, unfolded; a question when none is open. */
export async function startQuiz(): Promise<boolean> {
  const state = setQuiz((s) => ({ ...s, on: true, folded: false }));
  if (state.question && state.status === 'asking') return true;
  return askNext();
}

/** Whether `input` answers the open question; a right one is scored once. */
export async function submitAnswer(input: string): Promise<boolean> {
  const { question, status } = getQuiz();
  if (!question || status !== 'asking') return false;
  const right = await checkAnswer(question.answer, input, async (name) => {
    try {
      return (await getNameData(name))?.owner ?? null;
    } catch {
      return null;
    }
  });
  setQuiz((state) => {
    // The question may have changed while a name was looked up.
    if (state.question?.key !== question.key || state.status !== 'asking') return state;
    if (!right) return { ...state, misses: state.misses + 1 };
    const streak = state.score.streak + 1;
    return {
      ...state,
      status: 'right',
      score: {
        ...state.score,
        right: state.score.right + 1,
        streak,
        best: Math.max(state.score.best, streak),
      },
    };
  });
  return right;
}

export function showHint(): void {
  setQuiz((state) => ({ ...state, hinted: true }));
}

export function revealAnswer(): void {
  setQuiz((state) =>
    state.question && state.status === 'asking'
      ? { ...state, status: 'shown', score: { ...state.score, streak: 0 } }
      : state
  );
}

export function setQuizLevel(level: QuizLevel | null): void {
  setQuiz((state) => ({ ...state, level }));
}

export function foldQuiz(folded: boolean): void {
  setQuiz((state) => ({ ...state, folded }));
}

/** The bar goes; the score and the questions asked stay. */
export function closeQuiz(): void {
  setQuiz((state) => ({ ...state, on: false }));
}
