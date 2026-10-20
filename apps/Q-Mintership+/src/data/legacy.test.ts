import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCalls, fetchCallsFor, qortalCalls } from '../test/setup';
import { ADDR, NOW, PEOPLE, installWorld } from '../test/world';
import {
  findLegacyCard,
  isCardAbout,
  legacyBoardOf,
  legacyText,
  loadLegacyCard,
  loadLegacyComment,
  loadLegacyComments,
  loadLegacyFor,
  loadLegacyIndex,
  loadLegacyPoll,
  parseLegacyCard,
  parseLegacyComment,
  toCardRows,
  type LegacyCardRow,
} from './legacy';
import { QdnDeletedError } from './qdn';
import type { QdnRow } from './types';

const DAY = 86_400_000;

function row(identifier: string, extra: Partial<LegacyCardRow> = {}): LegacyCardRow {
  return {
    identifier,
    board: legacyBoardOf(identifier) ?? 'minter',
    publisher: 'Pat Publisher',
    createdAt: 1_000,
    updatedAt: null,
    version: 'v1',
    ...extra,
  };
}

/** Every QDN search the app made, as URLSearchParams. */
function searches() {
  return fetchCallsFor('/arbitrary/resources/searchsimple').map(
    (path) => new URL(path, 'http://x').searchParams
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('legacy text', () => {
  it('turns card HTML into plain paragraphs, keeping line breaks and list items', () => {
    const text = legacyText(
      '<p><strong>Bob</strong> runs a node &amp; helps.</p><p><br></p><p>Line one<br>line two</p>' +
        '<ul><li>Online 24/7</li><li>Helps in Q-Chat</li></ul>'
    );
    expect(text.paragraphs).toEqual([
      'Bob runs a node & helps.',
      'Line one\nline two',
      '• Online 24/7',
      '• Helps in Q-Chat',
    ]);
  });

  it('drops scripts, images and styles without running them', () => {
    const text = legacyText(
      '<p>Hi</p><script>window.__ran = 1</script><img src="x" onerror="window.__img = 1">' +
        '<style>p{color:red}</style><iframe src="qortal://APP/x"></iframe>'
    );
    expect(text.paragraphs).toEqual(['Hi']);
    expect((window as { __ran?: number }).__ran).toBeUndefined();
    expect((window as { __img?: number }).__img).toBeUndefined();
    expect(text.links).toEqual([]);
  });

  it('collects qortal:// links from anchors and from the text, never web links', () => {
    const text = legacyText(
      '<p>See <a href="qortal://APP/Q-Tube/channel/bob%2Bbuilder">channel</a>, ' +
        '<a href="https://example.com">web</a> and qortal://WEBSITE/Example.</p>'
    );
    expect(text.links).toEqual([
      'qortal://APP/Q-Tube/channel/bob%2Bbuilder',
      'qortal://WEBSITE/Example',
    ]);
  });

  it('reads plain text with blank-line paragraphs', () => {
    expect(legacyText('First.\n\nSecond line\nthird line').paragraphs).toEqual([
      'First.',
      'Second line\nthird line',
    ]);
  });

  it('is empty for anything that is not a string', () => {
    for (const value of [undefined, null, 5, {}, ['<p>x</p>'], '   ']) {
      expect(legacyText(value)).toEqual({ paragraphs: [], links: [] });
    }
  });

  it('still strips tags and decodes entities without a DOM', () => {
    vi.stubGlobal('DOMParser', undefined);
    const text = legacyText(
      '<p>A &lt;b&gt; &amp; &#x2705;</p><script>evil()</script><p><a href="qortal://APP/Q-Blog">x</a></p>'
    );
    expect(text.paragraphs).toEqual(['A <b> & ✅', 'x']);
    expect(text.links).toEqual(['qortal://APP/Q-Blog']);
  });
});

describe('legacy cards', () => {
  it('knows the three old boards by identifier', () => {
    expect(legacyBoardOf('Minter-board-card-abc123')).toBe('minter');
    expect(legacyBoardOf('QM-AR-card-abc123')).toBe('ar');
    expect(legacyBoardOf('card-MAC-NC-1-abc')).toBe('admin');
    expect(legacyBoardOf('comment-Minter-board-card-abc123-x')).toBeNull();
    expect(legacyBoardOf('qmp-nomination-Q1')).toBeNull();
  });

  it('parses a nomination card, with the nominee from the newer or the legacy fields', () => {
    const newer = parseLegacyCard(
      {
        header: '  Bob   for MINTER ',
        content: '<p>Good</p>',
        links: ['qortal://APP/Q-Tube', 'https://web.example', 42],
        nominee: 'Bob',
        nomineeAddress: ADDR.nominatedSigning,
        nominator: 'Nora',
        creator: 'Bob',
        creatorAddress: ADDR.learner,
        poll: 'Minter-board-card-a-poll',
      },
      row('Minter-board-card-a')
    );
    expect(newer).toMatchObject({
      title: 'Bob for MINTER',
      subject: { name: 'Bob', address: ADDR.nominatedSigning },
      nominator: 'Nora',
      selfPosted: false,
      links: ['qortal://APP/Q-Tube'],
      pollName: 'Minter-board-card-a-poll',
      promotion: null,
    });
    const early = parseLegacyCard(
      { creator: 'Pat Publisher', creatorAddress: ADDR.kicked },
      row('Minter-board-card-b')
    );
    expect(early).toMatchObject({
      title: 'Nomination card',
      subject: { name: 'Pat Publisher', address: ADDR.kicked },
      nominator: null,
      selfPosted: true,
      body: { paragraphs: [], links: [] },
      pollName: null,
    });
  });

  it('ignores a malformed nominee address instead of trusting it', () => {
    const card = parseLegacyCard(
      { nominee: 'X', nomineeAddress: 'not-an-address' },
      row('Minter-board-card-c')
    );
    expect(card?.subject).toEqual({ name: 'X', address: null });
  });

  it('parses admin proposals and their add/remove flag', () => {
    const add = parseLegacyCard(
      { minterName: 'Pia', minterAddress: ADDR.promote, promotionCard: true },
      row('QM-AR-card-x')
    );
    expect(add).toMatchObject({
      board: 'ar',
      title: 'Minter Admin proposal',
      subject: { name: 'Pia', address: ADDR.promote },
      promotion: true,
    });
    expect(parseLegacyCard({ promotionCard: 'false' }, row('QM-AR-card-y'))?.promotion).toBe(false);
    expect(parseLegacyCard({ promotionCard: 'maybe' }, row('QM-AR-card-z'))?.promotion).toBeNull();
  });

  it('refuses bodies that are not cards', () => {
    for (const body of [null, 'text', ['a'], 7]) {
      expect(parseLegacyCard(body, row('Minter-board-card-d'))).toBeNull();
    }
    expect(parseLegacyCard({ header: 'x' }, row('card-MAC-1-a'))).toBeNull();
  });

  it('keeps the earliest publisher of an identifier and lists cards newest first', () => {
    const rows: QdnRow[] = [
      { name: 'Copycat', service: 'BLOG_POST', identifier: 'Minter-board-card-a', created: 30 },
      { name: 'Original', service: 'BLOG_POST', identifier: 'Minter-board-card-a', created: 10 },
      { name: 'Other', service: 'BLOG_POST', identifier: 'QM-AR-card-b', created: 20 },
      { name: 'Noise', service: 'BLOG_POST', identifier: 'something-else', created: 40 },
    ];
    expect(toCardRows(rows).map((r) => [r.identifier, r.publisher, r.board, r.version])).toEqual([
      ['QM-AR-card-b', 'Other', 'ar', '20'],
      ['Minter-board-card-a', 'Original', 'minter', '10'],
    ]);
  });
});

describe('legacy reads against the mock node', () => {
  it('indexes both boards in pages, bounded, never with limit=0', async () => {
    installWorld('learner');
    const index = await loadLegacyIndex();
    expect(index.truncated).toBe(false);
    expect(index.cards).toHaveLength(27);
    expect(index.cards[0]).toMatchObject({
      identifier: 'Minter-board-card-bQ7xK2',
      publisher: PEOPLE.nominator.name,
    });
    expect(index.cards.some((c) => c.publisher === PEOPLE.left.name)).toBe(false);
    for (const params of searches()) {
      const limit = Number(params.get('limit'));
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(100);
    }
    expect(searches().map((p) => p.get('identifier'))).toEqual([
      'Minter-board-card-',
      'QM-AR-card-',
    ]);
    // The index is cached: a second read asks nothing.
    const before = fetchCalls.length;
    await loadLegacyIndex();
    expect(fetchCalls.length).toBe(before);
  });

  it('reads a card body once per version, under an encoded name', async () => {
    installWorld('learner');
    const index = await loadLegacyIndex();
    const first = index.cards[0];
    const card = await loadLegacyCard(first);
    expect(card.title).toBe(`${PEOPLE.nominatedSigning.name} for the MINTER group`);
    expect(card.links).toEqual(['qortal://APP/Q-Tube/channel/bob%2Bbuilder']);
    expect(card.body.paragraphs.join('\n')).not.toMatch(/<|script|onerror/);
    await loadLegacyCard(first);
    expect(fetchCallsFor('/arbitrary/BLOG_POST/')).toEqual([
      '/arbitrary/BLOG_POST/Nora%20Nominator/Minter-board-card-bQ7xK2',
    ]);
  });

  it('reports bad JSON and deleted cards instead of showing them', async () => {
    const { world } = installWorld('learner');
    world.legacy.resources.push(
      {
        service: 'BLOG_POST',
        name: 'Broken',
        identifier: 'Minter-board-card-broken',
        created: NOW - DAY,
        body: '{"header": "unfinished',
      },
      {
        service: 'BLOG_POST',
        name: 'Gone',
        identifier: 'Minter-board-card-gone00',
        created: NOW - DAY,
        body: 'D',
      }
    );
    await expect(
      loadLegacyCard(row('Minter-board-card-broken', { publisher: 'Broken' }))
    ).rejects.toThrow();
    await expect(
      loadLegacyCard(row('Minter-board-card-gone00', { publisher: 'Gone' }))
    ).rejects.toBeInstanceOf(QdnDeletedError);
  });

  it('finds one card by identifier, from the original publisher', async () => {
    installWorld('learner');
    const found = await findLegacyCard('Minter-board-card-bQ7xK2');
    expect(found?.publisher).toBe(PEOPLE.nominator.name);
    expect(searches().at(-1)?.get('prefix')).toBe('false');
    expect(await findLegacyCard('Minter-board-card-nothere')).toBeNull();
    const admin = await findLegacyCard('card-MAC-NC-1780000000000-a1B2c3');
    expect(admin).toMatchObject({ board: 'admin', publisher: 'Admin E' });
    expect(searches().at(-1)?.get('service')).toBe('MAIL_PRIVATE');
    const calls = fetchCalls.length;
    expect(await findLegacyCard('not-a-card')).toBeNull();
    expect(fetchCalls.length).toBe(calls);
  });

  it('uses the History index when it is already loaded', async () => {
    installWorld('learner');
    await loadLegacyIndex();
    const calls = searches().length;
    expect((await findLegacyCard('QM-AR-card-Pr0m0t'))?.publisher).toBe(PEOPLE.admin.name);
    expect(searches().length).toBe(calls);
  });

  it('reads a poll result and checks the poll belongs to the publisher', async () => {
    const { world } = installWorld('learner');
    const card = await loadLegacyCard((await findLegacyCard('Minter-board-card-bQ7xK2'))!);
    expect(await loadLegacyPoll(card)).toEqual({
      name: 'Minter-board-card-bQ7xK2-poll',
      yes: 9,
      no: 1,
      total: 10,
      ownerMatches: true,
    });
    world.legacy.polls['Minter-board-card-Kt3mPq-poll'].owner = ADDR.learner;
    const kicked = await loadLegacyCard((await findLegacyCard('Minter-board-card-Kt3mPq'))!);
    expect((await loadLegacyPoll(kicked))?.ownerMatches).toBe(false);
    const long = await loadLegacyCard((await findLegacyCard('Minter-board-card-9f2c4e1a7b3d'))!);
    expect(await loadLegacyPoll(long)).toBeNull();
    expect(qortalCalls.filter((c) => c.action !== 'GET_USER_ACCOUNT')).toEqual([]);
  });

  it('lists a card’s comments oldest first, only that card’s', async () => {
    const { world } = installWorld('learner');
    world.legacy.resources.push({
      service: 'BLOG_POST',
      name: 'Elsewhere',
      identifier: 'comment-Minter-board-card-bQ7xK2abc-zzzzzz',
      created: NOW,
      body: { content: '<p>Other card</p>', creator: 'Elsewhere' },
    });
    const comments = await loadLegacyComments('Minter-board-card-bQ7xK2');
    expect(comments.rows.map((c) => c.author)).toEqual([
      PEOPLE.admin.name,
      PEOPLE.nominatedSigning.name,
      'Admin B',
    ]);
    expect(searches().at(-1)?.get('identifier')).toBe('comment-Minter-board-card-bQ7xK2-');
    const reply = await loadLegacyComment(comments.rows[2]);
    expect(reply).toMatchObject({
      author: 'Admin B',
      body: { paragraphs: ['Signed ✅'] },
      replyTo: {
        author: PEOPLE.nominatedSigning.name,
        excerpt: 'Thank you all! My node has been up for 200 days.',
      },
    });
  });

  it('takes the comment author from the search row, not the body', () => {
    const comment = parseLegacyComment(
      { content: '<p>Hi</p>', creator: 'Someone Else' },
      { identifier: 'comment-x-1', author: 'Real Name', postedAt: 1, editedAt: null, version: 'v' }
    );
    expect(comment?.author).toBe('Real Name');
    expect(
      parseLegacyComment('nope', {
        identifier: 'c',
        author: 'a',
        postedAt: 1,
        editedAt: null,
        version: 'v',
      })
    ).toBeNull();
  });

  it('finds the old cards about a person: newest cards, plus the ones they posted themselves', async () => {
    installWorld('learner');
    const bob = await loadLegacyFor(
      { address: ADDR.nominatedSigning, name: PEOPLE.nominatedSigning.name },
      40
    );
    expect(bob.cards.map((c) => c.identifier)).toEqual(['Minter-board-card-bQ7xK2']);
    expect(bob).toMatchObject({ scanned: 27, total: 27 });

    // Kit's own card is far down the list, but published under their name.
    const kit = await loadLegacyFor({ address: ADDR.kicked, name: PEOPLE.kicked.name }, 1);
    expect(kit.cards.map((c) => c.identifier)).toEqual(['Minter-board-card-Kt3mPq']);
    expect(kit.scanned).toBe(1);

    const pia = await loadLegacyFor({ address: ADDR.promote, name: PEOPLE.promote.name }, 40);
    expect(pia.cards.map((c) => [c.identifier, c.promotion])).toEqual([
      ['QM-AR-card-Pr0m0t', true],
    ]);
  });

  it('matches a card by name only when the card has no address', () => {
    const person = { address: ADDR.learner, name: 'Leo Learner' };
    expect(isCardAbout({ subject: { name: 'leo learner', address: null } }, person)).toBe(true);
    expect(isCardAbout({ subject: { name: 'Leo Learner', address: ADDR.kicked } }, person)).toBe(
      false
    );
    expect(isCardAbout({ subject: { name: null, address: null } }, person)).toBe(false);
  });
});
