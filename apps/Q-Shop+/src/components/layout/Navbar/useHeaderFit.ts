/**
 * Keeps the header on one line without its pieces running into each other.
 * Its width depends on the account's name, the seller's QORT rate and
 * whether Names shows, so fixed breakpoints overlapped on some (2026-10-25:
 * "Manage Shop" under the rate at 1280 px with a long name, everything at
 * 700 px, the favourites heart cut off on a 360 px phone). Instead it
 * measures: the first of these that fits wins, each dropping a little more
 * (Navbar-styles HeaderInner reads `data-fit`):
 *
 *   icons   the navigation keeps its names, not its icons
 *   name    the account button keeps its avatar
 *   prefix  the rate without "1 QORT ="
 *   title   the logo without "Q-Shop+"
 *   rate    the rate's icon alone
 *
 * and when none does on desktop, the navigation moves to a row of its own
 * under the rest (`rows`), trying the same again from the start. (Phones
 * have no navigation up here, and hide the name and "1 QORT =" anyway.)
 */
import { type RefObject, useLayoutEffect } from "react";

const STEPS = ["icons", "name", "prefix", "title", "rate"] as const;

function fits(header: HTMLElement, rows: boolean): boolean {
  const nav = header.querySelector("nav");
  if (nav && nav.scrollWidth > nav.clientWidth + 1) return false;
  const first = header.firstElementChild?.getBoundingClientRect();
  const last = header.lastElementChild?.getBoundingClientRect();
  if (!first || !last) return true;
  // The actions (last) end at the padding; a few pixels into it is fine (the last button's icon has room of its own).
  const end = header.getBoundingClientRect().right - (parseFloat(getComputedStyle(header).paddingRight) || 0);
  if (last.right > end + 4) return false;
  // Two rows: the logo and the actions share the first.
  return !rows || Math.abs(first.top + first.height / 2 - (last.top + last.height / 2)) < 12;
}

/** Sets the header's `data-fit` to the first arrangement that fits, and returns it. */
export function fitHeader(header: HTMLElement, canUseRows: boolean): string {
  for (const rows of canUseRows ? [false, true] : [false]) {
    for (let level = 0; level <= STEPS.length; level++) {
      const fit = [...STEPS.slice(0, level), ...(rows ? ["rows"] : [])].join(" ");
      header.dataset.fit = fit;
      if (fits(header, rows)) return fit;
    }
  }
  // Still too narrow: everything dropped (on desktop, two rows with a navigation that scrolls sideways).
  return header.dataset.fit ?? "";
}

/** `rows`: the header has a navigation that may take a row of its own (desktop). */
export function useHeaderFit(ref: RefObject<HTMLElement | null>, rows: boolean): void {
  useLayoutEffect(() => {
    const header = ref.current;
    if (!header) return;
    // Once now, before the first paint; then once a frame after a resize, a
    // change inside (the name arriving, the rate showing, Names switched off)
    // or a font swap. (Fitting inside the observer's own callback would resize
    // what it observes, which browsers report as a loop.)
    fitHeader(header, rows);
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitHeader(header, rows));
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(later);
    resize?.observe(header);
    const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver(later);
    mutations?.observe(header, { subtree: true, childList: true, characterData: true });
    document.fonts?.ready.then(later, () => {});
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutations?.disconnect();
    };
  }, [ref, rows]);
}
