/**
 * A kick of someone who asked to join and isn't a member declines their
 * join request: titled "Decline a join request" on its card, in Sign
 * several and on its own page, waiting or decided (rules/decline.ts).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { DECLINED, addDecline, fakeAddress, type World } from '../../../e2e/world.mjs';
import { shortAddress } from '../../utils/format';
import DecisionPage from './DecisionPage';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const T = { timeout: 4000 };
const jr2 = shortAddress(fakeAddress('jr-2'));

function openDecision(pick: (made: ReturnType<typeof addDecline>) => string) {
  let path = '';
  return renderPage(<DecisionPage />, {
    persona: 'admin',
    route: '/decisions/:signature',
    get path() {
      return path;
    },
    setup: (world: World) => {
      path = `/decisions/${pick(addDecline(world))}`;
    },
  });
}

describe('Declines in Decisions', () => {
  it('titles a waiting decline on its card and in Sign several; a member’s removal keeps its title', async () => {
    const user = userEvent.setup();
    await renderPage(<DecisionsPage />, {
      persona: 'admin',
      path: '/decisions',
      route: '/decisions',
      setup: (world) => void addDecline(world),
    });
    const card = await screen.findByRole('article', { name: `Decline a join request, ${jr2}` }, T);
    expect(within(card).getByText('Asked to join, but no node online for months')).toBeVisible();
    expect(
      within(card).getByRole('button', { name: /^Sign: Decline a join request/ })
    ).toBeVisible();
    expect(
      screen.getByRole('article', { name: 'Remove from MINTER, Kai Target' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign several' }));
    await user.click(
      screen.getByRole('checkbox', { name: `Select to sign: Decline a join request, ${jr2}` })
    );
    await user.click(screen.getByRole('button', { name: 'Sign 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign several' });
    expect(dialog).toHaveTextContent(`Decline a join request: ${jr2}`);
  }, 20_000);

  it('its own page says so while it waits', async () => {
    await openDecision((made) => made.waiting.signature);
    expect(
      await screen.findByRole('article', { name: `Decline a join request, ${jr2}` }, T)
    ).toBeInTheDocument();
    expect(await screen.findByText(`Decline a join request: ${jr2}`, {}, T)).toBeInTheDocument();
  });

  it('and once it was approved', async () => {
    await openDecision((made) => made.declined.kick);
    expect(
      await screen.findByText(`Decline a join request: ${DECLINED.name}`, {}, T)
    ).toBeInTheDocument();
    const card = await screen.findByRole('article', { name: /^Decline a join request/ }, T);
    expect(within(card).getByText('Approved')).toBeVisible();
    expect(screen.queryByText(/Remove from MINTER/)).toBeNull();
  });
});
