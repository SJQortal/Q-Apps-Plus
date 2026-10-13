/**
 * Move focus to something that isn't a control (a section, a card, a
 * heading) after what had focus went away: it gets tabindex="-1" first, so
 * it can take focus without joining the Tab order.
 */
export function focusElement(target: HTMLElement, options: FocusOptions = {}): void {
  if (!target.hasAttribute('tabindex') && target.tabIndex < 0)
    target.setAttribute('tabindex', '-1');
  target.focus(options);
}

/**
 * Before a dialog's buttons go away (a write starts, and only the live region
 * speaks until it ends): focus to the dialog's title, so it doesn't fall to
 * the page and come back to the dialog's frame, which would read it all again
 * over the first stage.
 */
export function focusDialogTitle(inside: Element | null): void {
  const title = inside?.closest('[role="dialog"]')?.querySelector<HTMLElement>('h2');
  if (title) focusElement(title, { preventScroll: true });
}
