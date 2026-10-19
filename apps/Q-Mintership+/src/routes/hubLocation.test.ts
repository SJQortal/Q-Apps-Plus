import { afterEach, describe, expect, it } from 'vitest';
import {
  appParam,
  appSearch,
  buildAppLink,
  currentQortalAppName,
  normalizeHubPath,
  resolveQdnBase,
  resolveRouterBase,
  routerBaseForPage,
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

describe('routerBaseForPage', () => {
  const page = (pathname: string) => {
    const state = { pathname, search: '?theme=dark', hash: '' };
    const history = {
      state: null,
      replaceState: (_s: unknown, _t: string, url: string) => {
        const [path, search = ''] = url.split('?');
        state.pathname = path;
        state.search = search ? `?${search}` : '';
      },
    };
    return { location: state as unknown as Location, history: history as unknown as History };
  };

  it("accepts the %2B spelling Hub loads, and rewrites it to Core's", () => {
    const { location, history } = page('/render/APP/Q-Mintership%2B/people/QAbc');
    expect(routerBaseForPage('/render/APP/Q-Mintership+', location, history)).toBe(
      '/render/APP/Q-Mintership+'
    );
    expect(location.pathname).toBe('/render/APP/Q-Mintership+/people/QAbc');
    expect(location.search).toBe('?theme=dark');
  });

  it('keeps a path that already matches, and has no base outside Hub', () => {
    const { location, history } = page('/render/APP/Q-Mintership+/decisions');
    expect(routerBaseForPage('/render/APP/Q-Mintership+', location, history)).toBe(
      '/render/APP/Q-Mintership+'
    );
    expect(routerBaseForPage('', location, history)).toBe('');
  });

  it('matches the app name whatever the case or encoding', () => {
    expect(
      resolveRouterBase('/render/app/q-mintership%2b/history', '/render/APP/Q-Mintership+')
    ).toBe('/render/app/q-mintership%2b');
    expect(resolveRouterBase('/render/APP/Other/history', '/render/APP/Q-Mintership+')).toBe(
      '/render/APP/Q-Mintership+'
    );
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

describe('appSearch', () => {
  it("keeps the app's own query and drops Hub's", () => {
    expect(appSearch('?kind=names&q=ada')).toBe('?kind=names&q=ada');
    expect(appSearch('?kind=names?theme=dark&lang=en')).toBe('?kind=names');
    expect(
      appSearch('?theme=dark&lang=en&identifier=null&time=123&isManualNavigation=false&q=ada')
    ).toBe('?q=ada');
    expect(appSearch('?theme=light&lang=en')).toBe('');
    expect(appSearch('?q=Nora%E2%80%99s%20Shop')).toBe('?q=Nora%E2%80%99s+Shop');
    expect(appSearch('')).toBe('');
  });
});
