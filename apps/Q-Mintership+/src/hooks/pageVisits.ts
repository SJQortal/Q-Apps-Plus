/**
 * The app's own back stack, one entry per page visit, each remembering how
 * the page was left (Simon, 2026-10-17: "when going back from the rabbit
 * holes I want the views while going back to open where they were left
 * at"): how far down it was scrolled, and the views kept with useViewState
 * (a row opened, Show more, which way the payments go…).
 *
 * Every Hub tab is an iframe in one Hub document, so `window.history` is
 * shared, and the app keeps its own stack (useSafeBack). A visit is
 * returned to by the app's Back, by Hub's Back (a navigation to the
 * previous path), by the browser's Back (POP), and by a trail crumb of an
 * account opened earlier (goBackTo); then its views come back and the page
 * scrolls to where it was. Any other navigation is a new visit, fresh and
 * at its top. Switching an account's tab or narrowing a list (a REPLACE)
 * stays the same visit; the same page opened anew with another query
 * carries its views on.
 *
 * Kept in memory for the session only, at most VISITS_MAX visits.
 */
import { pageKeyOf } from '../routes/paths';

export interface PageVisit {
  /** The path and query it is at (Back goes there). */
  path: string;
  /** Its page (an Explorer account's tabs are one page: routes/paths.ts pageKeyOf). */
  page: string;
  /** The router state it was opened with (Back opens it with the same). */
  state: unknown;
  /** Views kept by useViewState, by id. */
  views: Map<string, unknown>;
  /** How far down it was scrolled, px. */
  scrollY: number;
}

/** Visits kept at most: the oldest are forgotten. */
export const VISITS_MAX = 60;

const stack: PageVisit[] = [];
/** useSafeBack popped the stack and is navigating to the new top. */
let goingBack = false;
/** The visit the last navigation returned to, until its scroll is restored. */
let returned: PageVisit | null = null;
/** A scroll back to where a visit was is under way: its own scrolling isn't recorded. */
let restoring = false;
/** The path the app is being drawn for (notePathDrawn), ahead of the stack. */
let drawing = '';

function pathOf(path: string): string {
  return path.split('?')[0];
}

function visit(path: string, state: unknown): PageVisit {
  return { path, page: pageKeyOf(pathOf(path)), state, views: new Map(), scrollY: 0 };
}

/**
 * Record a navigation (the shell calls this as each location takes over);
 * returns the visit it returned to, or null for a new visit or the same.
 */
export function noteNavigation(
  path: string,
  type: 'POP' | 'PUSH' | 'REPLACE',
  state: unknown
): PageVisit | null {
  const top = stack[stack.length - 1];
  if (goingBack) {
    goingBack = false;
    returned = top ?? null;
    return returned;
  }
  if (type === 'REPLACE' && top) {
    top.path = path;
    top.page = pageKeyOf(pathOf(path));
    top.state = state;
    return null;
  }
  // Returning to the visit below the top: the browser's or Hub's Back.
  if (stack.length > 1 && stack[stack.length - 2].path === path) {
    stack.pop();
    returned = stack[stack.length - 1];
    return returned;
  }
  if (!top || top.path !== path) {
    const next = visit(path, state);
    // The same page with another query: its views go on.
    if (top && top.page === next.page) next.views = new Map(top.views);
    stack.push(next);
    if (stack.length > VISITS_MAX) stack.splice(0, stack.length - VISITS_MAX);
  }
  return null;
}

/**
 * The path the app is being drawn for: the shell says so as it renders,
 * before the pages under it, so a view drawn for a navigation not yet
 * recorded finds the visit it belongs to (visitFor). A new path means the
 * page on screen is being left: how far down it is scrolled is read from
 * it now, while it is still there (scroll events alone can come late, or
 * not at all in a hidden frame). Not when Back has already put the visit
 * returned to on top: it keeps the place it was left at.
 */
export function notePathDrawn(path: string): void {
  if (path !== drawing && !goingBack && typeof window !== 'undefined') noteScroll(window.scrollY);
  drawing = path;
}

/**
 * The visit below the top when `pathname` is its path's, query aside: Hub's
 * Back is a navigation to the previous path, and Hub keeps no query.
 */
export function visitBelow(pathname: string): PageVisit | null {
  const below = stack[stack.length - 2];
  return below && pathOf(below.path) === pathname ? below : null;
}

/** The visit being returned to, once: the shell scrolls there. */
export function takeReturned(): PageVisit | null {
  const visitBack = returned;
  returned = null;
  return visitBack;
}

