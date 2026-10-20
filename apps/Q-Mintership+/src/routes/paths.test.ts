import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { appLink } from '../utils/links';
import { explorerRoutes } from './explorerRoutes';
import { notifyHubDisplayedPath } from './hubLocation';
import {
  adminPollPath,
  decisionPath,
  explorerAccountPath,
  explorerComparePath,
  explorerFundedPath,
  explorerSponseesPath,
  explorerTabOf,
  explorerTransactionsPath,
  explorerTxPath,
  legacyDecisionPath,
  nominationPath,
  pageKeyOf,
  PATHS,
} from './paths';

describe('a Minter Admin poll’s path', () => {
  it('is /decisions/polls/<id>, copied as a qortal:// link with a literal +', () => {
    expect(adminPollPath('lvl5adm1')).toBe('/decisions/polls/lvl5adm1');
    expect(appLink(adminPollPath('lvl5adm1'))).toBe(
      'qortal://APP/Q-Mintership+/decisions/polls/lvl5adm1'
    );
  });
});

const SIG =
  '4mYb2yQkXvJ1sL9pW3tE7uN5rC8dF6gH2jK4mZ1xA9bV3nQ7wE5rT8yU2io6pL1aS3dF5gH7jK9LZ2xC4vB6nM8';
const ADDRESS = 'QgFT6iVhw2ZsyjGrFVnWQn5JQSzhKk1cnG';
const OTHER = 'QaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaB';

describe('shareable paths', () => {
  it('gives every decision and nomination its own path', () => {
    expect(decisionPath(SIG)).toBe(`/decisions/${SIG}`);
    expect(decisionPath()).toBe(PATHS.decisions);
    expect(nominationPath(ADDRESS)).toBe(`/nominations/${ADDRESS}`);
  });

  it('copies them as qortal://APP/Q-Mintership+/… links, with a literal +', () => {
    expect(appLink(decisionPath(SIG))).toBe(`qortal://APP/Q-Mintership+/decisions/${SIG}`);
    expect(appLink(nominationPath(ADDRESS))).toBe(
      `qortal://APP/Q-Mintership+/nominations/${ADDRESS}`
    );
  });

  it('sends an old /decisions?d=<signature> link to the decision’s own path', () => {
    expect(legacyDecisionPath(`?d=${SIG}`)).toBe(`/decisions/${SIG}`);
    expect(legacyDecisionPath(`?d=${SIG}?theme=dark&lang=en`)).toBe(`/decisions/${SIG}`);
    expect(legacyDecisionPath('?as=admin&d=abc')).toBe('/decisions/abc');
    expect(legacyDecisionPath('')).toBeNull();
    expect(legacyDecisionPath('?d=')).toBeNull();
  });
});

describe('Hub learns the path on screen', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'parent');
  afterEach(() => {
    if (original) Object.defineProperty(window, 'parent', original);
  });

  it('reports a decision’s and a nomination’s path, so Hub’s own Copy link matches', () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage } });
    notifyHubDisplayedPath(decisionPath(SIG));
    notifyHubDisplayedPath(`${nominationPath(ADDRESS)}?as=admin`);
    expect(postMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'QDN_RESOURCE_DISPLAYED',
        service: 'APP',
        name: 'Q-Mintership+',
        path: `/decisions/${SIG}`,
      }),
      '*'
    );
    expect(postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: `/nominations/${ADDRESS}` }),
      '*'
    );
  });

  it('reports a Minter Admin poll’s path the same way', () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage } });
    notifyHubDisplayedPath(`${adminPollPath('lvl5adm1')}?as=admin`);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QDN_RESOURCE_DISPLAYED',
        name: 'Q-Mintership+',
        path: '/decisions/polls/lvl5adm1',
      }),
      '*'
    );
  });
});

