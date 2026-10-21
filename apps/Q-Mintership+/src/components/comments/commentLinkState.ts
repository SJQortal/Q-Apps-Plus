/**
 * Going to one comment: the router state a comment's link
 * (`/comments/<name>/<identifier>`) opens its decision or nomination with,
 * so the comments there go to that comment, and the going itself (also a
 * reply's quote, to the comment it answers).
 */

/** How long a comment gone to stays highlighted. */
const FLASH_MS = 1600;

/** Go to a comment: scrolled to the middle, focused and briefly highlighted. */
export function goToComment(target: HTMLElement, reduced: boolean): void {
  target.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  target.focus({ preventScroll: true });
  target.dataset.flash = 'true';
  window.setTimeout(() => delete target.dataset.flash, FLASH_MS);
}

export function commentLinkState(identifier: string): { comment: string } {
  return { comment: identifier };
}

/** The comment a page was opened to go to, if any. */
export function commentOfState(state: unknown): string | null {
  const value =
    state && typeof state === 'object' ? (state as { comment?: unknown }).comment : null;
  return typeof value === 'string' && value ? value : null;
}
