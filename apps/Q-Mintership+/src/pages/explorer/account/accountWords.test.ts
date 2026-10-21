import { beforeEach, describe, expect, it } from 'vitest';
import { resetQueries, setQueryData, staleVersion } from '../../../data/query';
import type { StatusKind } from '../../../rules/status';
import { minterStatusWord, openedFrom } from './accountWords';
import { ACCOUNT_KEY_PREFIXES, NAME_KEY_PREFIXES, refreshAccount } from './refreshAccount';

const A = `Q${'a'.repeat(33)}`;
const B = `Q${'b'.repeat(33)}`;

describe('where an account stands in MINTER (the app’s own words)', () => {
  const word = (kind: StatusKind, wasMember = false) => minterStatusWord({ kind, wasMember });
  it('names each status plainly', () => {
    expect(word('admin')).toBe('Minter Admin');
    expect(word('member')).toBe('MINTER member');
    expect(word('memberNominator')).toBe('MINTER member');
    expect(word('formerBanned')).toBe('Banned from MINTER');
    expect(word('formerLeft')).toBe('Former member');
    expect(word('formerKicked', true)).toBe('Former member');
    // A removed join request isn't a former member.
    expect(word('formerKicked', false)).toBe('Not in MINTER');
    for (const kind of ['newcomer', 'nominated', 'approvedInvite', 'signedOut'] as const)
      expect(word(kind)).toBe('Not in MINTER');
  });
});

describe('the name an account was opened from', () => {
  const names = { names: ['Simon', 'Q-Maps', 'Tools'], truncated: false };
  it('says which of its names it was, unless it was the primary one spelled the same', () => {
    expect(openedFrom({ viaName: 'Q-Maps', matched: 'Q-Maps' }, 'Simon', names)).toEqual({
      viaName: 'Q-Maps',
      matched: null,
      among: ", one of this account's 3 names.",
    });
    expect(openedFrom({ viaName: 'Simon', matched: 'Simon' }, 'Simon', names)).toBeNull();
    expect(openedFrom(null, 'Simon', names)).toBeNull();
  });

  it('says when Core matched another spelling, even of the primary name', () => {
    expect(openedFrom({ viaName: 'T00LS', matched: 'Tools' }, 'Simon', names)?.matched).toBe(
      'Tools'
    );
    expect(openedFrom({ viaName: 'simon', matched: 'Simon' }, 'Simon', names)).toEqual({
      viaName: 'simon',
      matched: 'Simon',
      among: '.',
    });
  });

  it('counts its names carefully, and waits for the primary name', () => {
    const match = { viaName: 'Only', matched: 'Only' };
    expect(openedFrom(match, undefined, names)).toBeNull();
    expect(openedFrom(match, null, { names: ['Only'], truncated: false })?.among).toBe(
      ', the only name this account owns.'
    );
    expect(openedFrom(match, null, undefined)?.among).toBe(", one of this account's names.");
    expect(openedFrom(match, null, { names: Array(500).fill('n'), truncated: true })?.among).toBe(
      ", one of this account's 500+ names."
    );
  });
});

describe('Refresh on an account page', () => {
  beforeEach(() => resetQueries());

  it('marks this account’s reads stale, and nobody else’s', () => {
    const keys = (a: string) => [
      `xacct:${a}`,
      `xnames:${a}`,
      `xtx:${a}:all`,
      `xpay:${a}:sent`,
      `account:${a}`,
      `name:${a}`,
      `status:${a}`,
      `balance:${a}`,
    ];
    for (const key of [...keys(A), ...keys(B), 'xonline', 'group:members', 'xunconf:pkA'])
      setQueryData(key, 1);
    refreshAccount(A, 'pkA');
    for (const key of [...keys(A), 'xunconf:pkA']) expect(staleVersion(key)).toBeGreaterThan(0);
    for (const key of [...keys(B), 'xonline', 'group:members']) expect(staleVersion(key)).toBe(0);
  });

  it('also marks the reads keyed by its names stale: their records and QDN publishes', () => {
    setQueryData(`xnames:${A}`, { names: ['alpha', 'Beta Shop'], truncated: false });
    setQueryData(`xnames:${B}`, { names: ['gamma'], truncated: false });
    const named = (name: string) => [`xnamedata:${name}`, `xqdnname:${name}`];
    for (const key of [...named('alpha'), ...named('Beta Shop'), ...named('gamma')])
      setQueryData(key, 1);
    refreshAccount(A);
    for (const key of [...named('alpha'), ...named('Beta Shop')])
      expect(staleVersion(key)).toBeGreaterThan(0);
    for (const key of named('gamma')) expect(staleVersion(key)).toBe(0);
  });

  it('uses only prefixes some loader writes keys under', () => {
    // Every source file but the tests and the Refresh itself.
    const sources = Object.entries(
      import.meta.glob<string>('../../../**/*.{ts,tsx}', {
        query: '?raw',
        import: 'default',
        eager: true,
      })
    )
      .filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.endsWith('/refreshAccount.ts'))
      .map(([, text]) => text);
    expect(sources.length).toBeGreaterThan(100);
    // A key is written as a template literal: `<prefix>${…}`.
    const written = (prefix: string) => sources.some((text) => text.includes(`\`${prefix}\${`));
    const unused = [...ACCOUNT_KEY_PREFIXES, ...NAME_KEY_PREFIXES].filter(
      (prefix) => !written(prefix)
    );
    expect(unused).toEqual([]);
  });
});
