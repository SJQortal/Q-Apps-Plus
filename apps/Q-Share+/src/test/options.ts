/**
 * An option's text as a screen reader has it: without its aria-hidden parts
 * (a suggestion's avatar initial), so "Big Sims" + "In this list" and not "BBig Sims…".
 */
export function optionText(option: Element): string {
  return Array.from(option.childNodes)
    .filter((node) => !(node instanceof Element && node.getAttribute('aria-hidden') === 'true'))
    .map((node) => node.textContent)
    .join('');
}
