import { afterEach, describe, expect, it } from 'vitest';
import { buildAppLink, currentQortalAppName, normalizeHubPath, resolveQdnBase } from './hubLocation';

type QdnWindow = Window & { _qdnBase?: string; _qdnName?: string };

afterEach(() => {
  delete (window as QdnWindow)._qdnBase;
  delete (window as QdnWindow)._qdnName;
});

describe('resolveQdnBase', () => {
  it('prefers the injected base and strips a trailing slash', () => {
    (window as QdnWindow)._qdnBase = '/render/APP/Q-Mintership+/';
    expect(resolveQdnBase()).toBe('/render/APP/Q-Mintership+');
  });

  it('falls back to the render prefix in the pathname', () => {
    expect(resolveQdnBase('/render/APP/Q-Mintership%2B/minters')).toBe('/render/APP/Q-Mintership%2B');
    expect(resolveQdnBase('/minters')).toBe('');
  });
});

describe('currentQortalAppName', () => {
  it('decodes the injected name so + stays +', () => {
    (window as QdnWindow)._qdnName = 'Q-Mintership%2B';
    expect(currentQortalAppName()).toBe('Q-Mintership+');
  });

  it('defaults to the + app name outside Hub', () => {
    expect(currentQortalAppName()).toBe('Q-Mintership+');
  });
});

describe('normalizeHubPath and buildAppLink', () => {
  it('removes the base, query and hash', () => {
    (window as QdnWindow)._qdnBase = '/render/APP/Q-Mintership+';
    expect(normalizeHubPath('/render/APP/Q-Mintership+/minters/x?theme=dark#/y')).toBe('/minters/x');
    expect(normalizeHubPath('')).toBe('/');
    expect(normalizeHubPath('minters/')).toBe('/minters');
  });

  it('builds a qortal:// link with the app name encoded', () => {
    expect(buildAppLink('/minters/Minter-board-card-1')).toBe(
      'qortal://APP/Q-Mintership%2B/minters/Minter-board-card-1'
    );
    expect(buildAppLink('/')).toBe('qortal://APP/Q-Mintership%2B');
  });
});
