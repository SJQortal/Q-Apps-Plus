/**
 * A nomination whose text the node doesn't give (Simon, 2026-11-25: Minter
 * Admins who block a nominator never saw that nominator's nomination): it still
 * shows who nominated whom and when, with a note in place of its reason
 * saying why.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderPage } from '../../test/render';
import { mockFetchRoute } from '../../test/setup';
import { ADDR, PEOPLE } from '../../test/world';
import NominationPage from '../../pages/nominations/NominationPage';
import DecisionsPage from '../../pages/decisions/DecisionsPage';

vi.setConfig({ testTimeout: 30_000 });
afterEach(() => vi.useRealTimers());

const T = { timeout: 4000 };
const NOMINATOR = PEOPLE.nominator.name ?? 'nominator';
/** The mock world's reasons start this way. */
const REASON = /I've worked with/;
const BLOCKED_NOTE = `${NOMINATOR} is blocked on your node, so your node doesn’t fetch the text of this nomination. To read it, unblock ${NOMINATOR} in Hub’s Blocked users.`;

/** The node lists the nominator's record about `nominee`, gives no body, and says `status`. */
function notGiven(nominee: string, status: string) {
  const path = `${encodeURIComponent(NOMINATOR)}/qmp-nomination-${nominee}`;
  mockFetchRoute(
    `/arbitrary/JSON/${path}`,
    () => new Response('{"error":1,"message":"data unavailable"}', { status: 404 })
  );
  mockFetchRoute(`/arbitrary/resource/status/JSON/${path}`, { status, id: status });
}

function openNomination(nominee: string, status: string) {
  return renderPage(<NominationPage />, {
    persona: 'admin',
    path: `/nominations/${nominee}`,
    route: '/nominations/:address',
    setup: () => notGiven(nominee, status),
  });
}

describe('A nomination whose text the node doesn’t give', () => {
  it('its page names its nominator, and says the node blocks them', async () => {
    await openNomination(ADDR.nominatedWaiting, 'BLOCKED');
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(await within(current).findByText(/Nominated by/, {}, T)).toBeInTheDocument();
    const note = within(current).getByText(/is blocked on your node/).closest('[role="note"]');
    expect(note).toHaveTextContent(BLOCKED_NOTE);
    expect(within(current).queryByText(REASON)).toBeNull();
  });

  it('one not on the node yet says its text comes when it arrives', async () => {
    await openNomination(ADDR.nominatedWaiting, 'MISSING_DATA');
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(await within(current).findByText(/Nominated by/, {}, T)).toBeInTheDocument();
    expect(
      within(current).getByText(
        'The text of this nomination isn’t on your node yet. It shows here when it arrives.'
      )
    ).toBeInTheDocument();
    expect(within(current).queryByText(/is blocked on your node/)).toBeNull();
  });

  it('a Minter Admin’s Decisions: the invite it led to still names its nominator', async () => {
    await renderPage(<DecisionsPage />, {
      persona: 'admin',
      path: '/decisions?show=decisions',
      route: '/decisions',
      setup: () => notGiven(ADDR.nominatedSigning, 'BLOCKED'),
    });
    const signing = await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ }, T);
    expect(await within(signing).findByText(/Nominated by/, {}, T)).toBeInTheDocument();
    const note = within(signing).getByText(/is blocked on your node/).closest('[role="note"]');
    expect(note).toHaveTextContent(BLOCKED_NOTE);
    expect(within(signing).queryByText(REASON)).toBeNull();
  });
});
