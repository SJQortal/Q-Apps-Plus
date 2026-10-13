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
