import { afterEach, describe, expect, it } from 'vitest';
import { currentQortalAppName, hubDisplayPath, normalizeHubPath, resolveQdnBase } from './hubLocation';

afterEach(() => {
  delete window._qdnBase;
  delete window._qdnName;
  window.history.replaceState(null, '', '/');
});

describe('hubLocation', () => {
  it('finds the render base from the URL and strips it from paths', () => {
    window.history.replaceState(null, '', '/render/APP/Q-Apps+/app/Q-Mail%2B?theme=dark');
    expect(resolveQdnBase()).toBe('/render/APP/Q-Apps+');
    expect(currentQortalAppName()).toBe('Q-Apps+');
    expect(normalizeHubPath('/render/APP/Q-Apps+/app/Q-Mail%2B?theme=dark')).toBe('/app/Q-Mail%2B');
    expect(hubDisplayPath('/render/APP/Q-Apps+/')).toBe('');
    expect(hubDisplayPath('/render/APP/Q-Apps+/index.html')).toBe('');
  });

  it('prefers what Hub injects', () => {
    window._qdnBase = '/render/APP/Q-Apps%2B/';
    window._qdnName = 'Q-Apps+';
    expect(resolveQdnBase()).toBe('/render/APP/Q-Apps%2B');
    expect(currentQortalAppName()).toBe('Q-Apps+');
    expect(normalizeHubPath('/render/APP/Q-Apps%2B/settings/')).toBe('/settings');
  });

  it('is a no-op outside Hub', () => {
    expect(resolveQdnBase()).toBe('');
    expect(currentQortalAppName()).toBe('Q-Apps+');
    expect(normalizeHubPath('/settings?x=1')).toBe('/settings');
    expect(hubDisplayPath('/')).toBe('');
  });
});
