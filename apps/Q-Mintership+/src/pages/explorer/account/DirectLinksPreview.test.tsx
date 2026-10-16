import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { mockFetchRoute, qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { answerCore, type World } from '../../../../e2e/world.mjs';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../../components/common/personLinks';
import { explorerAccountPath } from '../../../routes/paths';
import { DirectLinksPreview } from './DirectLinksPreview';

const T = { timeout: 5000 };

async function open(address: string, setup?: (world: World) => void) {
  return renderPage(
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <DirectLinksPreview address={address} />
    </PersonLinkContext>,
    {
      persona: 'learner',
      path: explorerAccountPath(address),
      route: '/explorer/account/:who/:tab?',
      strict: true,
      setup,
    }
  );
}

/** A Core error for the reads `fails` picks; the world's answer for the rest. */
function failing(world: World, fails: (url: URL) => boolean) {
  return (url: URL) =>
    fails(url)
      ? new Response('{"error":5,"message":"repository issue"}', { status: 500 })
      : answerCore(world, url.pathname, url.searchParams)?.body;
}

afterEach(() => vi.useRealTimers());

describe('Overview: Direct links', () => {
  it('shows the first three links recorded, and All connections', async () => {
    const { container, posts } = await open(ADDR.left);
    const section = await screen.findByRole('region', { name: 'Direct links' }, T);
    const list = await within(section).findByRole('list', { name: 'Direct links' }, T);
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3), T);
    const lines = within(list).getAllByRole('listitem');
    await waitFor(
      () => expect(lines[0]).toHaveTextContent(/Received 120 QORT from K?Kit Kicked/),
      T
    );
    expect(lines[1]).toHaveTextContent(/Paid K?Kit Kicked 6\.3 QORT/);
    // People in the lines open their accounts in the Explorer.
    expect(
      within(lines[0]).getByRole('link', { name: 'Kit Kicked: explore this account' })
    ).toHaveAttribute('href', explorerAccountPath(ADDR.kicked));
    const all = within(section).getByRole('link', { name: 'All connections (3)' });
    expect(all).toHaveAttribute('href', explorerAccountPath(ADDR.left, 'connections'));
    await expectNoAxeViolations(container);
    expect(posts).toEqual([]);
    expect(
      qortalCalls.filter((c) => /INVITE|KICK|BAN|JOIN|SIGN|PUBLISH/.test(String(c.action)))
    ).toEqual([]);
  });

  it('a level move comes first', async () => {
    await open(ADDR.kickTarget);
    const list = await screen.findByRole('list', { name: 'Direct links' }, T);
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2), T);
    await waitFor(
      () =>
        expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
          /Got its minting level from O?Olga Old/
        ),
      T
    );
    expect(screen.getByRole('link', { name: 'All connections (2)' })).toBeInTheDocument();
  });

  it('says so in one line when there are none', async () => {
    await open(ADDR.newcomer);
    expect(
      await screen.findByText('No direct links found in the data checked.', {}, T)
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /All connections/ })).toBeNull();
  });

  it('a read that failed is named with Retry, never counted as no links', async () => {
    let fail = true;
    const { posts } = await open(ADDR.newcomer, (world) =>
      mockFetchRoute(
        '/transactions/payments/between',
        failing(world, (url) => fail && url.searchParams.get('senderAddress') === ADDR.newcomer)
      )
    );
    const user = userEvent.setup();
    const section = await screen.findByRole('region', { name: 'Direct links' }, T);
    expect(
      await within(section).findByText(/^Couldn’t read its payments sent\./, {}, T)
    ).toBeInTheDocument();
    expect(within(section).queryByText('No direct links found in the data checked.')).toBeNull();
    // Connections says which part is missing, one tap away.
    expect(within(section).getByRole('link', { name: 'All connections' })).toHaveAttribute(
      'href',
      explorerAccountPath(ADDR.newcomer, 'connections')
    );
    fail = false;
    await user.click(within(section).getByRole('button', { name: 'Retry' }));
    expect(
      await within(section).findByText('No direct links found in the data checked.', {}, T)
    ).toBeInTheDocument();
    expect(within(section).queryByText(/^Couldn’t read/)).toBeNull();
    expect(posts).toEqual([]);
  });

  it('with links found, a failed asset read keeps the count open and says what is missing', async () => {
    await open(ADDR.left, (world) =>
      mockFetchRoute(
        '/transactions/search',
        failing(world, (url) => url.searchParams.getAll('txType').includes('TRANSFER_ASSET'))
      )
    );
    const section = await screen.findByRole('region', { name: 'Direct links' }, T);
    expect(
      await within(section).findByText(
        /^Couldn’t read its asset transfers and multi-payments\./,
        {},
        T
      )
    ).toBeInTheDocument();
    expect(within(section).getAllByRole('listitem')).toHaveLength(3);
    expect(within(section).getByRole('link', { name: 'All connections (3+)' })).toBeInTheDocument();
  });
});