/**
 * The visit a page being drawn for `path` (by default the one the shell is
 * drawing) belongs to, before the stack has caught up with the navigation:
 * the top (the same visit, a tab or a query switched in place, or the one
 * useSafeBack returned to), the one below it (the browser's or Hub's
 * Back), or none (a new visit).
 */
export function visitFor(path: string = drawing): PageVisit | null {
  const top = stack[stack.length - 1];
  if (!top) return null;
  if (top.path === path || top.page === pageKeyOf(pathOf(path))) return top;
  const below = stack[stack.length - 2];
  if (below && below.path === path) return below;
  return null;
}

/** The visit on screen now. */
export function currentVisit(): PageVisit | null {
  return stack[stack.length - 1] ?? null;
}

/** The previous visit, popped: its path and state to navigate to, or null at the bottom. */
export function popVisit(): PageVisit | null {
  if (stack.length < 2) return null;
  stack.pop();
  goingBack = true;
  return stack[stack.length - 1];
}

/**
 * Back to the latest earlier visit of `page` (a trail crumb), dropping the
 * visits after it: the visit to navigate to, or null when there is none.
 */
export function popToPage(page: string): PageVisit | null {
  for (let i = stack.length - 2; i >= 0; i--) {
    if (stack[i].page !== page) continue;
    stack.length = i + 1;
    goingBack = true;
    return stack[i];
  }
  return null;
}

/** How far down the visit on screen is scrolled (the shell's scroll listener). */
export function noteScroll(y: number): void {
  if (restoring) return;
  const top = stack[stack.length - 1];
  if (top) top.scrollY = y;
}

/** Whether a scroll back is under way. */
export function isRestoring(): boolean {
  return restoring;
}

/** The page's height stays put this long at the place returned to before the scroll back ends. */
const SETTLE_MS = 400;
/** How often the scroll back looks again while the app is hidden. */
const HIDDEN_STEP_MS = 100;
/** The scroll back under way: a new one, a navigation or a reset stops it. */
let stopRestore: (() => void) | null = null;

/**
 * Scroll back to where `visit` was left and hold it there while the page
 * is still coming in (lists drawn from the session's reads, lazy parts,
 * pictures): on each frame (every HIDDEN_STEP_MS while the app is hidden),
 * until the page's height has stayed put for SETTLE_MS at that place, for
 * up to `ms` (a timer ends it too, whatever happens to frames). Any wheel, touch, key or pointer
 * press stops it, so it never fights the reader; so does a navigation
 * (stopScrollRestore). Once it ends, the place the reader has is the
 * visit's, while it is still the one on screen.
 */
export function restoreScroll(visit: PageVisit, ms = 3000): void {
  if (typeof window === 'undefined') return;
  stopScrollRestore();
  const y = visit.scrollY;
  const started = performance.now();
  let settledAt = started;
  let height = -1;
  restoring = true;
  let done = false;
  const stopEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  const finish = () => {
    if (done) return;
    done = true;
    restoring = false;
    stopRestore = null;
    clearTimeout(timer);
    for (const name of stopEvents) window.removeEventListener(name, finish, true);
    if (stack[stack.length - 1] === visit) visit.scrollY = window.scrollY;
  };
  const timer = setTimeout(finish, ms + 200);
  stopRestore = finish;
  for (const name of stopEvents)
    window.addEventListener(name, finish, { capture: true, passive: true });
  const step = () => {
    if (done) return;
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: 'instant' });
    const now = performance.now();
    const nextHeight = document.documentElement.scrollHeight;
    if (nextHeight !== height) {
      height = nextHeight;
      settledAt = now;
    }
    const there = Math.abs(window.scrollY - y) <= 1;
    if ((there && now - settledAt >= SETTLE_MS) || now - started > ms) return finish();
    // Frames don't come while the app is hidden (another Hub tab in front): a timer then.
    if (document.hidden) setTimeout(step, HIDDEN_STEP_MS);
    else requestAnimationFrame(step);
  };
  step();
}

/** Stop a scroll back under way (another page is opening). */
export function stopScrollRestore(): void {
  stopRestore?.();
}

/** Tests: forget every visit. */
export function resetPageVisits(): void {
  stopScrollRestore();
  stack.length = 0;
  goingBack = false;
  returned = null;
  restoring = false;
  drawing = '';
}

/** Tests: the paths on the stack, oldest first. */
export function visitPaths(): string[] {
  return stack.map((entry) => entry.path);
}