describe('the Explorer’s paths', () => {
  it('puts accounts, compare, transactions and set views in path segments', () => {
    expect(PATHS.explorer).toBe('/explorer');
    expect(explorerAccountPath(ADDRESS)).toBe(`/explorer/account/${ADDRESS}`);
    expect(explorerAccountPath(ADDRESS, 'overview')).toBe(`/explorer/account/${ADDRESS}`);
    expect(explorerAccountPath(ADDRESS, 'names')).toBe(`/explorer/account/${ADDRESS}/names`);
    expect(explorerComparePath([ADDRESS, OTHER])).toBe(`/explorer/compare/${ADDRESS}/${OTHER}`);
    expect(explorerTxPath(SIG)).toBe(`/explorer/tx/${SIG}`);
    expect(explorerTransactionsPath()).toBe('/explorer/transactions');
    expect(explorerSponseesPath(ADDRESS)).toBe(`/explorer/sponsees/${ADDRESS}`);
    expect(explorerFundedPath(ADDRESS)).toBe(`/explorer/funded/${ADDRESS}`);
    // A name typed into the URL is only input; it is encoded like any segment.
    expect(explorerAccountPath('bob+builder / x')).toBe(
      '/explorer/account/bob%2Bbuilder%20%2F%20x'
    );
  });

  it('copies an account’s page as a qortal:// link with a literal +', () => {
    expect(appLink(explorerAccountPath(ADDRESS, 'connections'))).toBe(
      `qortal://APP/Q-Mintership+/explorer/account/${ADDRESS}/connections`
    );
  });

  it('reads a tab segment, and shows Overview for none or an unknown one', () => {
    expect(explorerTabOf(undefined)).toBe('overview');
    expect(explorerTabOf('names')).toBe('names');
    expect(explorerTabOf('mintership')).toBe('mintership');
    expect(explorerTabOf('Names')).toBe('overview');
    expect(explorerTabOf('wallet')).toBe('overview');
  });

  it('treats an account’s tabs as one page, and everything else as its own', () => {
    const page = `/explorer/account/${ADDRESS}`;
    expect(pageKeyOf(page)).toBe(page);
    expect(pageKeyOf(`${page}/names`)).toBe(page);
    expect(pageKeyOf(`${page}/transactions`)).toBe(page);
    expect(pageKeyOf(`${page}/`)).toBe(page);
    expect(pageKeyOf(`/explorer/account/${OTHER}/names`)).not.toBe(page);
    for (const path of [
      '/',
      '/explorer',
      `/explorer/compare/${ADDRESS}/${OTHER}`,
      `/explorer/tx/${SIG}`,
      `/people/${ADDRESS}`,
      `/decisions/${SIG}`,
      '/history/card/abc/comments',
    ])
      expect(pageKeyOf(path)).toBe(path);
  });

  it('every Explorer path finds its page above the catch-all', () => {
    const routes = [{ path: '/', children: [...explorerRoutes, { path: '*' }] }];
    const leaf = (path: string) => {
      const matches = matchRoutes(routes, path) ?? [];
      const last = matches[matches.length - 1];
      return { route: last?.route.path, params: last?.params };
    };
    expect(leaf('/explorer').route).toBe('explorer');
    expect(leaf(explorerAccountPath(ADDRESS))).toMatchObject({
      route: 'explorer/account/:who/:tab?',
      params: { who: ADDRESS },
    });
    expect(leaf(explorerAccountPath(ADDRESS, 'names')).params).toMatchObject({
      who: ADDRESS,
      tab: 'names',
    });
    expect(leaf('/explorer/account/bob%2Bbuilder').params).toMatchObject({ who: 'bob+builder' });
    expect(leaf(explorerComparePath([ADDRESS, OTHER, ADDRESS])).params).toMatchObject({
      '*': `${ADDRESS}/${OTHER}/${ADDRESS}`,
    });
    expect(leaf(explorerTxPath(SIG))).toMatchObject({
      route: 'explorer/tx/:signature',
      params: { signature: SIG },
    });
    expect(leaf(explorerTransactionsPath()).route).toBe('explorer/transactions');
    expect(leaf(explorerSponseesPath(ADDRESS)).route).toBe('explorer/sponsees/:address');
    expect(leaf(explorerFundedPath(ADDRESS)).route).toBe('explorer/funded/:address');
    expect(leaf('/explorer/nowhere').route).toBe('*');
  });
});
