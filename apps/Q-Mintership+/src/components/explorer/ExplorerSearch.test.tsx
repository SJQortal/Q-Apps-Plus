/**
 * The Explorer's field: grouped suggestions (Exact, Names, Recent), a
 * polite status line, and Enter that never picks a suggestion by itself:
 * it opens an address, an AT address or a transaction, or looks the text
 * up as a name, and a name nobody has opens nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigationType } from 'react-router-dom';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../test/setup';
import { ADDR, NOW } from '../../test/world';
import { recordRecent, resetExplorerState } from '../../state/explorer';
import { ExplorerSearch } from './ExplorerSearch';

const T = { timeout: 3000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;
const AT = `A${'b'.repeat(33)}`;
const SIG =
  '4mYb2yQkXvJ1sL9pW3tE7uN5rC8dF6gH2jK4mZ1xA9bV3nQ7wE5rT8yU2io6pL1aS3dF5gH7jK9LZ2xC4vB6nM8';

/** Registered names for Core's /names/search (the world's own aren't wired there). */
const NAMES = [
  { name: 'Nora Nominator', owner: ADDR.nominator },
  { name: 'Nora’s Shop', owner: ADDR.nominator },
  { name: 'Norbert', owner: ADDR.learner },
  { name: 'Leo Learner', owner: ADDR.learner },
  { name: 'Snorkel', owner: ADDR.admin },
];

function answerNameSearch() {
  mockFetchRoute('/names/search', (url: URL) => {
    const q = (url.searchParams.get('query') ?? '').toLowerCase();
    const limit = Number(url.searchParams.get('limit'));
    if (!limit) throw new Error('limit=0');
    const prefix = url.searchParams.get('prefix') === 'true';
    return NAMES.filter(({ name }) =>
      prefix ? name.toLowerCase().startsWith(q) : name.toLowerCase().includes(q)
    ).slice(0, limit);
  });
}

/** Where the app is: path, router state and how it got there. */
function Probe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <output data-testid="at">
      {location.pathname}|{JSON.stringify(location.state ?? null)}|{type}
    </output>
  );
}

async function show(persona = 'learner', setup?: RenderPageOptions['setup']) {
  const result = await renderPage(
    <>
      <ExplorerSearch />
      <Probe />
    </>,
    { persona, path: '/explorer', route: '/explorer/*', strict: true, setup }
  );
  // After the world's catch-all: the newest route answers first.
  answerNameSearch();
  const field = screen.getByRole('combobox', { name: 'Find an account or transaction' });
  return { ...result, field, user: userEvent.setup() };
}

const at = () => screen.getByTestId('at').textContent ?? '';
const status = () =>
  screen.getByText((_, el) => el?.getAttribute('role') === 'status' && el.tagName === 'P');

beforeEach(() => resetExplorerState());
afterEach(() => vi.useRealTimers());

describe('ExplorerSearch: suggestions', () => {
  it('groups what Enter does and the names that start with the text, one row per owner', async () => {
    const { field, user, posts } = await show();
    await user.type(field, 'nor');
    const names = await screen.findByRole('group', { name: 'Names' }, T);
    const exact = screen.getByRole('group', { name: 'Exact' });
    expect(within(exact).getByRole('option')).toHaveTextContent('Look up the name “nor”');
    // Nora's two names are one row; Norbert isn't Leo's primary name, so it says whose it is.
    expect(
      await within(names).findByRole('option', { name: /^Norbert · a name of Leo Learner Q/ }, T)
    ).toBeInTheDocument();
    expect(within(names).getByRole('option', { name: /^Nora Nominator Q/ })).toBeInTheDocument();
    expect(within(names).getAllByRole('option')).toHaveLength(2);
    expect(status()).toHaveTextContent('3 names found · 2 accounts');
    // One search for the whole word typed, under the key Nominate shares.
    expect(fetchCallsFor('/names/search?query=nor&prefix=true&limit=10')).toHaveLength(1);
    expect(fetchCallsFor('/names/search').every((p) => !/limit=0\b/.test(p))).toBe(true);
    expect(posts).toEqual([]);
  });

  it('clears the text with a full 44 px button', async () => {
    const { field, user } = await show();
    await user.type(field, 'nor');
    const clear = screen.getByRole('button', { name: 'Clear' });
    expect(clear).toHaveStyle({ width: '44px', height: '44px' });
    await user.click(clear);
    expect(field).toHaveValue('');
  });

  it('asks for one more letter, and says when no names start with the text', async () => {
    const { field, user } = await show();
    await user.type(field, 'n');
    expect(status()).toHaveTextContent('Type one more letter for suggestions');
    await user.clear(field);
    await user.type(field, 'zz');
    await waitFor(() => expect(status()).toHaveTextContent('No names start with “zz”'), T);
  });

  it('offers the accounts explored on this device while the field is empty', async () => {
    recordRecent(ADDR.admin);
    const { field, user } = await show();
    await user.click(field);
    const recent = await screen.findByRole('group', { name: 'Recent' }, T);
    expect(await within(recent).findByText('Avery Admin', {}, T)).toBeInTheDocument();
    await user.click(within(recent).getByRole('option'));
    expect(at()).toBe(`/explorer/account/${ADDR.admin}|null|PUSH`);
  });

  it('a picked name opens its owner, saying which name it came from', async () => {
    const { field, user } = await show();
    await user.type(field, 'norb');
    const option = await screen.findByRole('option', { name: /^Norbert/ }, T);
    await user.click(option);
    expect(at()).toBe(
      `/explorer/account/${ADDR.learner}|{"viaName":"Norbert","matched":"Norbert"}|PUSH`
    );
  });
});

