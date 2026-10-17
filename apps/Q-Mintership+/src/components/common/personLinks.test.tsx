/**
 * Where people link: their page everywhere, their account inside the
 * Explorer (with state that says the link came from the Explorer), and a
 * reused list such as History's timeline follows the page it is on.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { TimelineList } from '../../pages/history/parts/TimelineList';
import type { TimelineEvent } from '../../data/timeline';
import type { TxRow } from '../../data/types';
import { AvatarStack, PersonChip, PersonInline } from './Person';
import {
  DEFAULT_PERSON_LINKS,
  EXPLORER_PERSON_LINKS,
  PersonLinkContext,
  type PersonLinks,
} from './personLinks';

const ADA = 'QaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaB';
const BOB = 'QbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbC';

/** Where a link went, and the state it carried. */
function Landed() {
  const location = useLocation();
  return (
    <p data-testid="landed">
      {location.pathname} {JSON.stringify(location.state ?? null)}
    </p>
  );
}

function show(ui: React.ReactNode, links?: PersonLinks) {
  const page = links ? <PersonLinkContext value={links}>{ui}</PersonLinkContext> : ui;
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route path="/start" element={page} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </HubThemeProvider>
  );
}

describe('person links outside the Explorer', () => {
  it('open the person’s page: their Minter Profile, in the Explorer', async () => {
    show(
      <>
        <PersonChip address={ADA} name="Ada" />
        <PersonInline address={BOB} name="Bob" />
      </>
    );
    expect(screen.getByRole('link', { name: 'Ada: open their page' })).toHaveAttribute(
      'href',
      `/explorer/account/${ADA}/mintership`
    );
    await userEvent.click(screen.getByRole('link', { name: 'Bob: open their page' }));
    expect(screen.getByTestId('landed')).toHaveTextContent(
      `/explorer/account/${BOB}/mintership null`
    );
  });

  it('the default is the person’s Minter Profile', () => {
    expect(DEFAULT_PERSON_LINKS.to(ADA)).toBe(`/explorer/account/${ADA}/mintership`);
    expect(DEFAULT_PERSON_LINKS.verb).toBe('open their page');
  });

  it('an avatar stack names each person and what the link does', () => {
    show(
      <AvatarStack
        label="Signed by"
        people={[
          { address: ADA, name: 'Ada' },
          { address: BOB, name: 'Bob' },
        ]}
      />
    );
    expect(screen.getByRole('link', { name: 'Ada: open their page' })).toHaveAttribute(
      'href',
      `/explorer/account/${ADA}/mintership`
    );
    expect(screen.getByRole('link', { name: 'Bob: open their page' })).toBeInTheDocument();
  });
});

describe('person links inside the Explorer', () => {
  it('open the account in the Explorer, saying the link came from there', async () => {
    show(
      <>
        <PersonChip address={ADA} name="Ada" />
        <p>
          Paid by <PersonInline address={BOB} name="Bob" />
        </p>
      </>,
      EXPLORER_PERSON_LINKS
    );
    expect(screen.getByRole('link', { name: 'Ada: explore this account' })).toHaveAttribute(
      'href',
      `/explorer/account/${ADA}`
    );
    await userEvent.click(screen.getByRole('link', { name: 'Bob: explore this account' }));
    expect(screen.getByTestId('landed')).toHaveTextContent(
      `/explorer/account/${BOB} {"via":"explorer"}`
    );
  });

  it('avatar stacks follow too', async () => {
    show(
      <AvatarStack label="Admins" people={[{ address: ADA, name: 'Ada' }]} />,
      EXPLORER_PERSON_LINKS
    );
    await userEvent.click(screen.getByRole('link', { name: 'Ada: explore this account' }));
    expect(screen.getByTestId('landed')).toHaveTextContent(`/explorer/account/${ADA}`);
  });

  it('History’s timeline, reused in the Explorer, links people there', () => {
    const event: TimelineEvent = {
      signature: 'sig1',
      kind: 'addAdmin',
      outcome: 'done',
      subject: ADA,
      creator: BOB,
      proposedAt: 1_790_000_000_000,
      proposedHeight: 2_700_000,
      at: 1_790_100_000_000,
      atHeight: 2_701_000,
      title: 'Made a Minter Admin',
      detail: null,
      reason: null,
      tone: 'good',
      decline: false,
      joinRequest: false,
      becameMember: false,
      endedMembership: false,
      tx: { signature: 'sig1', type: 'ADD_GROUP_ADMIN', timestamp: 1_790_000_000_000 } as TxRow,
    };
    show(
      <TimelineList events={[event]} showSubject nowMs={1_791_830_000_000} label="Events" />,
      EXPLORER_PERSON_LINKS
    );
    // Who it is about, and who proposed it.
    const links = screen.getAllByRole('link', { name: /explore this account$/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `/explorer/account/${ADA}`,
      `/explorer/account/${BOB}`,
    ]);
    expect(screen.queryByRole('link', { name: /open their page$/ })).toBeNull();
  });
});
