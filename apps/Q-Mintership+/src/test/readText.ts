/**
 * An element's text as a screen reader gets it: anything aria-hidden (an
 * avatar's decorative first letter) is left out, so a test can compare a
 * line's words exactly (white space collapsed, as toHaveTextContent does).
 */
export function readText(element: Element | null | undefined): string {
  if (!element) return '';
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}
