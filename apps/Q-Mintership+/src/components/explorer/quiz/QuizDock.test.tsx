/**
 * The Explorer Quiz's bar on the mock world: a wrong answer, a hint, a
 * right answer by a name (looked up through Core), the answer with where to
 * find it, the score; the next question at a level picked; folding and
 * closing; kept on the device. Read-only.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADDR, TIP } from '../../../../e2e/world.mjs';
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
  how: 'Connections → Reward shares: “Sponsored by …”.',
  link: `/explorer/account/${ADDR.learner}/connections`,
  linkLabel: 'Open its Connections',
};

afterEach(() => resetQuiz());

async function open() {
  resetQuiz();
  setQuiz(() => ({
    ...EMPTY_QUIZ,
    on: true,
    question: QUESTION,
    score: { asked: 1, right: 0, streak: 0, best: 0 },
    asked: [QUESTION.key],
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

    // A name: Core says who owns it.
    await user.clear(field);
    await user.type(field, 'Lou Left');
    await user.click(within(bar).getByRole('button', { name: 'Check' }));
    expect(await within(bar).findByText('Right!', {}, T)).toBeVisible();
    expect(bar).toHaveTextContent(ADDR.left);
    expect(within(bar).getByRole('link', { name: 'Open its Connections' })).toHaveAttribute(
      'href',
      QUESTION.link
    );
    expect(within(bar).getByText('1 of 1 right')).toBeVisible();
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
    expect(within(bar).getByText('The answer')).toBeVisible();
    expect(getQuiz().status).toBe('shown');

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
});
