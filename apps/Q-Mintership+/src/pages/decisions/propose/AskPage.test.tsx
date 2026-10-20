/**
 * + Propose → Ask the Minter Admins, a page as every + Propose choice is
 * (Simon, 2026-10-18): the question, its details, answers and duration, the
 * one encrypted publish, and what the page says once it is published.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { fromData64 } from '../../../data/adminPollRecords';
import { PATHS } from '../../../routes/paths';
import { resetPendingPollWrites } from '../../../state/adminPolls';
import { withAdminPolls } from '../../../test/adminPolls';
import { checkDialogByKeyboard } from '../../../test/keyboard';
import { renderPage, type RenderPageOptions } from '../../../test/render';
import { mockQortalRequest, qortalCallsFor } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import DecisionsPage from '../DecisionsPage';
import AskPage, { ASK_TITLE } from './AskPage';

beforeEach(() => resetPendingPollWrites());
afterEach(() => vi.useRealTimers());
vi.setConfig({ testTimeout: 30_000 });

const user = () => userEvent.setup();
const T = { timeout: 6000 };

async function openAsk(setup: RenderPageOptions['setup'] = withAdminPolls('admin')) {
  const rendered = await renderPage(<AskPage />, {
    persona: 'admin',
    path: PATHS.ask,
    route: PATHS.ask,
    setup,
  });
  await screen.findByRole('heading', { level: 1, name: ASK_TITLE }, T);
  return rendered;
}

const submit = () => screen.getByRole('button', { name: ASK_TITLE });
const publishes = () => qortalCallsFor('PUBLISH_QDN_RESOURCE');
const published = () =>
  mockQortalRequest('PUBLISH_QDN_RESOURCE', (request: Record<string, unknown>) => ({
    type: 'ARBITRARY',
    signature: 'S1',
    identifier: request.identifier,
  }));

function Where() {
  const location = useLocation();
  return <output data-testid="at">{location.pathname}</output>;
}

describe('+ Propose → Ask the Minter Admins', () => {
  it('is in Propose, with what it is, and opens its page', async () => {
    const u = user();
    await renderPage(
      <>
        <DecisionsPage />
        <Where />
      </>,
      { persona: 'admin', path: '/decisions', route: '*', setup: withAdminPolls('admin') }
    );
    await screen.findByRole('region', { name: /^Collecting approvals/ }, T);
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    const item = await screen.findByRole('menuitem', { name: /Ask the Minter Admins/ });
    expect(item).toHaveTextContent(
      'An advisory poll: Yes, No and Neutral, or answers of your own, encrypted to the Minter Admins.'
    );
    await u.click(item);
    await waitFor(() => expect(screen.getByTestId('at')).toHaveTextContent(PATHS.ask), T);
  });

  it('question, details and duration with its end; one encrypted publish; then what is next', async () => {
    const u = user();
    await openAsk();
    published();
    expect(screen.getByText(/Advisory: nothing changes on chain/)).toBeVisible();
    expect(await screen.findByText(/Encrypted to the 19 Minter Admins/, {}, T)).toBeVisible();
    const duration = screen.getByRole('combobox', { name: 'Voting stays open for' });
    expect(duration).toHaveValue('7');
    expect(within(duration).getAllByRole('option')).toHaveLength(30);
    expect(
      await screen.findByText(
        /^Voting ends about .*, at block 2,765,797 \(from the measured block time, 72\.9 s a block\)\.$/,
        {},
        T
      )
    ).toBeVisible();
    // The button says what's missing, and goes to it.
    await u.click(submit());
    expect(
      screen.getByText('Can’t ask yet: Write a question of at least 10 characters.')
    ).toBeVisible();
    const question = screen.getByRole('textbox', { name: 'Question' });
    expect(question).toHaveFocus();
    await u.type(question, 'Should we keep a shared minting checklist?');
    await u.type(screen.getByRole('textbox', { name: 'Details (optional)' }), 'For newcomers.');
    await u.selectOptions(duration, '3');
    expect(screen.getByText(/at block 2,761,056 /)).toBeVisible();
    await u.click(submit());

    const hub = await screen.findByRole('dialog', { name: ASK_TITLE }, T);
    expect(within(hub).getByText('Should we keep a shared minting checklist?')).toBeVisible();
    expect(within(hub).getByText('For newcomers.')).toBeVisible();
    expect(within(hub).getByText('Publish, encrypted to the 19 Minter Admins')).toBeVisible();
    expect(within(hub).getByText('The service is DOCUMENT_PRIVATE.')).toBeInTheDocument();
    expect(within(hub).getByText('The identifier starts with qmp-adminpoll-.')).toBeInTheDocument();
    expect(within(hub).getByText('It says isEncrypted: true.')).toBeInTheDocument();
    expect(within(hub).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    expect(publishes()).toHaveLength(0);
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Poll published', {}, T)).toBeVisible();
    expect(publishes()).toHaveLength(1);
    const call = publishes()[0];
    expect(call).toMatchObject({ service: 'DOCUMENT_PRIVATE', encrypt: true, name: 'Avery Admin' });
    expect((call.publicKeys as string[]).length).toBe(19);
    const identifier = String(call.identifier);
    expect(identifier).toMatch(/^qmp-adminpoll-[a-z0-9]{8}$/);
    expect(fromData64(String(call.data64))).toMatchObject({
      v: 1,
      question: 'Should we keep a shared minting checklist?',
      details: 'For newcomers.',
      durationDays: 3,
      endHeight: 2_761_056,
    });
    // Yes, No and Neutral as they come: no answers written.
    expect(fromData64(String(call.data64))).not.toHaveProperty('answers');

    // Done: the page says so, with the poll's own page.
    await u.click(within(hub).getByRole('button', { name: 'Done' }));
    const done = await screen.findByRole('heading', { level: 2, name: 'Poll published' }, T);
    await waitFor(() => expect(done).toHaveFocus(), T);
    expect(screen.getByRole('link', { name: 'Open the poll' })).toHaveAttribute(
      'href',
      `/decisions/polls/${identifier.replace('qmp-adminpoll-', '')}`
    );
    expect(screen.getByRole('link', { name: 'Open Decisions' })).toHaveAttribute(
      'href',
      '/decisions?show=askAdmins'
    );
    // Ask another: an empty form again.
    await u.click(screen.getByRole('button', { name: 'Ask another' }));
    expect(await screen.findByRole('textbox', { name: 'Question' }, T)).toHaveValue('');
  });

  it('answers of its own: renamed, coloured, one added, one removed', async () => {
    const u = user();
    await openAsk();
    published();
    await u.type(
      screen.getByRole('textbox', { name: 'Question' }),
      'When should we review the stale invites next?'
    );
    const answers = screen.getByRole('list', { name: 'Answers' });
    expect(
      within(answers)
        .getAllByRole('textbox')
        .map((box) => (box as HTMLInputElement).value)
    ).toEqual(['Yes', 'No', 'Neutral']);
    const first = screen.getByRole('textbox', { name: 'Answer 1' });
    await u.clear(first);
    await u.type(first, 'This week');
    await u.selectOptions(screen.getByRole('combobox', { name: 'Answer 3’s colour' }), 'red');
    await u.click(screen.getByRole('button', { name: 'Add an answer' }));
    await u.type(screen.getByRole('textbox', { name: 'Answer 4' }), 'Next month');
    await u.selectOptions(screen.getByRole('combobox', { name: 'Answer 4’s colour' }), 'green');
    await u.click(screen.getByRole('button', { name: 'Remove answer 2, No' }));
    // Two the same: the button says so.
    const third = screen.getByRole('textbox', { name: 'Answer 3' });
    await u.clear(third);
    await u.type(third, 'this WEEK');
    await u.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent('Give each answer different words.');
    await u.clear(third);
    await u.type(third, 'Next month');
    await u.clear(screen.getByRole('textbox', { name: 'Answer 2' }));
    await u.type(screen.getByRole('textbox', { name: 'Answer 2' }), 'Not at all');
    await u.click(submit());
    const hub = await screen.findByRole('dialog', { name: ASK_TITLE }, T);
    expect(
      within(within(hub).getByRole('list', { name: 'Its answers' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['This week', 'Not at all', 'Next month']);
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Poll published', {}, T)).toBeVisible();
    expect(fromData64(String(publishes()[0].data64))).toMatchObject({
      question: 'When should we review the stale invites next?',
      answers: [
        { id: 'yes', label: 'This week', tone: 'green' },
        { id: 'neutral', label: 'Not at all', tone: 'red' },
        { id: 'opt4', label: 'Next month', tone: 'green' },
      ],
    });
  });

  it('Back to the form keeps what was written; a decline sends nothing', async () => {
    const u = user();
    await openAsk();
    await u.type(
      screen.getByRole('textbox', { name: 'Question' }),
      'Should we meet in Q-Chat once a month?'
    );
    await u.click(submit());
    const hub = await screen.findByRole('dialog', { name: ASK_TITLE }, T);
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(hub).findByText(/Cancelled in Hub. Nothing was sent./, {}, T)
    ).toBeVisible();
    await u.click(within(hub).getByRole('button', { name: 'Back to the form' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), T);
    expect(screen.getByRole('textbox', { name: 'Question' })).toHaveValue(
      'Should we meet in Q-Chat once a month?'
    );
    expect(screen.queryByRole('heading', { level: 2, name: 'Poll published' })).toBeNull();
    expect(publishes()).toHaveLength(1);
  });

  it('the question wraps as it is written, and goes out on one line', async () => {
    const u = user();
    await openAsk();
    published();
    const question = screen.getByRole('textbox', { name: 'Question' });
    expect(question.tagName).toBe('TEXTAREA');
    await u.type(question, 'Should we meet{Enter}once a month in Q-Chat?');
    await u.click(submit());
    const hub = await screen.findByRole('dialog', { name: ASK_TITLE }, T);
    expect(within(hub).getByText('Should we meet once a month in Q-Chat?')).toBeVisible();
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Poll published', {}, T)).toBeVisible();
    expect(fromData64(String(publishes()[0].data64))).toMatchObject({
      question: 'Should we meet once a month in Q-Chat?',
    });
  });

  it('needs a registered name, and says so', async () => {
    await openAsk((world) => {
      withAdminPolls('admin')(world);
      world.accounts.get(ADDR.admin).name = null;
    });
    expect(await screen.findByText('Asking needs a registered name', {}, T)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Register a name' })).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Question' })).toBeNull();
    expect(screen.queryByRole('button', { name: ASK_TITLE })).toBeNull();
  });

  it('is for Minter Admins only', async () => {
    await renderPage(<AskPage />, {
      persona: 'nominator',
      path: PATHS.ask,
      route: PATHS.ask,
    });
    expect(await screen.findByText('Only Minter Admins ask here', {}, T)).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Question' })).toBeNull();
  });

  it('by keyboard: its Hub step, focus in, kept in, and back on the button on Escape', async () => {
    const u = user();
    await openAsk();
    await u.type(
      screen.getByRole('textbox', { name: 'Question' }),
      'Should we meet in Q-Chat once a month?'
    );
    await checkDialogByKeyboard(u, submit(), ASK_TITLE, {
      reach: ['Back to the form', 'Continue to Hub'],
    });
  });
});
