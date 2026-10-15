/**
 * The Minter Admins' answers on nomination cards, for everyone: Decisions
 * itself is only for the admins, so the columns show on Nominations too.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addConsidering, addRejections } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import NominationsPage from '../../pages/nominations/NominationsPage';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

/** A screen `width` px wide, for MUI's breakpoint queries. */
function screenWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const sizes = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)];
    const matches =
      sizes.length > 0 &&
      sizes.every(([, edge, value]) =>
        edge === 'min' ? width >= Number(value) : width <= Number(value)
      );
    return { ...originalMatchMedia(query), matches };
  }) as typeof window.matchMedia;
}

const T = { timeout: 4000 };

const card = (name: string) => screen.findByRole('article', { name: `Nomination of ${name}` }, T);

describe('the Minter Admins’ answers on nomination cards', () => {
  it('shows someone outside MINTER who approved, rejected and is considering, side by side', async () => {
    await renderPage(<NominationsPage />, {
      persona: 'newcomerName',
      path: '/nominations',
      route: '/nominations',
      setup: (world) => {
        addRejections(world);
        addConsidering(world);
      },
    });
    const bob = await card('bob+builder');
    const approved = await within(bob).findByRole(
      'list',
      { name: /^Approved by \d+ Minter Admins?$/ },
      T
    );
    // The same count as the ring, and an approval still on its way listed as confirming.
    const ring = within(bob).getByRole('img', { name: /approvals/ });
    const [, counted, coming] = /^(\d+) of \d+ approvals(?:, (\d+) confirming)?$/.exec(
      ring.getAttribute('aria-label') ?? ''
    ) ?? ['', '0', '0'];
    expect(approved).toHaveAccessibleName(`Approved by ${counted} Minter Admins`);
    expect(within(approved).getAllByRole('listitem')).toHaveLength(
      Number(counted) + Number(coming ?? 0)
    );
    expect(within(bob).getByRole('heading', { level: 3, name: /^Approved/ })).toBeVisible();
    expect(within(bob).getByRole('group', { name: /^Rejected/ })).toHaveTextContent('None yet');
    expect(
      within(bob).getByRole('list', { name: 'Considering: 2 Minter Admins' })
    ).toHaveTextContent(/Admin K.*Waiting to hear back.*Admin L/);
    // The columns replace the count line.
    expect(within(bob).queryByText(/Minter Admins? (is|are) considering/)).toBeNull();
  });

  it('a nomination waiting for its first approval shows who is considering it', async () => {
    await renderPage(<NominationsPage />, {
      persona: 'learner',
      path: '/nominations',
      route: '/nominations',
      setup: (world) => addConsidering(world),
    });
    const wren = await card('Wren Waiting');
    const considering = await within(wren).findByRole(
      'list',
      { name: 'Considering: 1 Minter Admin' },
      T
    );
    expect(considering).toHaveTextContent(/Admin M.*Checking their minting history first\./);
    expect(within(wren).getByRole('group', { name: /^Approved/ })).toHaveTextContent('None yet');
  });

  it('on a phone, each column shows three people, then Show all for everyone', async () => {
    const user = userEvent.setup();
    screenWidth(360);
    await renderPage(<NominationsPage />, {
      persona: 'learner',
      path: '/nominations',
      route: '/nominations',
    });
    const mia = await card('Mia Met');
    const approved = await within(mia).findByRole(
      'list',
      { name: 'Approved by 8 Minter Admins' },
      T
    );
    expect(within(approved).getAllByRole('listitem')).toHaveLength(3);
    expect(within(mia).getByText('+5 more')).toBeVisible();
    const more = within(mia).getByRole('button', {
      name: 'Show all: the Minter Admins’ answers on Mia Met',
    });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(within(approved).getAllByRole('listitem')).toHaveLength(8);
    expect(within(mia).queryByText('+5 more')).toBeNull();
    expect(
      within(mia).getByRole('button', { name: 'Show fewer: the Minter Admins’ answers on Mia Met' })
    ).toHaveAttribute('aria-expanded', 'true');
    // A column of three or fewer needs no button.
    const eli = await card('Eli Early');
    expect(within(eli).queryByRole('button', { name: /^Show all/ })).toBeNull();
  });

  it('on a wider screen, everyone shows at once', async () => {
    screenWidth(1280);
    await renderPage(<NominationsPage />, {
      persona: 'learner',
      path: '/nominations',
      route: '/nominations',
    });
    const mia = await card('Mia Met');
    const approved = await within(mia).findByRole(
      'list',
      { name: 'Approved by 8 Minter Admins' },
      T
    );
    expect(within(approved).getAllByRole('listitem')).toHaveLength(8);
    expect(within(mia).queryByRole('button', { name: /^Show all/ })).toBeNull();
  });

  it('shows nothing extra while nobody has answered or is considering', async () => {
    await renderPage(<NominationsPage />, {
      persona: 'learner',
      path: '/nominations',
      route: '/nominations',
    });
    const wren = await card('Wren Waiting');
    // Give the shared Considering read time to arrive: still nothing.
    await within(wren).findByRole('button', { name: /^Comments/ }, T);
    expect(within(wren).queryByRole('group', { name: /^Approved/ })).toBeNull();
  });
});
