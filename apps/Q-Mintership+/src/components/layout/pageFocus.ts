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
