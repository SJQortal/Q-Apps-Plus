import { afterEach, describe, expect, it } from 'vitest';
import {
  appParam,
  buildAppLink,
  currentQortalAppName,
  normalizeHubPath,
  resolveQdnBase,
} from './hubLocation';

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
    expect(resolveQdnBase('/render/APP/Q-Mintership%2B/minters')).toBe(
      '/render/APP/Q-Mintership%2B'
    );
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
    expect(normalizeHubPath('/render/APP/Q-Mintership+/minters/x?theme=dark#/y')).toBe(
      '/minters/x'
    );
    expect(normalizeHubPath('')).toBe('/');
    expect(normalizeHubPath('minters/')).toBe('/minters');
  });

  it('builds a qortal:// link with a literal + in the app name (Hub never decodes it)', () => {
    expect(buildAppLink('/history/card/Minter-board-card-1')).toBe(
      'qortal://APP/Q-Mintership+/history/card/Minter-board-card-1'
    );
    expect(buildAppLink('/')).toBe('qortal://APP/Q-Mintership+');
  });
});

describe('appParam', () => {
  it("reads the app's own value when Hub appended its query after it", () => {
    const params = new URLSearchParams('?who=QAbc&as=nominator?theme=dark&lang=en');
    expect(appParam(params, 'who')).toBe('QAbc');
    expect(appParam(new URLSearchParams('?as=x&who=QAbc?theme=light'), 'who')).toBe('QAbc');
    expect(appParam(new URLSearchParams('?show=open'), 'show')).toBe('open');
    expect(appParam(new URLSearchParams('?who=?theme=dark'), 'who')).toBeNull();
    expect(appParam(new URLSearchParams(''), 'who')).toBeNull();
  });
});
