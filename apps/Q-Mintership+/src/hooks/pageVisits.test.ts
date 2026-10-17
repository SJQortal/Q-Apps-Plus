/**
 * The app's back stack of page visits: a new visit, the same one (a tab or
 * a filter swapped in place), a return by the app's Back, the browser's or
 * Hub's Back and a trail crumb, views carried on to the same page with
 * another query, and a scroll back that is never recorded as the reader's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentVisit,
  isGoingBack,
  isRestoring,
  noteNavigation,
  notePathDrawn,
  noteScroll,
  popToPage,
  popVisit,
  resetPageVisits,
  restoreScroll,
  stopScrollRestore,
  takeReturned,
  visitBelow,
  visitFor,
  visitPaths,
  VISITS_MAX,
} from './pageVisits';

const A = '/explorer/account/QA';
const A_TXS = '/explorer/account/QA/transactions';
const B = '/explorer/account/QB/connections';
const TX = '/explorer/tx/SIG';

beforeEach(() => resetPageVisits());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('page visits', () => {
  it('pushes a new visit, keeps one for a tab swapped in place, and pops on the browser’s Back', () => {
    noteNavigation(A, 'POP', null);
    noteNavigation(A_TXS, 'REPLACE', { via: 'explorer' });
    expect(visitPaths()).toEqual([A_TXS]);
    expect(currentVisit()?.state).toEqual({ via: 'explorer' });
    noteNavigation(TX, 'PUSH', null);
    expect(visitPaths()).toEqual([A_TXS, TX]);
    expect(takeReturned()).toBeNull();
    // The browser's Back (POP), or Hub's (a PUSH to the previous path).
    const back = noteNavigation(A_TXS, 'POP', null);
    expect(back?.path).toBe(A_TXS);
    expect(takeReturned()).toBe(back);
    expect(takeReturned()).toBeNull();
    expect(visitPaths()).toEqual([A_TXS]);
  });

  it('returns to the visit the app’s Back popped, with its state', () => {
    noteNavigation(A, 'POP', { viaName: 'Avery' });
    noteNavigation(TX, 'PUSH', null);
    const previous = popVisit();
    expect(previous).toMatchObject({ path: A, state: { viaName: 'Avery' } });
    expect(noteNavigation(A, 'PUSH', null)).toBe(previous);
    expect(visitPaths()).toEqual([A]);
    // Nothing below the first visit.
    expect(popVisit()).toBeNull();
  });

  it('goes back to an earlier visit of a page (a trail crumb), dropping the ones after it', () => {
    noteNavigation(A_TXS, 'POP', null);
    noteNavigation(TX, 'PUSH', null);
    noteNavigation(B, 'PUSH', null);
    noteNavigation('/explorer/tx/OTHER', 'PUSH', null);
    const earlier = popToPage(A);
    expect(earlier?.path).toBe(A_TXS);
    noteNavigation(A_TXS, 'PUSH', null);
    expect(visitPaths()).toEqual([A_TXS]);
    expect(popToPage('/explorer/account/QZ')).toBeNull();
  });

  it('finds the visit a page is drawn for before the stack catches up', () => {
    noteNavigation(A_TXS, 'POP', null);
    currentVisit()?.views.set('row', true);
    noteNavigation(TX, 'PUSH', null);
    // Drawn for the browser's Back: the visit below.
    notePathDrawn(A_TXS);
    expect(visitFor()?.views.get('row')).toBe(true);
    // Drawn for a new page: none.
    notePathDrawn(B);
    expect(visitFor()).toBeNull();
    // Drawn for the page on screen.
    notePathDrawn(TX);
    expect(visitFor()).toBe(currentVisit());
  });

  it('matches Hub’s Back by its path alone, and carries views on to the same page with another query', () => {
    noteNavigation('/explorer/transactions?find=avery', 'POP', { via: 'explorer' });
    currentVisit()?.views.set('shown', 150);
    noteNavigation('/explorer/transactions?find=avery&kind=payments', 'PUSH', null);
    expect(currentVisit()?.views.get('shown')).toBe(150);
    noteNavigation(TX, 'PUSH', null);
    expect(visitBelow('/explorer/transactions')?.path).toBe(
      '/explorer/transactions?find=avery&kind=payments'
    );
    expect(visitBelow('/explorer')).toBeNull();
  });

  it('keeps the visit a REPLACE replaces, even when its new path is the one below’s', () => {
    // A name link to the page's own account: PUSH the name, then REPLACE it with the address.
    noteNavigation(A, 'POP', null);
    currentVisit()?.views.set('names:arrived', true);
    noteNavigation('/explorer/account/Carol', 'PUSH', null);
    notePathDrawn(A, 'REPLACE');
    expect(visitFor()).toBe(currentVisit());
    expect(visitFor()?.views.has('names:arrived')).toBe(false);
    // The browser's Back to that path is the visit below.
    notePathDrawn(A, 'POP');
    expect(visitFor()?.views.get('names:arrived')).toBe(true);
  });

  it('says while Back is under way, until the visit returned to is on screen', () => {
    noteNavigation(A, 'POP', null);
    noteNavigation(TX, 'PUSH', null);
    expect(isGoingBack()).toBe(false);
    popVisit();
    expect(isGoingBack()).toBe(true);
    noteNavigation(A, 'PUSH', null);
    expect(isGoingBack()).toBe(false);
  });

  it('keeps the latest visits only', () => {
    for (let i = 0; i < VISITS_MAX + 5; i++) noteNavigation(`/explorer/tx/S${i}`, 'PUSH', null);
    expect(visitPaths()).toHaveLength(VISITS_MAX);
    expect(visitPaths()[0]).toBe('/explorer/tx/S5');
  });

  it('reads the place a page is left at as the next one is drawn, but not over a visit Back returns to', () => {
    let y = 0;
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => y);
    noteNavigation(A, 'POP', null);
    notePathDrawn(A);
    y = 1500;
    // A link to a new page: A is still on screen as it is drawn.
    notePathDrawn(TX);
    noteNavigation(TX, 'PUSH', null);
    y = 0;
    const previous = popVisit();
    expect(previous?.scrollY).toBe(1500);
    // Back already put A on top: the transaction page's place isn't A's.
    y = 300;
    notePathDrawn(A);
    expect(previous?.scrollY).toBe(1500);
  });

  it('records the reader’s scroll on the visit on screen', () => {
    noteNavigation(A, 'POP', null);
    noteScroll(840);
    noteNavigation(TX, 'PUSH', null);
    noteScroll(0);
    expect(popVisit()?.scrollY).toBe(840);
  });
});

describe('the scroll back', () => {
  it('ends on its timer when frames pause, and keeps the place the reader has then', () => {
    vi.useFakeTimers();
    let y = 0;
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => y);
    vi.spyOn(window, 'scrollTo').mockImplementation((() => {}) as typeof window.scrollTo);
    // A hidden frame: no animation frames at all.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    noteNavigation(A, 'POP', null);
    noteScroll(900);
    const visit = currentVisit()!;
    restoreScroll(visit);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'instant' });
    expect(isRestoring()).toBe(true);
    // The reader's scrolling isn't recorded while it runs…
    noteScroll(10);
    expect(visit.scrollY).toBe(900);
    y = 450;
    vi.advanceTimersByTime(3300);
    // …and once it ends, the place they have is the visit's.
    expect(isRestoring()).toBe(false);
    expect(visit.scrollY).toBe(450);
  });

  it('stops for another page, and leaves the visit it was for as it was', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation((() => {}) as typeof window.scrollTo);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    noteNavigation(A, 'POP', null);
    noteScroll(900);
    const visit = currentVisit()!;
    restoreScroll(visit);
    noteNavigation(TX, 'PUSH', null);
    stopScrollRestore();
    expect(isRestoring()).toBe(false);
    expect(visit.scrollY).toBe(900);
  });
});
