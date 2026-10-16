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
  it('opens old cards read-only in History and boards on the screens that replaced them', () => {
    expect(legacyHashToPath('#/minter/Minter-board-card-abc/comments')).toBe(
      '/history/card/Minter-board-card-abc/comments'
    );
    expect(legacyHashToPath('#/admin/card-MAC-1')).toBe('/history/card/card-MAC-1');
    expect(legacyHashToPath('#/mam/QM-AR-card-1')).toBe('/history/card/QM-AR-card-1');
    expect(legacyHashToPath('#/minter')).toBe('/nominations');
    expect(legacyHashToPath('#/admin')).toBe('/decisions');
    expect(legacyHashToPath('#/stats')).toBe('/activity');
    expect(legacyHashToPath('#?board=stats&section=nominator')).toBe('/activity');
  });

  it('ignores a hash that names no board', () => {
    expect(legacyHashToPath('#?card=only')).toBeNull();
    expect(legacyHashToPath('')).toBeNull();
  });
});

describe('legacyPathToPath', () => {
  it('maps the old nav hrefs', () => {
    expect(legacyPathToPath('/MINTERS')).toBe('/nominations');
    expect(legacyPathToPath('/render/APP/Q-Mintership+/MINTERSHIP-FORUM')).toBe('/');
    expect(legacyPathToPath('/ADDREMOVEADMIN')).toBe('/decisions');
    expect(legacyPathToPath('/tools')).toBe('/decisions');
    expect(legacyPathToPath('/STATS')).toBe('/activity');
    expect(legacyPathToPath('/settings')).toBeNull();
    expect(legacyPathToPath('/')).toBeNull();
  });

  it('leaves names alone: only a one-segment path is an old nav href', () => {
    // Tools, Minters and Mintership-Forum are registered names on mainnet.
    expect(legacyPathToPath('/people/Tools')).toBeNull();
    expect(legacyPathToPath('/people/Minters')).toBeNull();
    expect(legacyPathToPath('/people/Mintership-Forum')).toBeNull();
    expect(legacyPathToPath('/explorer/account/Tools')).toBeNull();
    expect(legacyPathToPath('/explorer/account/stats/activity')).toBeNull();
    expect(legacyPathToPath('/render/APP/Q-Mintership+/people/Tools')).toBeNull();
  });
});
