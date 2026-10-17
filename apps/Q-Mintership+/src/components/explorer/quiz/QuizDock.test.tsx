/**
 * The Explorer Quiz's bar on the mock world: its heading, a wrong answer,
 * a hint and a closer one, a right answer by a name (looked up through
 * Core), the answer with where to find it and a fact, the score; a
 * multiple choice (one go); a live answer read again; the next question at
 * a level picked; folding and closing; kept on the device. Read-only. The
 * playful lines are picked by Math.random, held at 0 here (the first line).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADDR, PEOPLE, TIP } from '../../../../e2e/world.mjs';
import { renderPage } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { getQuiz, QUIZ_KEY, resetQuiz, setQuiz, EMPTY_QUIZ } from '../../../state/explorerQuiz';
import type { QuizQuestion } from '../../../rules/explorer/quiz/types';
import QuizDock from './QuizDock';

const T = { timeout: 4000 };

const QUESTION: QuizQuestion = {
  v: 1,
  key: 'test:sponsor',
  template: 'sponsor',
  level: 'medium',
  tip: TIP,
  parts: [
    { kind: 'text', text: 'Who sponsored ' },
    { kind: 'account', address: ADDR.learner, name: 'Leo Learner' },
    { kind: 'text', text: '?' },
  ],
  answer: { kind: 'account', address: ADDR.left, name: null },
  placeholder: 'A name or an address',
  hint: 'Sponsors are in Connections, under Reward shares.',
  hint2: 'Its sponsor made it a reward share in block 1,371,641.',
  how: 'Connections → Reward shares: “Sponsored by …”.',
  fact: 'That reward share started in block 1,371,641.',
  kicker: 'Minting archaeology',
  link: `/explorer/account/${ADDR.learner}/connections`,
  linkLabel: 'Open its Connections',
};

const CHOICE: QuizQuestion = {
  ...QUESTION,
  key: 'test:higher',
  template: 'higherLower',
  level: 'easy',
  kicker: 'Higher or lower',
  parts: [
    {
      kind: 'text',
      text: 'Leo Learner is level 2. Is Lou Left’s level higher, lower, or the same?',
    },
  ],
  answer: {
    kind: 'choice',
    options: ['Higher', 'Lower', 'The same'].map((label) => ({
      parts: [{ kind: 'text', text: label }],
      label,
    })),
    correct: 0,
  },
  placeholder: '',
};

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
  resetQuiz();
});

async function open(question: QuizQuestion = QUESTION) {
  resetQuiz();
  setQuiz(() => ({
    ...EMPTY_QUIZ,
    on: true,
    question,
    score: { asked: 1, right: 0, streak: 0, best: 0 },
    asked: [question.key],
  }));
  const user = userEvent.setup();
  const result = await renderPage(<QuizDock />, { persona: 'learner', path: '/explorer' });
  return { ...result, user };
}

describe('the Explorer Quiz bar', () => {
  it('checks answers, gives a hint, and shows where the answer is', async () => {
    const { user, container } = await open();
    const bar = screen.getByRole('region', { name: 'Explorer Quiz' });
    expect(within(bar).getByText('Medium', { selector: 'span' })).toBeVisible();
    expect(within(bar).getByText('Minting archaeology')).toBeVisible();
    expect(bar).toHaveTextContent('Who sponsored Leo Learner?');
    const field = within(bar).getByRole('textbox', { name: 'Your answer' });
    expect(field).toHaveAttribute('placeholder', 'A name or an address');

    await user.type(field, 'Kit Kicked');
    await user.click(within(bar).getByRole('button', { name: 'Check' }));
    expect(
      await within(bar).findByText('Not quite. Look again, or take a hint.', {}, T)
    ).toBeVisible();
    expect(getQuiz().misses).toBe(1);

    await user.click(within(bar).getByRole('button', { name: 'Hint' }));
    expect(within(bar).getByText(QUESTION.hint)).toBeVisible();
    // A closer one, with the page that shows it.
    await user.click(within(bar).getByRole('button', { name: 'Closer hint' }));
    expect(within(bar).getByText(QUESTION.hint2 as string)).toBeVisible();
    expect(within(bar).getByRole('link', { name: 'Show me where' })).toHaveAttribute(
      'href',
      QUESTION.link
    );
    expect(within(bar).getByRole('button', { name: 'Closer hint' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    // A name: Core says who owns it.
    await user.clear(field);
    await user.type(field, 'Lou Left');
    await user.click(within(bar).getByRole('button', { name: 'Check' }));
    expect(await within(bar).findByText('Right!', {}, T)).toBeVisible();
    expect(bar).toHaveTextContent(ADDR.left);
    expect(within(bar).getByText(QUESTION.fact as string)).toBeVisible();
    expect(within(bar).getByRole('link', { name: 'Open its Connections' })).toHaveAttribute(
      'href',
      QUESTION.link
    );
    // In the title row from 600 px, under the buttons on phones (one shows at a time).
    expect(within(bar).getAllByText('1 of 1 right')).toHaveLength(2);
    await waitFor(() =>
      expect(within(bar).getByRole('button', { name: 'Next question' })).toHaveFocus()
    );
    expect(getQuiz()).toMatchObject({ status: 'right', score: { right: 1, streak: 1, best: 1 } });
    expect(JSON.parse(window.localStorage.getItem(QUIZ_KEY) ?? '{}').status).toBe('right');
    await expectNoAxeViolations(container);
  });

  it('makes the next question at the level picked, into its field', async () => {
    const { user } = await open();
    const bar = screen.getByRole('region', { name: 'Explorer Quiz' });
    await user.selectOptions(within(bar).getByRole('combobox', { name: 'Level' }), 'easy');
    expect(getQuiz().level).toBe('easy');
    await user.click(within(bar).getByRole('button', { name: 'Another question' }));
    await waitFor(() => expect(getQuiz().question?.key).not.toBe(QUESTION.key), T);
    expect(getQuiz().question?.level).toBe('easy');
    // Leaving one unanswered ends the streak; both were counted as asked.
    expect(getQuiz().score).toMatchObject({ asked: 2, streak: 0 });
    await waitFor(() =>
      expect(within(bar).getByRole('textbox', { name: 'Your answer' })).toHaveFocus()
    );
  });

  it('shows the answer on request, folds to one line, and closes', async () => {
    const { user } = await open();
    const bar = screen.getByRole('region', { name: 'Explorer Quiz' });
    await user.click(within(bar).getByRole('button', { name: 'Show the answer' }));
    expect(await within(bar).findByText('Here it is.', {}, T)).toBeVisible();
    await waitFor(() => expect(getQuiz().status).toBe('shown'));
    expect(getQuiz().lastOutcome).toBe('shown');

    const fold = within(bar).getByRole('button', { name: 'Fold the quiz' });
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    await user.click(fold);
    expect(within(bar).queryByRole('textbox')).toBeNull();
    expect(within(bar).getByRole('button', { name: 'Show the question' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(bar).toHaveTextContent('Who sponsored Leo Learner?');

    await user.click(within(bar).getByRole('button', { name: 'Close the quiz' }));
    expect(getQuiz().on).toBe(false);
    // The score and what was asked stay.
    expect(getQuiz().asked).toEqual([QUESTION.key]);
  });

  it('gives a multiple choice one go: a wrong pick shows the right one', async () => {
    const { user, container } = await open(CHOICE);
    const bar = screen.getByRole('region', { name: 'Explorer Quiz' });
    expect(within(bar).getByText('Higher or lower')).toBeVisible();
    expect(within(bar).queryByRole('textbox')).toBeNull();
    const options = within(bar).getByRole('group', { name: 'Pick one (one go)' });
    await user.click(within(options).getByRole('button', { name: 'Lower' }));
    expect(within(bar).getByText('Not this time.')).toBeVisible();
    expect(within(options).getByRole('button', { name: 'Higher, the answer' })).toBeVisible();
    expect(within(options).getByRole('button', { name: 'Lower, your pick' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(getQuiz()).toMatchObject({ status: 'shown', picked: 1, score: { streak: 0 } });
    // One go: another press changes nothing.
    await user.click(within(options).getByRole('button', { name: /Higher/ }));
    expect(getQuiz().status).toBe('shown');
    await expectNoAxeViolations(container);
  });

  it('takes the right pick, and says a streak', async () => {
    resetQuiz();
    setQuiz(() => ({
      ...EMPTY_QUIZ,
      on: true,
      question: CHOICE,
      score: { asked: 3, right: 2, streak: 2, best: 2 },
      asked: [CHOICE.key],
    }));
    const user = userEvent.setup();
    await renderPage(<QuizDock />, { persona: 'learner', path: '/explorer' });
    const bar = screen.getByRole('region', { name: 'Explorer Quiz' });
    await user.click(within(bar).getByRole('button', { name: 'Higher' }));
    expect(within(bar).getByText('Right!')).toBeVisible();
    expect(within(bar).getByText('Three in a row!')).toBeVisible();
    expect(getQuiz().score).toMatchObject({ right: 3, streak: 3, best: 3 });
  });

  it('reads a live answer again when what was typed doesn’t match the old one', async () => {
    const level: QuizQuestion = {
      ...QUESTION,
      key: 'test:level',
      template: 'level',
      level: 'easy',
      parts: [{ kind: 'text', text: 'What minting level is Leo Learner at?' }],
      // Asked long ago, when it was another level.
      answer: { kind: 'number', value: '99' },
      placeholder: 'A number',
      live: true,
      args: { address: ADDR.learner },
    };
    const { user } = await open(level);
    const bar = screen.getByRole('region', { name: 'Explorer Quiz' });
    await user.type(
      within(bar).getByRole('textbox', { name: 'Your answer' }),
      String(PEOPLE.learner.level)
    );
    await user.click(within(bar).getByRole('button', { name: 'Check' }));
    expect(await within(bar).findByText('Right!', {}, T)).toBeVisible();
    expect(getQuiz().question?.answer).toEqual({
      kind: 'number',
      value: String(PEOPLE.learner.level),
    });
  });

  it('keeps a history of the questions asked: right, skipped, shown, and clears it', async () => {
    const { user } = await open();
    const bar = screen.getByRole('region', { name: 'Explorer Quiz' });
    // Nothing asked yet: no History.
    expect(within(bar).queryByRole('button', { name: 'History' })).toBeNull();
    await user.type(within(bar).getByRole('textbox', { name: 'Your answer' }), 'Lou Left');
    await user.click(within(bar).getByRole('button', { name: 'Check' }));
    await within(bar).findByText('Right!', {}, T);
    expect(getQuiz().history).toMatchObject([
      { key: QUESTION.key, outcome: 'right', answer: ADDR.left },
    ]);

    // A question left unanswered for another is kept as skipped.
    setQuiz((state) => ({ ...state, question: { ...CHOICE }, status: 'asking', picked: null }));
    await user.selectOptions(within(bar).getByRole('combobox', { name: 'Level' }), 'easy');
    await user.click(await within(bar).findByRole('button', { name: 'Another question' }, T));
    await waitFor(() => expect(getQuiz().question?.key).not.toBe(CHOICE.key), T);
    expect(getQuiz().history.map((e) => [e.key, e.outcome])).toEqual([
      [QUESTION.key, 'right'],
      [CHOICE.key, 'skipped'],
    ]);

    await user.click(await within(bar).findByRole('button', { name: 'History' }, T));
    const dialog = await screen.findByRole('dialog', { name: 'Your quiz history' }, T);
    const list = within(dialog).getByRole('list', { name: 'Questions asked, newest first' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Skipped');
    expect(items[0]).toHaveTextContent('Answer: Higher');
    expect(items[1]).toHaveTextContent('Right');
    expect(items[1]).toHaveTextContent('Who sponsored Leo Learner?');
    expect(within(items[1]).getByRole('link', { name: QUESTION.linkLabel })).toHaveAttribute(
      'href',
      QUESTION.link
    );
    // By how it went.
    await user.click(within(dialog).getByRole('button', { name: 'Right · 1' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    // Cleared on this device: the score stays.
    await user.click(within(dialog).getByRole('button', { name: 'Clear the history' }));
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }));
    expect(within(dialog).getByText(/No questions here yet/)).toBeVisible();
    expect(getQuiz().history).toEqual([]);
    expect(getQuiz().score.right).toBe(1);
  });

  it('keeps a missed pick and an answer shown in the history', async () => {
    const { user } = await open(CHOICE);
    const bar = screen.getByRole('region', { name: 'Explorer Quiz' });
    await user.click(within(bar).getByRole('button', { name: 'The same' }));
    expect(getQuiz().history).toMatchObject([
      { key: CHOICE.key, outcome: 'shown', picked: 'The same', answer: 'Higher' },
    ]);
  });
});
