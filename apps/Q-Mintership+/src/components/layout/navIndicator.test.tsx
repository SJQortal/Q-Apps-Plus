/**
 * The selected item's highlight in the rail and the bottom bar: a layer of
 * its own on every item, shown on the current page's and faded and shrunk
 * on the others, so a page change glides from one to the next.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { BottomNav } from './BottomNav';
import { NavRail } from './NavRail';

function show(ui: React.ReactNode, path: string) {
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </HubThemeProvider>
  );
}

/** The CSS emotion wrote for an element's own classes, `::before` included. */
function rulesFor(element: Element): string {
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
  const own = [...element.classList].filter((c) => c.startsWith('css-'));
  return own
    .flatMap((c) => css.match(new RegExp(`\\.${c}(::before)?\\{[^}]*\\}`, 'g')) ?? [])
    .join('\n');
}

const layer = (rules: string) => rules.match(/::before\{[^}]*\}/)?.[0] ?? '';

describe('the selected item’s highlight', () => {
  it('in the rail: shown on the current page, faded and shrunk on the others', () => {
    show(<NavRail withDecisions />, '/decisions');
    const current = screen.getByRole('button', { name: /^Decisions/ });
    const other = screen.getByRole('button', { name: /^Home/ });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(layer(rulesFor(current))).toMatch(/opacity:1;scale:1;/);
    expect(layer(rulesFor(other))).toMatch(/opacity:0;scale:0\.92;/);
    // The app's timing (index.css → --qmp-motion-enter).
    expect(layer(rulesFor(other))).toMatch(
      /transition:opacity var\(--qmp-motion-enter\) var\(--qmp-ease-fade\),scale var\(--qmp-motion-enter\) var\(--qmp-ease-enter\);/
    );
  });

  it('in the bottom bar: the pill grows from the middle, the size it was', () => {
    show(<BottomNav withDecisions />, '/decisions');
    const pillOf = (name: RegExp) =>
      screen.getByRole('button', { name }).querySelector('.MuiBadge-root > span') as Element;
    const current = rulesFor(pillOf(/^Decisions/));
    const other = rulesFor(pillOf(/^Home/));
    expect(current).toMatch(/padding:2px 12px;/);
    expect(layer(current)).toMatch(/opacity:1;scale:1;/);
    expect(layer(other)).toMatch(/opacity:0;scale:0\.5 1;/);
  });
});
