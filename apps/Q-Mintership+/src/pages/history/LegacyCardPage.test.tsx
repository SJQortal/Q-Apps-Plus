import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { mockQortalRequest, qortalCalls, qortalCallsFor } from '../../test/setup';
import { ADDR, NOW, PEOPLE } from '../../test/world';
import LegacyCardPage from './LegacyCardPage';

const ROUTE = '/history/card/:card';

function open(card: string, persona = 'learner', section = '') {
  return renderPage(<LegacyCardPage />, {
    persona,
    path: `/history/card/${encodeURIComponent(card)}${section ? `/${section}` : ''}`,
    route: section ? `${ROUTE}/:section` : ROUTE,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Original card page', () => {
  it('shows a nomination card as plain text, with nominee, publisher, links and poll', async () => {
    const { posts } = await open('Minter-board-card-bQ7xK2');
    const card = await screen.findByRole('article');
    expect(
      within(card).getByRole('heading', {
        name: `${PEOPLE.nominatedSigning.name} for the MINTER group`,
      })
    ).toBeInTheDocument();
    expect(within(card).getByText('Nomination')).toBeInTheDocument();
    expect(within(card).getByText('Nominee')).toBeInTheDocument();
    expect(
      within(card).getByRole('link', { name: `${PEOPLE.nominatedSigning.name}: open their page` })
    ).toHaveAttribute('href', `/explorer/account/${ADDR.nominatedSigning}/mintership`);
    expect(await within(card).findByText(PEOPLE.nominator.name as string)).toBeInTheDocument();
    expect(
      within(card).getByText(
        `${PEOPLE.nominatedSigning.name} has run a public node since spring & answers questions in the minting chat most days.`
      )
    ).toBeInTheDocument();
    expect(within(card).getByText('• Node online 24/7')).toBeInTheDocument();
    // No markup, no scripts: the HTML was read as text (the app's own avatars aside).
    const html = card.innerHTML.replace(/<img [^>]*src="[^"]*\/arbitrary\/THUMBNAIL\/[^"]*"[^>]*>/g, '');
    expect(html).not.toMatch(/<script|<img|onerror|<strong/);
    expect((window as { __legacyScriptRan?: boolean }).__legacyScriptRan).toBeUndefined();
    expect(within(card).getAllByRole('button', { name: /APP\/Q-Tube\/channel/ })).toHaveLength(1);
    expect(within(card).queryByText(/example\.com/)).toBeNull();

    expect(await screen.findByText('9 yes')).toBeInTheDocument();
    expect(screen.getByText('1 no')).toBeInTheDocument();
    expect(screen.getByText('10 votes, one per account')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '9 yes and 1 no' })).toBeInTheDocument();
    expect(screen.getByText(/This board is read-only now/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nominations' })).toHaveAttribute(
      'href',
      '/decisions?show=nominations'
    );
    expect(posts).toEqual([]);
    expect(qortalCalls.map((c) => c.action)).toEqual(['GET_USER_ACCOUNT']);
  });

  it('shows the comments, oldest first, with what a reply answered', async () => {
    await open('Minter-board-card-bQ7xK2');
    expect(await screen.findByRole('heading', { name: 'Comments (3)' })).toBeInTheDocument();
    expect(await screen.findByText('Happy to sign once the invite is up.')).toBeInTheDocument();
    const reply = (await screen.findByText('Signed ✅')).closest('li') as HTMLElement;
    expect(within(reply).getByText('Admin B')).toBeInTheDocument();
    expect(
      within(reply).getByText(`Replying to ${PEOPLE.nominatedSigning.name}`)
    ).toBeInTheDocument();
    expect(
      within(reply).getByText('Thank you all! My node has been up for 200 days.')
    ).toBeInTheDocument();
  });

  it('pages long comment threads 20 at a time', async () => {
    await open('Minter-board-card-Kt3mPq');
    expect(await screen.findByRole('heading', { name: 'Comments (23)' })).toBeInTheDocument();
    expect(await screen.findByText('Comment number 1 on this card.')).toBeInTheDocument();
    expect(screen.queryByText('Comment number 21 on this card.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show more comments (3)' }));
    expect(await screen.findByText('Comment number 23 on this card.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show more comments/ })).toBeNull();
  });

  it('marks an early card the nominee posted for themselves', async () => {
    await open('Minter-board-card-Kt3mPq');
    const card = await screen.findByRole('article');
    expect(within(card).getByText('Posted by the nominee')).toBeInTheDocument();
    expect(within(card).getByText('I have kept a node online for a year.')).toBeInTheDocument();
    expect(within(card).getByText(/· edited/)).toBeInTheDocument();
    expect(await screen.findByText('12 yes')).toBeInTheDocument();
  });

  it('says when a card has no poll on chain', async () => {
    await open('Minter-board-card-9f2c4e1a7b3d');
    expect(await screen.findByText('No poll result on chain for this card.')).toBeInTheDocument();
    const card = screen.getByRole('article');
    expect(within(card).queryByText(/names .* as the nominator/)).toBeNull();
    expect(
      within(card).getByRole('button', { name: /APP\/Q-Blog\/ExampleBlog/ })
    ).toBeInTheDocument();
  });

  it('notes a poll that belongs to someone other than the publisher', async () => {
    await open('Minter-board-card-old002');
    expect(await screen.findByText(/its poll belongs to a different account/)).toBeInTheDocument();
  });

  it('says nothing about the owner when the poll is the publisher’s', async () => {
    await open('Minter-board-card-old000');
    expect(await screen.findByText('8 yes')).toBeInTheDocument();
    expect(screen.queryByText(/its poll belongs to a different account/)).toBeNull();
  });

  it('shows a Minter Admin proposal with who it would add', async () => {
    await open('QM-AR-card-Pr0m0t');
    const card = await screen.findByRole('article');
    expect(within(card).getByText('Admin proposal: add')).toBeInTheDocument();
    expect(within(card).getByText('Proposed Minter Admin')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Admin proposal' })).toBeInTheDocument();
    expect(await screen.findByText('6 yes')).toBeInTheDocument();
    expect(
      screen.getByText(/Admin changes are proposed and approved by Minter Admins/)
    ).toBeInTheDocument();
  });

  it('scrolls to the comments for an old #/minter/<card>/comments link', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    try {
      await open('Minter-board-card-bQ7xK2', 'learner', 'comments');
      await screen.findByRole('heading', { name: 'Comments (3)' });
      expect(scroll).toHaveBeenCalledTimes(1);
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('does not decrypt the admin board: it links to the original app', async () => {
    await open('card-MAC-NC-1780000000000-a1B2c3', 'admin');
    expect(await screen.findByText('Encrypted to Minter Admins')).toBeInTheDocument();
    expect(await screen.findByText('Admin E')).toBeInTheDocument();
    mockQortalRequest('OPEN_NEW_TAB', true);
    await userEvent.click(screen.getByRole('button', { name: 'Open in the original app' }));
    expect(qortalCallsFor('OPEN_NEW_TAB')[0]).toMatchObject({
      qortalLink: 'qortal://APP/Q-Mintership',
    });
    expect(qortalCallsFor('DECRYPT_DATA')).toEqual([]);
  });

  it('explains an unknown card and an identifier that is not a card', async () => {
    await open('Minter-board-card-unknown');
    expect(await screen.findByText("Your node doesn't know this card.")).toBeInTheDocument();
    cleanup();
    await open('not-a-card');
    expect(await screen.findByText("That isn't a card from the original app.")).toBeInTheDocument();
  });

  it('says so when a card was deleted, and lets the reader try again', async () => {
    const { world } = await open('Minter-board-card-zzdel1');
    expect(await screen.findByText("Your node doesn't know this card.")).toBeInTheDocument();
    world.legacy.resources.push({
      service: 'BLOG_POST',
      name: 'Gone',
      identifier: 'Minter-board-card-zzdel1',
      created: NOW,
      body: 'D',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('This card was deleted by its publisher.')).toBeInTheDocument();
  });

  it('says so when a card cannot be read', async () => {
    const { world } = await open('Minter-board-card-zzbad1');
    expect(await screen.findByText("Your node doesn't know this card.")).toBeInTheDocument();
    world.legacy.resources.push({
      service: 'BLOG_POST',
      name: 'Broken',
      identifier: 'Minter-board-card-zzbad1',
      created: NOW,
      body: '{"header": ',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText("This card can't be read.")).toBeInTheDocument();
  });
});
