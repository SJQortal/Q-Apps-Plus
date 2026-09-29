import { describe, expect, it } from 'vitest';
import {
  buildBoardRouteHash,
  legacyHashToPath,
  legacyPathToPath,
  normalizeBoardRouteKey,
  parseBoardRouteHash,
} from './legacyRoutes';

describe('normalizeBoardRouteKey', () => {
  it('maps every legacy alias onto its board', () => {
    expect(normalizeBoardRouteKey('Minter Board')).toBe('minter');
    expect(normalizeBoardRouteKey('MINTERS')).toBe('minter');
    expect(normalizeBoardRouteKey('admin-board')).toBe('admin');
    expect(normalizeBoardRouteKey('encryptedBoard')).toBe('admin');
    expect(normalizeBoardRouteKey('MAM')).toBe('ar');
    expect(normalizeBoardRouteKey('addRemoveAdmin')).toBe('ar');
    expect(normalizeBoardRouteKey('nominator-stats')).toBe('stats');
    expect(normalizeBoardRouteKey('forum')).toBe('');
    expect(normalizeBoardRouteKey(undefined)).toBe('');
  });
});

describe('parseBoardRouteHash', () => {
  it('parses the path form with card and section', () => {
    expect(parseBoardRouteHash('#/minter/Minter-board-card-abc123/comments')).toEqual({
      board: 'minter',
      cardIdentifier: 'Minter-board-card-abc123',
      section: 'comments',
      hash: '#/minter/Minter-board-card-abc123/comments',
    });
  });

  it('decodes encoded segments', () => {
    expect(parseBoardRouteHash('#/ar/QM-AR-card-x%20y')?.cardIdentifier).toBe('QM-AR-card-x y');
  });

  it('lets a query on the path form override the segments', () => {
    const route = parseBoardRouteHash('#/minter/one?card=two&section=all');
    expect(route?.cardIdentifier).toBe('two');
    expect(route?.section).toBe('all');
  });

  it('parses the query-only form', () => {
    expect(parseBoardRouteHash('#?board=admin&cardIdentifier=card-MAC-1')).toMatchObject({
      board: 'admin',
      cardIdentifier: 'card-MAC-1',
      section: '',
    });
    expect(parseBoardRouteHash('#board=stats&section=nominator')).toMatchObject({
      board: 'stats',
      section: 'nominator',
    });
  });

  it('returns null for an empty or unrelated hash', () => {
    expect(parseBoardRouteHash('')).toBeNull();
    expect(parseBoardRouteHash('#')).toBeNull();
    expect(parseBoardRouteHash('#?foo=bar')).toBeNull();
  });
});

describe('buildBoardRouteHash', () => {
  it('builds the legacy link form', () => {
    expect(buildBoardRouteHash({ board: 'minters', cardIdentifier: 'a b', section: 'full' })).toBe(
      '#/minter/a%20b/full'
    );
    expect(buildBoardRouteHash({ board: 'stats' })).toBe('#/stats');
    expect(buildBoardRouteHash({ board: 'forum' })).toBe('');
  });
});

describe('legacyHashToPath', () => {
  it('maps board hashes onto React routes', () => {
    expect(legacyHashToPath('#/minter/Minter-board-card-abc/comments')).toBe(
      '/minters/Minter-board-card-abc/comments'
    );
    expect(legacyHashToPath('#/admin/card-MAC-1')).toBe('/admin-board/card-MAC-1');
    expect(legacyHashToPath('#/mam/QM-AR-card-1')).toBe('/mam/QM-AR-card-1');
    expect(legacyHashToPath('#/stats')).toBe('/stats');
    expect(legacyHashToPath('#?board=stats&section=nominator')).toBe('/stats');
  });

  it('ignores a hash that names no board', () => {
    expect(legacyHashToPath('#?card=only')).toBeNull();
    expect(legacyHashToPath('')).toBeNull();
  });
});

describe('legacyPathToPath', () => {
  it('maps the old nav hrefs', () => {
    expect(legacyPathToPath('/MINTERS')).toBe('/minters');
    expect(legacyPathToPath('/render/APP/Q-Mintership+/MINTERSHIP-FORUM')).toBe('/forum');
    expect(legacyPathToPath('/ADDREMOVEADMIN')).toBe('/mam');
    expect(legacyPathToPath('/tools')).toBe('/tools');
    expect(legacyPathToPath('/settings')).toBeNull();
    expect(legacyPathToPath('/')).toBeNull();
  });
});
