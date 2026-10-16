import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderPage } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../../components/common/personLinks';
import { explorerAccountPath } from '../../../routes/paths';
import { DirectLinksPreview } from './DirectLinksPreview';

const T = { timeout: 5000 };

async function open(address: string) {
  return renderPage(
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <DirectLinksPreview address={address} />
    </PersonLinkContext>,
    {
      persona: 'learner',
      path: explorerAccountPath(address),
      route: '/explorer/account/:who/:tab?',
      strict: true,
    }
  );
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
});