describe('ExplorerSearch: Enter', () => {
  it('never picks a suggestion: it looks the text up as a name, and opens nothing when no one has it', async () => {
    const { field, user, posts } = await show();
    await user.type(field, 'Nor');
    await screen.findByRole('option', { name: /^Nora Nominator/ }, T);
    await user.keyboard('{Enter}');
    expect(
      await screen.findByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent === 'No one has the name “Nor”. Names that contain it:'
      )
    ).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Names that contain “Nor”' }, T);
    expect(within(list).getAllByRole('link')).toHaveLength(4);
    for (const name of ['Nora Nominator', 'Nora’s Shop', 'Norbert', 'Snorkel'])
      expect(within(list).getByRole('link', { name: new RegExp(`^${name} Q`) })).toBeVisible();
    expect(at()).toBe('/explorer|null|POP');
    // A name from the list opens its owner with that name.
    await user.click(within(list).getByRole('link', { name: /^Snorkel/ }));
    expect(at()).toBe(
      `/explorer/account/${ADDR.admin}|{"viaName":"Snorkel","matched":"Snorkel"}|PUSH`
    );
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('opens the owner of a name it finds, with the name typed and the one Core matched', async () => {
    const { field, user } = await show();
    // Core matches the reduced name: the spelling can differ.
    mockFetchRoute(/^\/names\/NORA/, { name: 'Nora Nominator', owner: ADDR.nominator });
    await user.type(field, 'NORA NOMINATOR{Enter}');
    await waitFor(() =>
      expect(at()).toBe(
        `/explorer/account/${ADDR.nominator}|{"viaName":"NORA NOMINATOR","matched":"Nora Nominator"}|PUSH`
      )
    );
  });

  it('opens an address, an AT address and a transaction', async () => {
    const { field, user } = await show();
    await user.type(field, ADDR.nominator);
    expect(status()).toHaveTextContent('Press Enter to open this account.');
    expect(screen.getByRole('option', { name: /^Open account Q/ })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(at()).toBe(`/explorer/account/${ADDR.nominator}|null|PUSH`);

    await user.clear(field);
    await user.type(field, `${AT}{Enter}`);
    expect(at()).toBe(`/explorer/account/${AT}|null|PUSH`);

    await user.clear(field);
    await user.type(field, SIG);
    expect(
      screen.getByRole('option', { name: /^Open transaction 4mYb2y…6nM8/ })
    ).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(at()).toBe(`/explorer/tx/${SIG}|null|PUSH`);
    // None of these is a name: no name was looked up or searched.
    expect(fetchCallsFor(/^\/names\/(?!search|primary)/)).toEqual([]);
  });
});

describe('ExplorerSearch: QDN identifiers', () => {
  /** QDN resources under `identifier`, one per name. */
  const publish =
    (identifier: string, ...names: string[]): RenderPageOptions['setup'] =>
    (world) => {
      names.forEach((name, i) =>
        world.records.push({ name, identifier, created: NOW - (i + 1) * 3_600_000, body: {} })
      );
    };

  it('suggests the resources published under an identifier pasted in, and opens the one picked', async () => {
    const { field, user, posts } = await show('learner', publish('my-doc-abc', 'Nora Nominator'));
    await user.click(field);
    await user.paste('my-doc-abc');
    const qdn = await screen.findByRole('group', { name: 'QDN' }, T);
    const option = within(qdn).getByRole('option', { name: /^JSON · my-doc-abc/ });
    expect(option).toHaveTextContent('Published by Nora Nominator');
    await waitFor(() => expect(status()).toHaveTextContent('1 QDN resource with this identifier'));
    // One exact search, no bodies.
    const searches = fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      p.includes('identifier=my-doc-abc')
    );
    expect(searches).toHaveLength(1);
    expect(searches[0]).toMatch(/prefix=false/);
    expect(searches[0]).toMatch(/limit=11/);
    expect(fetchCallsFor('/arbitrary/JSON/')).toEqual([]);
    await user.click(option);
    expect(at()).toMatch(/^\/explorer\/tx\/[1-9A-HJ-NP-Za-km-z]+\|null\|PUSH$/);
    expect(posts).toEqual([]);
  });

  it('Enter on an identifier nobody has as a name opens the one resource that has it', async () => {
    const { field, user } = await show('learner', publish('my-doc-abc', 'Nora Nominator'));
    await user.click(field);
    await user.paste('my-doc-abc');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(at()).toMatch(/^\/explorer\/tx\//), T);
  });

  it('when several resources share it, Enter asks to pick one and opens nothing', async () => {
    const { field, user } = await show(
      'learner',
      publish('qortal_shared', 'Nora Nominator', 'Leo Learner')
    );
    await user.click(field);
    await user.paste('qortal_shared');
    await screen.findByRole('group', { name: 'QDN' }, T);
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        'No one has that name, and 2 QDN resources have it as identifier: pick one.'
      )
    );
    expect(at()).toBe('/explorer|null|POP');
    expect(within(screen.getByRole('group', { name: 'QDN' })).getAllByRole('option')).toHaveLength(
      2
    );
  });
});
