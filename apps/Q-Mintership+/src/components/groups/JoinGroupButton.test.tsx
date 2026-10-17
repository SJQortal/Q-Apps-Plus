/**
 * Join on the Explorer's group cards (Simon, 2026-10-17): only on groups the
 * signed-in account isn't in, never on MINTER; an open group is joined, a
 * closed one asked; checked against the chain before Hub opens.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR } from '../../test/world';
import { explorerAccountPath } from '../../routes/paths';
import { resetExplorerState } from '../../state/explorer';
import AccountPage from '../../pages/explorer/AccountPage';

vi.setConfig({ testTimeout: 30_000 });
const T = { timeout: 6000 };

afterEach(() => resetExplorerState());

async function groupsOf(address: string, persona: string) {
  await renderPage(<AccountPage />, {
    persona,
    path: explorerAccountPath(address),
    route: '/explorer/account/:who/:tab?',
  });
  return screen.findByRole('list', { name: 'Its groups' }, T);
}

const card = (list: HTMLElement, name: string) =>
  within(list)
    .getAllByRole('listitem')
    .find((li) => li.textContent?.includes(name)) as HTMLElement;

describe('Join on a group card', () => {
  it('joins an open group the viewer isn’t in, after saying what Hub will ask', async () => {
    const user = userEvent.setup();
    const list = await groupsOf(ADDR.admin, 'learner');
    const join = await within(list).findByRole('button', { name: 'Join Qortal General' }, T);
    expect(within(list).getByRole('button', { name: 'Join Q-Mintership Helpers' })).toBeVisible();
    // Never on MINTER: it has its own way in.
    expect(within(card(list, 'MINTER')).queryByRole('button', { name: /join/i })).toBeNull();
    mockQortalRequest('JOIN_GROUP', () => ({
      type: 'JOIN_GROUP',
      signature: 'testJoinGroupSignature1111111111111111111111111111111111111111111',
      timestamp: Date.now(),
      groupId: 1,
    }));
    await user.click(join);
    const dialog = await screen.findByRole('dialog', { name: 'Join Qortal General' });
    expect(within(dialog).getByText(/Qortal General is an open group/)).toBeVisible();
    expect(within(dialog).getByText('The group is Qortal General.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Joined', {}, T)).toBeInTheDocument();
    expect(qortalCallsFor('JOIN_GROUP')).toEqual([{ action: 'JOIN_GROUP', groupId: 1 }]);
  });

  it('asks to join a closed group, and stops before Hub when a request is already in', async () => {
    const user = userEvent.setup();
    const list = await groupsOf(ADDR.kicked, 'learner');
    const ask = await within(list).findByRole('button', { name: 'Ask to join Book Club' }, T);
    await user.click(ask);
    const dialog = await screen.findByRole('dialog', { name: 'Ask to join Book Club' });
    expect(within(dialog).getByText(/Book Club is a closed group/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText(/Your join request is already in/, {}, T)
    ).toBeInTheDocument();
    expect(qortalCallsFor('JOIN_GROUP')).toEqual([]);
  });

  it('offers nothing on the viewer’s own groups', async () => {
    const list = await groupsOf(ADDR.admin, 'admin');
    await within(list).findByText('Qortal General', {}, T);
    expect(within(list).queryByRole('button', { name: /join/i })).toBeNull();
  });
});
