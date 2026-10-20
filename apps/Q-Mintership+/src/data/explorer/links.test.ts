import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR, installWorld } from '../../test/world';
import { OLD_MINTER, SPONSEES, SPONSOR, type ExplorerWorld } from '../../../e2e/world.mjs';
import { linksOf } from '../../rules/explorer/connections';
import { peekQuery, queryLoadCounts, resetQueries } from '../query';
import { dropHeavy, heavy, HeavyCancelled } from './heavy';
import { getLinks, LINK_TX_TYPES } from './links';

const A = `Q${'a'.repeat(33)}`;

function rows(offset: number, count: number, type = 'REWARD_SHARE') {
  return Array.from({ length: count }, (_, i) => ({
    type,
    signature: `s${offset + i}`.padEnd(88, 'x'),
    timestamp: 1_000_000 - (offset + i),
    blockHeight: 900_000 - (offset + i),
    creatorAddress: A,
    recipient: A,
    sharePercent: '0.00',
  }));
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => resetQueries());
afterEach(() => vi.useRealTimers());

describe('getLinks', () => {
  it('searches the account for its link types, 100 newest a page, until a short page', async () => {
    mockFetchRoute('/transactions/search', (url: URL) => {
      const offset = Number(url.searchParams.get('offset'));
      return rows(offset, offset === 0 ? 100 : 7);
    });
    const links = await getLinks(A);
    expect(links.rows).toHaveLength(107);
    expect(links.truncated).toBe(false);
    const calls = fetchCallsFor('/transactions/search');
    expect(calls).toHaveLength(2);
    const first = new URL(calls[0], 'http://x').searchParams;
    expect(first.get('address')).toBe(A);
    expect(first.getAll('txType')).toEqual([...LINK_TX_TYPES]);
    expect(first.get('confirmationStatus')).toBe('CONFIRMED');
    expect(first.get('limit')).toBe('100');
    expect(first.get('reverse')).toBe('true');
    expect(new URL(calls[1], 'http://x').searchParams.get('offset')).toBe('100');
    expect(peekQuery(`xlinks:${A}`)).toBe(links);
    // One load, counted under its own prefix.
    expect(queryLoadCounts().xlinks).toBe(1);
  });

  it('stops at 5 pages, then reads the level moves on their own so none is cut off', async () => {
    mockFetchRoute('/transactions/search', (url: URL) => {
      const types = url.searchParams.getAll('txType');
      if (types.length === 1) {
        expect(types).toEqual(['TRANSFER_PRIVS']);
        // One already read (a duplicate) and one older than the cap.
        return [
          { ...rows(0, 1)[0], type: 'TRANSFER_PRIVS', creatorAddress: `Q${'b'.repeat(33)}` },
          {
            ...rows(900, 1)[0],
            type: 'TRANSFER_PRIVS',
            creatorAddress: `Q${'b'.repeat(33)}`,
          },
        ];
      }
      return rows(Number(url.searchParams.get('offset')), 100);
    });
    const links = await getLinks(A);
    expect(fetchCallsFor('/transactions/search')).toHaveLength(6);
    expect(links.truncated).toBe(true);
    expect(links.rows).toHaveLength(501);
    expect(links.rows[links.rows.length - 1].signature).toBe(rows(900, 1)[0].signature);
    expect(linksOf(links.rows, A).levelMoves).toHaveLength(1);
  });

  it('waits for a heavy-read slot, and is dropped with the page that asked', async () => {
    const gate = deferred();
    const busy = [heavy('other', () => gate.promise), heavy('other', () => gate.promise)];
    mockFetchRoute('/transactions/search', []);
    const read = getLinks(A, { scope: 'page-account' });
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchCallsFor('/transactions/search')).toEqual([]);
    dropHeavy('page-account');
    await expect(read).rejects.toBeInstanceOf(HeavyCancelled);
    gate.resolve();
    await Promise.all(busy);
  });
});

describe('getLinks in the mock world', () => {
  it('reads a sent level move’s recipient from its raw bytes', async () => {
    const { world } = installWorld('admin', { strict: true });
    const links = await getLinks(OLD_MINTER.address);
    const sig = (world.explorer as ExplorerWorld).sigs.privs;
    expect(links.privs).toEqual({ [sig]: ADDR.kickTarget });
    expect(peekQuery(`xprivs:${sig}`)).toBe(ADDR.kickTarget);
    const moves = linksOf(links.rows, OLD_MINTER.address, links.privs).levelMoves;
    expect(moves.map((m) => [m.direction, m.other])).toEqual([['to', ADDR.kickTarget]]);
    // The recipient's own links name the sender; no raw read is needed for it.
    const theirs = await getLinks(ADDR.kickTarget);
    expect(theirs.privs).toEqual({});
    expect(linksOf(theirs.rows, ADDR.kickTarget).levelMoves[0]).toMatchObject({
      direction: 'from',
      other: OLD_MINTER.address,
    });
  });

  it('finds the sponsor’s five sponsees, and Leo’s sponsor', async () => {
    installWorld('admin', { strict: true });
    const sponsor = await getLinks(SPONSOR.address);
    // In the order of their first share: Leo first.
    expect(linksOf(sponsor.rows, SPONSOR.address).sponsees.map((s) => s.address)).toEqual(
      [SPONSEES[4], ...SPONSEES.slice(0, 4)].map((s) => s.address)
    );
    const leo = linksOf((await getLinks(ADDR.learner)).rows, ADDR.learner);
    expect(leo.sponsors).toHaveLength(1);
    expect(leo.sponsors[0]).toMatchObject({ sponsor: SPONSOR.address, blocks: 7_234 });
  });
});
