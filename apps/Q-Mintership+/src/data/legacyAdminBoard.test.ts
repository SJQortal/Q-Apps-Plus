/**
 * The original Admin Board, read for Minter Admins (legacyAdminBoard.ts):
 * its MAIL_PRIVATE cards and comments, decrypted through Hub's DECRYPT_DATA
 * as the original app read them, in the mock world (e2e/world-legacy.mjs).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_BOARD_IDS, answerDecrypt } from '../../e2e/world.mjs';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../test/setup';
import { ADDR, PEOPLE, installWorld } from '../test/world';
import { findLegacyCard, loadLegacyComments, type LegacyCardRow } from './legacy';
import {
  loadAdminBoardIndex,
  loadAdminCard,
  loadAdminComment,
  parseAdminCard,
} from './legacyAdminBoard';

afterEach(() => {
  vi.useRealTimers();
});

/** The world, with Hub decrypting as `persona` would. */
function world(persona = 'admin') {
  const installed = installWorld(persona);
  mockQortalRequest('DECRYPT_DATA', (request: Record<string, unknown>) =>
    answerDecrypt(installed.world, persona, request)
  );
  return installed;
}

async function cardRow(identifier: string): Promise<LegacyCardRow> {
  const row = await findLegacyCard(identifier);
  if (!row) throw new Error(`no row for ${identifier}`);
  return row;
}

describe('the Admin Board index', () => {
  it('lists every card-MAC card from one paged MAIL_PRIVATE search, newest first', async () => {
    world();
    const index = await loadAdminBoardIndex();
    expect(index.cards.map((c) => c.identifier)).toEqual([
      ADMIN_BOARD_IDS.topic,
      ADMIN_BOARD_IDS.removal,
      ADMIN_BOARD_IDS.unreadable,
      ADMIN_BOARD_IDS.locked,
    ]);
    expect(index.cards.every((c) => c.board === 'admin')).toBe(true);
    const [search] = fetchCallsFor('/arbitrary/resources/searchsimple').map(
      (path) => new URL(path, 'http://x').searchParams
    );
    expect(search.get('service')).toBe('MAIL_PRIVATE');
    expect(search.get('identifier')).toBe('card-MAC-');
    expect(search.get('prefix')).toBe('true');
    expect(Number(search.get('limit'))).toBeGreaterThan(0);
  });
});

describe('an Admin Board card', () => {
  it('is fetched as base64 and decrypted by Hub, then read as the original app wrote it', async () => {
    world();
    const read = await loadAdminCard(ADDR.admin, await cardRow(ADMIN_BOARD_IDS.removal));
    expect(read.status).toBe('ok');
    if (read.status !== 'ok') return;
    expect(read.value).toMatchObject({
      board: 'admin',
      title: 'Remove Member 12 from MINTER?',
      subject: { name: 'Member 12', address: null },
      publisher: 'Admin B',
      pollName: `${ADMIN_BOARD_IDS.removal}-poll`,
      topic: false,
      links: ['qortal://APP/Q-Mintership/explorer'],
    });
    expect(read.value.body.paragraphs[0]).toBe(
      'Member 12 has been offline for months and the sponsor asked us to look at it.'
    );
    expect(fetchCallsFor(`/arbitrary/MAIL_PRIVATE/Admin%20B/${ADMIN_BOARD_IDS.removal}`)).toEqual([
      `/arbitrary/MAIL_PRIVATE/Admin%20B/${ADMIN_BOARD_IDS.removal}?encoding=base64`,
    ]);
    expect(qortalCallsFor('DECRYPT_DATA')).toHaveLength(1);
  });

  it('a topic is about no one in particular', async () => {
    world();
    const read = await loadAdminCard(ADDR.admin, await cardRow(ADMIN_BOARD_IDS.topic));
    expect(read.status === 'ok' && read.value).toMatchObject({
      title: 'How we review removals',
      topic: true,
      subject: { name: null },
    });
  });

  it('is locked when it was not encrypted to the viewer, and kept as locked', async () => {
    world();
    const row = await cardRow(ADMIN_BOARD_IDS.locked);
    expect(await loadAdminCard(ADDR.admin, row)).toEqual({ status: 'locked' });
    expect(await loadAdminCard(ADDR.admin, row)).toEqual({ status: 'locked' });
    expect(qortalCallsFor('DECRYPT_DATA')).toHaveLength(1);
    // A body that was never sealed for anyone is locked too.
    expect(await loadAdminCard(ADDR.admin, await cardRow(ADMIN_BOARD_IDS.unreadable))).toEqual({
      status: 'locked',
    });
  });

  it('is decrypted per viewer: another account reads it again with its own key', async () => {
    world();
    const row = await cardRow(ADMIN_BOARD_IDS.removal);
    await loadAdminCard(ADDR.admin, row);
    await loadAdminCard(ADDR.adminL4, row);
    expect(qortalCallsFor('DECRYPT_DATA')).toHaveLength(2);
  });

  it('a Hub failure other than "unable to decrypt" is an error to retry, not a lock', async () => {
    world();
    mockQortalRequest('DECRYPT_DATA', () => {
      throw new Error('Wallet is locked');
    });
    await expect(loadAdminCard(ADDR.admin, await cardRow(ADMIN_BOARD_IDS.removal))).rejects.toThrow(
      'Wallet is locked'
    );
  });

  it('parses only an object, with plain fallbacks', () => {
    const row = {
      identifier: 'card-MAC-x-1',
      board: 'admin' as const,
      publisher: 'Pat',
      createdAt: 1,
      updatedAt: null,
      version: 'v',
    };
    expect(parseAdminCard('text', row)).toBeNull();
    expect(parseAdminCard([], row)).toBeNull();
    expect(parseAdminCard({}, row)).toMatchObject({ title: 'Admin Board card', topic: false });
    expect(parseAdminCard({ topicMode: true }, row)).toMatchObject({ title: 'Admin Board topic' });
  });
});

describe('Admin Board comments', () => {
  it('are listed from MAIL_PRIVATE and decrypted one by one; one not encrypted to the viewer is locked', async () => {
    world();
    const { rows } = await loadLegacyComments(ADMIN_BOARD_IDS.removal);
    expect(rows.map((r) => r.author)).toEqual(['Admin D ΑΩ', PEOPLE.admin.name, 'Admin C']);
    const reads = await Promise.all(rows.map((r) => loadAdminComment(ADDR.admin, r)));
    expect(reads.map((r) => r.status)).toEqual(['ok', 'ok', 'locked']);
    const reply = reads[1];
    expect(reply.status === 'ok' && reply.value).toMatchObject({
      replyTo: { author: 'Admin D ΑΩ', excerpt: 'Agreed, the node has been down since spring.' },
    });
    const search = fetchCallsFor('/arbitrary/resources/searchsimple')
      .map((path) => new URL(path, 'http://x').searchParams)
      .find((sp) => sp.get('identifier')?.startsWith('comment-'));
    expect(search?.get('service')).toBe('MAIL_PRIVATE');
  });
});

describe('never writes', () => {
  it('reads only: GETs and DECRYPT_DATA', async () => {
    const { posts } = world();
    const row = await cardRow(ADMIN_BOARD_IDS.removal);
    await loadAdminCard(ADDR.admin, row);
    const { rows } = await loadLegacyComments(row.identifier);
    await Promise.all(rows.map((r) => loadAdminComment(ADDR.admin, r)));
    expect(posts).toEqual([]);
  });
});
