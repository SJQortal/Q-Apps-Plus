/**
 * The Connections circle's words around the drawing (Hub's Explorer port,
 * 2026-11-22): a search typed, links with no one other account, many other
 * links, and a legend with nothing drawn.
 */
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeAddress } from '../../../../../e2e/world.mjs';
import type { TxRow } from '../../../../data/types';
import type { Finding } from '../../../../rules/explorer/findings';
import { renderPage } from '../../../../test/render';
import { ADDR } from '../../../../test/world';
import { ConnectionsCircle } from './ConnectionsCircle';

const T = { timeout: 4000 };

const finding = (kind: Finding['kind'], other: string | null, i: number): Finding =>
  ({
    key: `${kind}:${other ?? i}`,
    kind,
    other,
    parts: [{ kind: 'text', text: `Finding ${i}.` }],
    height: 1,
    timestamp: 1,
    signature: `s${i}`,
    evidence: [{ signature: `sig${i}`, blockHeight: i, timestamp: i } as TxRow],
    evidenceWords: '',
  }) as Finding;

function show(recorded: Finding[], searching = false) {
  return renderPage(
    <ConnectionsCircle
      address={ADDR.admin}
      recorded={recorded}
      order="count"
      onOrder={() => undefined}
      searching={searching}
    />,
    { persona: 'admin' }
  );
}

describe('the Connections circle', () => {
  it('with a search that finds nothing, never says no account is linked', async () => {
    await show([], true);
    expect(
      await screen.findByText('None of its linked accounts matches the search.', {}, T)
    ).toBeVisible();
    expect(screen.queryByText(/nothing to draw/)).toBeNull();
  });

  it('says a search narrows what it draws', async () => {
    await show([finding('paidBy', fakeAddress('circle-a'), 1)], true);
    expect(
      await screen.findByText('Only the 1 linked account that matches the search.', {}, T)
    ).toBeVisible();
  });

  it('lists links with no one other account under it', async () => {
    await show([finding('paidBy', fakeAddress('circle-a'), 1), finding('sponsees', null, 2)]);
    const also = await screen.findByRole('list', { name: 'Also recorded' }, T);
    expect(also).toHaveTextContent('Finding 2.');
  });

  it('shows 20 other links, then the rest on Show all; with only those, the legend says how to open them', async () => {
    const user = userEvent.setup();
    await show(
      Array.from({ length: 25 }, (_, i) => finding('sponsor', fakeAddress(`circle-o${i}`), i))
    );
    const others = await screen.findByRole('list', { name: 'Other links' }, T);
    expect(within(others).getAllByRole('listitem')).toHaveLength(20);
    expect(screen.getByText('Press one for its transactions.')).toBeVisible();
    expect(screen.queryByText(/The bigger the avatar/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show all 25' }));
    expect(within(others).getAllByRole('listitem')).toHaveLength(25);
  });
});
