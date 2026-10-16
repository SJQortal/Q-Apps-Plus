/**
 * The mock world's strict mode: a GET the world can't answer fails the
 * test, instead of quietly answering 404 "no mock".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderPage } from './render';
import { installWorld } from './world';

afterEach(() => vi.useRealTimers());

const UNMOCKED = '/utils/nothing-here?x=1';

describe('mock world strict mode', () => {
  it('answers 404 "no mock" by default', async () => {
    const { unanswered } = installWorld();
    const res = await fetch(UNMOCKED);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ message: 'no mock for /utils/nothing-here' });
    expect(unanswered).toEqual([]);
  });

  it('rejects the read and lists it when strict', async () => {
    const { unanswered } = installWorld('admin', { strict: true });
    await expect(fetch(UNMOCKED)).rejects.toThrow('no mock for GET /utils/nothing-here?x=1');
    expect(unanswered).toEqual([UNMOCKED]);
    // What the world does answer still works.
    expect((await fetch('/blocks/height')).status).toBe(200);
    unanswered.length = 0; // handled here, so the test may pass
  });

  it.fails('fails the test when an unanswered read is left over', async () => {
    installWorld('admin', { strict: true });
    // The app might swallow the error; the test still fails when it ends.
    await fetch(UNMOCKED).catch(() => undefined);
  });

  it('is passed on by renderPage', async () => {
    const { unanswered } = await renderPage(createElement('div', null, 'page'), {
      strict: true,
    });
    await expect(fetch(UNMOCKED)).rejects.toThrow(/no mock/);
    expect(unanswered).toEqual([UNMOCKED]);
    unanswered.length = 0;
  });
});
