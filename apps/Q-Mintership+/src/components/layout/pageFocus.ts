/**
 * Whether the app has shown its first page yet: that one keeps the
 * browser's own focus; every later page takes focus on its title
 * (PageHeader).
 */
let pageShown = false;

/** True the first time (and marks it shown). */
export function isFirstPage(): boolean {
  if (pageShown) return false;
  pageShown = true;
  return true;
}

/** Tests start each render as a fresh app load. */
export function resetPageFocus(): void {
  pageShown = false;
}

/**
 * Focus the page's title (PageHeader's h1, which takes focus without a tab
 * stop or an outline), for a control that goes away as it is pressed ("Mark
 * as seen", "Got it"): the next Tab goes on from the page, not from the top.
 */
export function focusPageTitle(): void {
  (
    document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1')
  )?.focus();
}
