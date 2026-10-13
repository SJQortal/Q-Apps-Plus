import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { ADDR } from '../../test/world';
import { useChainNow, useNominations } from '../../hooks/useData';
import { AvatarStack } from '../common/Person';
import { NominationCard } from './NominationCard';

/** Mia Met's chain-only nomination, as if no record or member list had her name. */
function NamelessCard() {
  const { data } = useNominations();
  const now = useChainNow();
  const met = data?.all.find((n) => n.nominee === ADDR.met);
  if (!met || !now.data) return null;
  return <NominationCard nomination={{ ...met, nomineeName: null }} now={now.data} />;
}

describe('NominationCard', () => {
  it("looks up a chain-only nominee's name instead of showing the address", async () => {
    await renderPage(<NamelessCard />, { persona: 'admin', path: '/' });
    const card = await screen.findByRole(
      'article',
      { name: 'Nomination of Mia Met' },
      { timeout: 4000 }
    );
    expect(within(card).getByRole('link', { name: 'Mia Met: open their page' })).toBeVisible();
  });

  it('copies a link to the nomination’s own page, and says so', async () => {
    await renderPage(<NamelessCard />, { persona: 'admin', path: '/' });
    const card = await screen.findByRole(
      'article',
      { name: 'Nomination of Mia Met' },
      { timeout: 4000 }
    );
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await userEvent.click(
      within(card).getByRole('button', { name: 'Copy link to the nomination of Mia Met' })
    );
    expect(writeText).toHaveBeenCalledWith(`qortal://APP/Q-Mintership+/nominations/${ADDR.met}`);
    expect(await within(card).findByText('Link copied')).toBeVisible();
  });
});

describe('AvatarStack', () => {
  it('puts list semantics on the items and keeps the avatars as named links', async () => {
    await renderPage(
      <AvatarStack
        label="Signed by"
        max={2}
        people={[
          { address: ADDR.admin, name: 'Ada Admin' },
          { address: ADDR.nominator, name: 'Nora Nominator' },
          { address: ADDR.learner, name: 'Juniper L4' },
        ]}
      />,
      { persona: 'admin', path: '/' }
    );
    const list = screen.getByRole('list', { name: 'Signed by' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByRole('link', { name: 'Ada Admin' })).toBeInTheDocument();
    expect(items[2]).toHaveTextContent('+1');
    expect(
      within(list)
        .getAllByRole('link')
        .every((a) => a.getAttribute('role') === null)
    ).toBe(true);
  });

  it('shows the names under the avatars for phones, and gives each a 44 px target', async () => {
    await renderPage(
      <AvatarStack
        label="Signed by"
        max={2}
        showNames
        people={[
          { address: ADDR.admin, name: 'Ada Admin' },
          { address: ADDR.nominator, name: 'Nora Nominator' },
          { address: ADDR.learner, name: 'Juniper L4' },
        ]}
      />,
      { persona: 'admin', path: '/' }
    );
    expect(
      screen.getByText(
        (_, el) => el?.tagName === 'P' && el.textContent === 'Ada Admin, Nora Nominator and 1 more'
      )
    ).toBeVisible();
    const link = screen.getByRole('link', { name: 'Ada Admin' });
    expect(getComputedStyle(link).minWidth).toBe('44px');
    expect(getComputedStyle(link).minHeight).toBe('44px');
  });
});
