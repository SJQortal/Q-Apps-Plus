/**
 * axe-core in jsdom, for the accessibility tests: the same WCAG 2.1 A/AA and
 * best-practice rules as the screenshot check (scripts/screens.mjs), less
 * the ones jsdom can't judge without layout (contrast; the screenshot check
 * covers it in a real browser).
 *
 *   await expectNoAxeViolations(screen.getByRole('dialog'));
 */
import axe from 'axe-core';
import { expect } from 'vitest';

const OFF = {
  // Needs real layout and colours: the screenshot check runs it in Chromium.
  'color-contrast': { enabled: false },
  'color-contrast-enhanced': { enabled: false },
  // A part of a page (a dialog, a card) is checked here, not a whole page.
  region: { enabled: false },
  'page-has-heading-one': { enabled: false },
  'landmark-one-main': { enabled: false },
};

export async function axeViolations(root: Element): Promise<string[]> {
  const result = await axe.run(root, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    },
    rules: OFF,
    resultTypes: ['violations'],
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
  );
}

export async function expectNoAxeViolations(root: Element): Promise<void> {
  expect(await axeViolations(root)).toEqual([]);
}
