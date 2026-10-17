/**
 * What the Explorer Quiz does: start it, make the next question (one at a
 * time; a second press waits for the first), check a typed answer or a
 * multiple-choice pick (one go), give a hint and then a closer one, show
 * the answer, pick a level, fold and close the bar. A live answer (a level,
 * how many names) is read again when what was typed doesn't match, so a
 * question asked yesterday is still fair today. State in
 * state/explorerQuiz.ts; questions from data/explorer/quiz/.
 */
import { getNameData } from '../../../data/explorer/account';
import { makeQuestion, recheckAnswer } from '../../../data/explorer/quiz/generators';
import { checkAnswer, checkChoice } from '../../../rules/explorer/quiz/check';
import { RECENT_SUBJECTS, RECENT_TEMPLATES, remember } from '../../../rules/explorer/quiz/pick';
import type { QuizAnswer, QuizLevel } from '../../../rules/explorer/quiz/types';
import {
  ASKED_MAX,
  getQuiz,
  setQuiz,
  setQuizBusy,
  setQuizFailed,
  type QuizState,
} from '../../../state/explorerQuiz';

let making: Promise<boolean> | null = null;

/** Leaving a question unanswered ends the streak. */
const skipped = (state: QuizState) => state.question !== null && state.status === 'asking';

/** A new question in place of the open one; false when none could be made. */
export function askNext(): Promise<boolean> {
  if (making) return making;
  setQuizBusy(true);
  setQuizFailed(false);
  making = (async () => {
    try {
      const before = getQuiz();
      const asked = new Set(before.asked);
      const recentSubjects = new Set(before.recent.subjects);
      const question = await makeQuestion({
        level: before.level,
        seen: (key) => asked.has(key),
        fresh: (subject) => !recentSubjects.has(subject),
        history: {
          templates: before.recent.templates,
          streak: skipped(before) ? 0 : before.score.streak,
          lastOutcome: skipped(before) ? 'skipped' : before.lastOutcome,
          asked: before.score.asked,
        },
      });
      if (!question) {
        setQuizFailed(true);
        return false;
      }
      setQuiz((state) => ({
        ...state,
        on: true,
        folded: false,
        question,
        status: 'asking',
        misses: 0,
        hints: 0,
        picked: null,
        lastOutcome: skipped(state) ? 'skipped' : state.lastOutcome,
        score: {
          ...state.score,
          asked: state.score.asked + 1,
          streak: skipped(state) ? 0 : state.score.streak,
        },
        asked: remember(state.asked, [question.key], ASKED_MAX),
        recent: {
          templates: [...state.recent.templates, question.template].slice(-RECENT_TEMPLATES),
          subjects: remember(state.recent.subjects, question.subjects ?? [], RECENT_SUBJECTS),
        },
      }));
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

const ownerOf = async (name: string) => {
  try {
    return (await getNameData(name))?.owner ?? null;
  } catch {
    return null;
  }
};

function scoreRight(state: QuizState): QuizState {
  const streak = state.score.streak + 1;
  return {
    ...state,
    status: 'right',
    lastOutcome: 'right',
    score: {
      ...state.score,
      right: state.score.right + 1,
      streak,
      best: Math.max(state.score.best, streak),
    },
  };
}

/** Whether `input` answers the open question; a right one is scored once. */
export async function submitAnswer(input: string): Promise<boolean> {
  const { question, status } = getQuiz();
  if (!question || status !== 'asking' || question.answer.kind === 'choice') return false;
  let answer: QuizAnswer = question.answer;
  let right = await checkAnswer(answer, input, ownerOf);
  // A live answer may have moved on since it was asked: read it again.
  if (!right && question.live) {
    const fresh = await recheckAnswer(question);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(answer)) {
      answer = fresh;
      right = await checkAnswer(fresh, input, ownerOf);
    }
  }
  setQuiz((state) => {
    // The question may have changed while a name was looked up.
    if (state.question?.key !== question.key || state.status !== 'asking') return state;
    const updated =
      answer === question.answer ? state : { ...state, question: { ...question, answer } };
    return right ? scoreRight(updated) : { ...updated, misses: updated.misses + 1 };
  });
  return right;
}

/** A multiple-choice pick: right, or the answer is shown (one go). */
export function submitChoice(index: number): boolean {
  const { question, status } = getQuiz();
  if (!question || status !== 'asking' || question.answer.kind !== 'choice') return false;
  const right = checkChoice(question.answer, index);
  setQuiz((state) => {
    if (state.question?.key !== question.key || state.status !== 'asking') return state;
    const picked = { ...state, picked: index };
    return right
      ? scoreRight(picked)
      : {
          ...picked,
          status: 'shown',
          lastOutcome: 'shown',
          score: { ...picked.score, streak: 0 },
        };
  });
  return right;
}

/** The first hint, then the closer one. */
export function showHint(): void {
  setQuiz((state) => ({ ...state, hints: Math.min(2, state.hints + 1) }));
}

/** The answer, read again first when it is live. */
export async function revealAnswer(): Promise<void> {
  const { question, status } = getQuiz();
  if (!question || status !== 'asking') return;
  const fresh = question.live ? await recheckAnswer(question) : null;
  setQuiz((state) =>
    state.question?.key === question.key && state.status === 'asking'
      ? {
          ...state,
          question: fresh ? { ...question, answer: fresh } : state.question,
          status: 'shown',
          lastOutcome: 'shown',
          score: { ...state.score, streak: 0 },
        }
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
