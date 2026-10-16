/**
 * The Explorer's landing page: the field, Recent explorations, Compare,
 * the quick starts, Transactions on Qortal and the guide. Read-only: no
 * POST, no write request to Hub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { renderPage } from '../../test/render';
import { expectNoAxeViolations } from '../../test/axe';
import { mockFetchRoute, qortalCalls } from '../../test/setup';
import { ADDR } from '../../test/world';
import { addPick, RECENT_KEY, recordRecent, resetExplorerState } from '../../state/explorer';
import { getQuiz, resetQuiz } from '../../state/explorerQuiz';
import ExplorerPage from './ExplorerPage';

// The quiz's question, made without reading the chain (its templates have tests of their own).
vi.mock('../../data/explorer/quiz/generators', () => ({
  makeQuestion: vi.fn(async () => ({
    v: 1,
    key: 'test:level',
    template: 'level',
    level: 'easy',
    tip: 1,
    parts: [{ kind: 'text', text: 'What level is Leo Learner at?' }],
    answer: { kind: 'number', value: '2' },
    placeholder: 'A number',
    hint: '',
    how: '',
    link: '/explorer',
    linkLabel: '',
  })),
}));

const T = { timeout: 4000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;

function Probe() {
  const location = useLocation();
  return (
    <output data-testid="at">
      {location.pathname}|{JSON.stringify(location.state ?? null)}
    </output>
  );
}

async function show(persona = 'learner') {
  const result = await renderPage(
    <>
      <ExplorerPage />
      <Probe />
    </>,
    { persona, path: '/explorer', route: '/explorer/*', strict: true }
  );
  mockFetchRoute('/names/search', (url: URL) =>
    (url.searchParams.get('query') ?? '').toLowerCase().startsWith('le')
      ? [{ name: 'Leo Learner', owner: ADDR.learner }]
      : []
  );
  return { ...result, user: userEvent.setup() };
}

const at = () => screen.getByTestId('at').textContent ?? '';

beforeEach(() => {
  resetExplorerState();
  resetQuiz();
});
afterEach(() => vi.useRealTimers());

describe('the Explorer’s landing page', () => {
  it('has the title, the field and no Back, and passes axe', async () => {
    const { container, posts } = await show();
    expect(screen.getByRole('heading', { level: 1, name: 'Explorer' })).toBeInTheDocument();
    expect(screen.getByText('Look up any Qortal account or transaction')).toBeInTheDocument();
    const field = screen.getByRole('combobox', { name: 'Find an account or transaction' });
    expect(field).toHaveAttribute('placeholder', 'Name, Q… address, signature or QDN identifier');
    expect(screen.getByText('Pick a suggestion, or press Enter to look it up')).toBeInTheDocument();
    // A wide screen without touch: ready to type.
    expect(field).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy a link to the Explorer' })).toBeInTheDocument();
    await screen.findByRole('list', { name: 'Recently joined MINTER' }, T);
    await expectNoAxeViolations(container);
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('passes axe with the suggestions open, in their labelled groups', async () => {
    const { user } = await show();
    await user.type(screen.getByRole('combobox', { name: 'Find an account or transaction' }), 'le');
    const names = await screen.findByRole('group', { name: 'Names' }, T);
    await within(names).findByRole('option', { name: /^Leo Learner/ }, T);
    await expectNoAxeViolations(screen.getByRole('listbox'));
  });

  it('lists the accounts explored on this device, opening each in the Explorer; Clear forgets them', async () => {
    recordRecent(ADDR.admin);
    recordRecent(ADDR.learner);
    const { user } = await show();
    const recent = await screen.findByRole('region', { name: 'Recent explorations' }, T);
    const links = within(recent).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      `/explorer/account/${ADDR.learner}`,
      `/explorer/account/${ADDR.admin}`,
    ]);
    expect(
      await within(recent).findByRole('link', { name: 'Avery Admin: explore this account' }, T)
    ).toBeInTheDocument();
    await user.click(within(recent).getByRole('button', { name: 'Clear recent explorations' }));
    expect(screen.queryByRole('region', { name: 'Recent explorations' })).toBeNull();
    expect(window.localStorage.getItem(RECENT_KEY)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Explorer' })).toHaveFocus();
  });

  it('a landing-page link starts a new trail: it carries no Explorer-link state', async () => {
    recordRecent(ADDR.admin);
    const { user } = await show();
    const recent = await screen.findByRole('region', { name: 'Recent explorations' }, T);
    await user.click(within(recent).getByRole('link'));
    expect(at()).toBe(`/explorer/account/${ADDR.admin}|null`);
  });

  it('shows the accounts picked to compare, with Remove and Compare now', async () => {
    addPick(ADDR.admin);
    addPick(ADDR.learner);
    const { user } = await show();
    const compare = await screen.findByRole('region', { name: 'Compare' }, T);
    const remove = await within(compare).findByRole(
      'button',
      { name: 'Remove Avery Admin from compare' },
      T
    );
    expect(remove).toHaveStyle({ width: '44px', height: '44px' });
    await user.click(within(compare).getByRole('button', { name: 'Compare now' }));
    expect(at()).toBe(`/explorer/compare/${ADDR.admin}/${ADDR.learner}|null`);
  });

  it('removing a pick keeps the focus in Compare', async () => {
    addPick(ADDR.admin);
    addPick(ADDR.learner);
    const { user } = await show();
    const compare = await screen.findByRole('region', { name: 'Compare' }, T);
    await user.click(
      await within(compare).findByRole('button', { name: 'Remove Avery Admin from compare' }, T)
    );
    expect(within(compare).getByText('Pick one more account to compare.')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(compare).getByRole('button', { name: 'Remove Leo Learner from compare' })
      ).toHaveFocus()
    );
    expect(within(compare).queryByRole('button', { name: 'Compare now' })).toBeNull();
  });

  it('says how to pick accounts when none is picked', async () => {
    await show();
    const compare = await screen.findByRole('region', { name: 'Compare' }, T);
    expect(within(compare).getByText(/press its Compare button/)).toBeInTheDocument();
  });

  it('starts from your account, open nominations, Minter Admins and new members', async () => {
    await show();
    const quick = await screen.findByRole('region', { name: 'Quick starts' }, T);
    const you = within(quick).getByRole('region', { name: 'Your account' });
    expect(
      within(you).getByRole('link', { name: 'Leo Learner: explore this account' })
    ).toHaveAttribute('href', `/explorer/account/${ADDR.learner}`);
    const nominated = await within(quick).findByRole('list', { name: 'Nominated now' }, T);
    expect(
      within(nominated).getByRole('link', { name: 'Wren Waiting: explore this account' })
    ).toBeInTheDocument();
    const admins = await within(quick).findByRole('list', { name: 'Minter Admins' }, T);
    expect(
      within(admins).getByRole('link', { name: 'Avery Admin: explore this account' })
    ).toHaveAttribute('href', `/explorer/account/${ADDR.admin}`);
    const joined = await within(quick).findByRole('list', { name: 'Recently joined MINTER' }, T);
    const rows = within(joined).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(6);
    expect(rows[0]).toHaveTextContent(/Joined \d/);
  });

  it('leaves Your account out when no one is signed in', async () => {
    await show('signedOut');
    const quick = await screen.findByRole('region', { name: 'Quick starts' }, T);
    expect(within(quick).queryByRole('region', { name: 'Your account' })).toBeNull();
  });

  it('links to Transactions on Qortal', async () => {
    await show();
    expect(screen.getByRole('link', { name: /^Transactions on Qortal/ })).toHaveAttribute(
      'href',
      '/explorer/transactions'
    );
  });

  it('explains how to read the Explorer, where its facts come from, and that it only reads', async () => {
    const { user } = await show();
    await user.click(screen.getByRole('button', { name: 'How to read the Explorer' }));
    const dialog = await screen.findByRole('dialog', { name: 'How to read the Explorer' }, T);
    expect(
      within(dialog).getByText(
        /Nothing here shows who runs an account, as there is no KYC on Qortal\./
      )
    ).toBeVisible();
    expect(within(dialog).getByText(/read from your own node/)).toBeVisible();
    expect(within(dialog).getByText(/each list says how far it got/)).toBeVisible();
    expect(
      within(dialog).getByText(/never sends a transaction or publishes anything/)
    ).toBeVisible();
    for (const tab of ['Overview', 'Connections', 'Transactions', 'Mintership', 'Names'])
      expect(within(dialog).getByText(tab)).toBeInTheDocument();
    await expectNoAxeViolations(dialog);
  });

  it('starts the Explorer Quiz beside How to read the Explorer', async () => {
    const { user } = await show();
    const quiz = screen.getByRole('button', { name: 'Explorer Quiz' });
    expect(quiz.previousElementSibling).toHaveTextContent('How to read the Explorer');
    expect(getQuiz().on).toBe(false);
    await user.click(quiz);
    await waitFor(() => expect(getQuiz().question?.key).toBe('test:level'), T);
    expect(getQuiz()).toMatchObject({ on: true, status: 'asking', score: { asked: 1 } });
    // Pressed again with a question open: the same question, no new one.
    await user.click(quiz);
    expect(getQuiz().score.asked).toBe(1);
    // Nothing sent: the quiz only reads.
    expect(qortalCalls.filter((c) => c.action !== 'GET_USER_ACCOUNT')).toEqual([]);
  });
});
