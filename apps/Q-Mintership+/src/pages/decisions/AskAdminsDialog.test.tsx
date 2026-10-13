import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromData64 } from '../../data/adminPollRecords';
import { resetPendingPollWrites } from '../../state/adminPolls';
import { withAdminPolls } from '../../test/adminPolls';
import { checkDialogByKeyboard } from '../../test/keyboard';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR } from '../../test/world';
import DecisionsPage from './DecisionsPage';

beforeEach(() => resetPendingPollWrites());
afterEach(() => vi.useRealTimers());
vi.setConfig({ testTimeout: 30_000 });

const user = () => userEvent.setup();
const T = { timeout: 6000 };

async function openDecisions(setup: RenderPageOptions['setup'] = withAdminPolls('admin')) {
  const rendered = await renderPage(<DecisionsPage />, {
    persona: 'admin',
    path: '/decisions',
    route: '/decisions',
    setup,
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ }, T);
  return rendered;
}

async function openAsk(u: ReturnType<typeof user>) {
  await u.click(screen.getByRole('button', { name: 'Propose' }));
  await u.click(await screen.findByRole('menuitem', { name: /Ask the Minter Admins/ }));
  return screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
}

const publishes = () => qortalCallsFor('PUBLISH_QDN_RESOURCE');

describe('Propose → Ask the Minter Admins', () => {
  it('is in Propose, with what it is', async () => {
    const u = user();
    await openDecisions();
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    const item = await screen.findByRole('menuitem', { name: /Ask the Minter Admins/ });
    expect(item).toHaveTextContent(
      'An advisory poll: Yes, No or Neutral, encrypted to the Minter Admins.'
    );
  });

  it('question, details and duration with its end; Review; one encrypted publish', async () => {
    const u = user();
    await openDecisions();
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (request: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'S1',
      identifier: request.identifier,
    }));
    const form = await openAsk(u);
    expect(within(form).getByText(/Advisory: nothing changes on chain/)).toBeVisible();
    expect(within(form).getByText(/Encrypted to the 19 Minter Admins/)).toBeVisible();
    const duration = within(form).getByRole('combobox', { name: 'Voting stays open for' });
    expect(duration).toHaveValue('7');
    expect(within(duration).getAllByRole('option')).toHaveLength(30);
    expect(
      within(form).getByText(
        /^Voting ends about .*, at block 2,765,797 \(from the measured block time, 72\.9 s a block\)\.$/
      )
    ).toBeVisible();
    // Review says what's missing, and goes to it.
    await u.click(within(form).getByRole('button', { name: 'Review' }));
    expect(within(form).getByText('Write a question of at least 10 characters.')).toBeVisible();
    const question = within(form).getByRole('textbox', { name: 'Question' });
    expect(question).toHaveFocus();
    await u.type(question, 'Should we keep a shared minting checklist?');
    await u.type(
      within(form).getByRole('textbox', { name: 'Details (optional)' }),
      'For newcomers.'
    );
    await u.selectOptions(duration, '3');
    expect(within(form).getByText(/at block 2,761,056 /)).toBeVisible();
    await u.click(within(form).getByRole('button', { name: 'Review' }));

    const hub = await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
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
    expect(call).toMatchObject({
      service: 'DOCUMENT_PRIVATE',
      encrypt: true,
      name: 'Avery Admin',
    });
    expect((call.publicKeys as string[]).length).toBe(19);
    expect(String(call.identifier)).toMatch(/^qmp-adminpoll-[a-z0-9]{8}$/);
    expect(fromData64(String(call.data64))).toMatchObject({
      v: 1,
      question: 'Should we keep a shared minting checklist?',
      details: 'For newcomers.',
      durationDays: 3,
      endHeight: 2_761_056,
    });
    await u.click(within(hub).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Propose' })).toHaveFocus(), T);
  });

  it('Back to the form keeps what was written; a decline sends nothing', async () => {
    const u = user();
    await openDecisions();
    const form = await openAsk(u);
    await u.type(
      within(form).getByRole('textbox', { name: 'Question' }),
      'Should we meet in Q-Chat once a month?'
    );
    await u.click(within(form).getByRole('button', { name: 'Review' }));
    const hub = await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(hub).findByText(/Cancelled in Hub. Nothing was sent./, {}, T)
    ).toBeVisible();
    await u.click(within(hub).getByRole('button', { name: 'Back to the form' }));
    // The form again (both steps share the title), with the question as it was.
    expect(await screen.findByRole('textbox', { name: 'Question' }, T)).toHaveValue(
      'Should we meet in Q-Chat once a month?'
    );
    expect(publishes()).toHaveLength(1);
  });

  it('needs a registered name, and says so', async () => {
    const u = user();
    await openDecisions((world) => {
      withAdminPolls('admin')(world);
      world.accounts.get(ADDR.admin).name = null;
    });
    const form = await openAsk(u);
    expect(within(form).getByText('Asking needs a registered name')).toBeVisible();
    expect(within(form).getByRole('button', { name: 'Register a name' })).toBeVisible();
    expect(within(form).getByRole('button', { name: 'Review' })).toBeDisabled();
    expect(within(form).queryByRole('textbox', { name: 'Question' })).toBeNull();
  });

  it('by keyboard: focus in, kept in, back to Propose on Escape', async () => {
    const u = user();
    await openDecisions();
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    const item = await screen.findByRole('menuitem', { name: /Ask the Minter Admins/ });
    await u.click(item);
    const form = await screen.findByRole('dialog', { name: 'Ask the Minter Admins' }, T);
    await u.keyboard('{Escape}');
    await waitFor(() => expect(form).not.toBeInTheDocument(), T);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Propose' })).toHaveFocus(), T);
    // Opened again from the menu by keyboard.
    screen.getByRole('button', { name: 'Propose' }).focus();
    await u.keyboard('{Enter}');
    const again = await screen.findByRole('menuitem', { name: /Ask the Minter Admins/ });
    await checkDialogByKeyboard(u, again, 'Ask the Minter Admins', {
      reach: ['Cancel', 'Review'],
      back: () => screen.getByRole('button', { name: 'Propose' }),
    });
  });
});
