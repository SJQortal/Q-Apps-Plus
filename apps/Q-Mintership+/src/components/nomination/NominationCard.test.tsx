import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
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
});
