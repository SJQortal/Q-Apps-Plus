/**
 * Connections' "In Q-Mintership" (MintershipLinks.tsx) in the mock world,
 * strict: who nominated, supported and voted on an account, and whom it
 * nominated, each other account once with a link into the Explorer and a
 * Compare button; nothing at all when there are none. Read-only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addCommunityVotes, answerCore } from '../../../../e2e/world.mjs';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../../components/common/personLinks';
import { renderPage, type RenderPageOptions } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { mockFetchRoute, qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { explorerAccountPath, explorerComparePath } from '../../../routes/paths';
import { MintershipLinks } from './MintershipLinks';
import { addRecord } from './mintership/testWorld';
import { useMintershipLinks } from './mintership/useMintershipLinks';

const T = { timeout: 6000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;

afterEach(() => vi.useRealTimers());

/** What the hook says, for the Connections tab's "Also checked" line. */
function Probe({ address }: { address: string }) {
  const { links, failed } = useMintershipLinks(address);
  return (
    <output data-testid="probe">
      {links === null ? 'reading' : `${links.length} links${failed ? ', failed' : ''}`}
    </output>
  );
}

function open(address: string, setup?: RenderPageOptions['setup']) {
  return renderPage(
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <MintershipLinks address={address} />
      <Probe address={address} />
    </PersonLinkContext>,
    { persona: 'learner', path: '/links', strict: true, setup }
  );
}

const group = (name: string) => screen.getByRole('list', { name });

describe('In Q-Mintership (Connections)', () => {
  it('lists who nominated, supported and voted on a nomination, each account once', async () => {
    const { container, posts } = await open(ADDR.nominatedWaiting, (world) => {
      addCommunityVotes(world);
      // Nora Nominator supports it too, under her second name: still one account.
      addRecord(world, 'Spare Room', `qmp-support-${ADDR.nominatedWaiting}`, {
        nomineeAddress: ADDR.nominatedWaiting,
      });
    });
    const section = await screen.findByRole('region', { name: 'In Q-Mintership' }, T);
    const nominated = group('Nominated this account');
    const nora = within(nominated).getByRole('listitem');
    expect(
      within(nora).getByRole('link', { name: 'Nora Nominator: explore this account' })
    ).toHaveAttribute('href', explorerAccountPath(ADDR.nominator));
    expect(nora).toHaveTextContent(/under 2 names$/);
    expect(within(nora).getByRole('link', { name: 'Compare with Nora Nominator' })).toHaveAttribute(
      'href',
      explorerComparePath([ADDR.nominatedWaiting, ADDR.nominator])
    );
    // Juniper supports it; Leo's support doesn't count (not able to nominate), as on its page.
    const supporters = within(group('Supported this account’s nomination')).getAllByRole(
      'listitem'
    );
    expect(supporters.map((li) => li.textContent)).toEqual([expect.stringMatching(/Juniper L4/)]);
    // Each voter's newest vote; the nominee's own isn't a link to someone else.
    const voters = within(group('Voted on this account’s nomination')).getAllByRole('listitem');
    const leo = voters.find((li) => /Leo Learner/.test(li.textContent ?? ''));
    expect(leo).toHaveTextContent('Voted No (newest of 2 votes)');
    expect(voters.some((li) => /Wren Waiting/.test(li.textContent ?? ''))).toBe(false);
    expect(within(section).queryByText(/approv|invite|answer/i)).toBeNull();
    expect(screen.getByTestId('probe')).toHaveTextContent(/^\d+ links$/);
    await expectNoAxeViolations(container);
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('lists whom an account nominated', async () => {
    await open(ADDR.nominator);
    await screen.findByRole('region', { name: 'In Q-Mintership' }, T);
    const nominated = within(group('Nominated by this account')).getAllByRole('listitem');
    expect(nominated).toHaveLength(5);
    expect(
      within(nominated[0]).getByRole('link', { name: 'Compare with Wren Waiting' })
    ).toHaveAttribute('href', explorerComparePath([ADDR.nominator, ADDR.nominatedWaiting]));
  });

  it('says when a read failed, with Retry, instead of showing nothing', async () => {
    let fail = true;
    const { posts } = await open(ADDR.liftBan, (world) =>
      mockFetchRoute('/groups/694', (url: URL) =>
        fail && url.pathname === '/groups/694'
          ? new Response('{"error":5,"message":"repository issue"}', { status: 500 })
          : answerCore(world, url.pathname, url.searchParams)?.body
      )
    );
    const user = userEvent.setup();
    const section = await screen.findByRole('region', { name: 'In Q-Mintership' }, T);
    expect(
      within(section).getByText(/^Couldn’t read all of its Q-Mintership records\./)
    ).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('0 links, failed');
    fail = false;
    await user.click(within(section).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent(/^0 links$/), T);
    expect(screen.queryByRole('region', { name: 'In Q-Mintership' })).toBeNull();
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('shows nothing when there are none, and tells the Connections tab so', async () => {
    await open(ADDR.liftBan);
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('0 links'), T);
    expect(screen.queryByRole('region', { name: 'In Q-Mintership' })).toBeNull();
  });
});
