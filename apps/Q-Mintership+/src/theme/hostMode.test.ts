import { afterEach, describe, expect, it } from 'vitest';
import { HOST_MODE_KEY, noteHostMode, readHostMode, resetHostModeForTests } from '../hub-theme';

/** Load the page at `search`, with Core's injected `_qdnTheme`. */
function load(search: string, injected?: string) {
  window.history.replaceState(null, '', `/${search}`);
  (window as Window & { _qdnTheme?: string })._qdnTheme = injected;
  resetHostModeForTests();
}

afterEach(() => {
  load('');
  window.localStorage.removeItem(HOST_MODE_KEY);
});

describe("Hub's light/dark mode across reloads", () => {
  it('takes the URL’s theme, and remembers it', () => {
    load('?theme=dark&lang=en', 'dark');
    expect(readHostMode()).toBe('dark');
    expect(window.localStorage.getItem(HOST_MODE_KEY)).toBe('dark');
  });

  it('a reload after in-app navigation (no theme, Core injects "light") keeps the remembered mode', () => {
    load('?theme=dark', 'dark');
    readHostMode();
    // The router changed the path and dropped the query; Core's default is "light".
    load('', 'light');
    expect(readHostMode()).toBe('dark');
  });

  it('what Hub posts while the app is open wins over the URL, and is remembered', () => {
    load('?theme=dark', 'dark');
    noteHostMode('light');
    expect(readHostMode()).toBe('light');
    load('', 'light');
    expect(readHostMode()).toBe('light');
  });

  it('with nothing remembered: the injected mode, else dark (outside Hub)', () => {
    load('', 'light');
    expect(readHostMode()).toBe('light');
    load('');
    expect(readHostMode()).toBe('dark');
  });
});
