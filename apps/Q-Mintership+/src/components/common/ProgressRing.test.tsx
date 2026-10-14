import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { ProgressRing } from './ProgressRing';

function show(ui: React.ReactNode) {
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      {ui}
    </HubThemeProvider>
  );
}

/** The CSS emotion wrote for an element's own class. */
function rulesFor(element: Element): string {
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
  const own = [...element.classList].filter((c) => c.startsWith('css-'));
  return own.flatMap((c) => css.match(new RegExp(`\\.${c}\\{[^}]*\\}`, 'g')) ?? []).join('\n');
}

describe('ProgressRing: the target', () => {
  it('reads "of 8" at 14 px on the 56 px ring of cards and pages', () => {
    show(<ProgressRing value={5} target={8} size={56} />);
    expect(rulesFor(screen.getByText('of 8'))).toMatch(/font-size:14px;[^}]*line-height:1;/);
  });

  it('grows with a larger ring, and leaves smaller rings as they were', () => {
    show(
      <>
        <ProgressRing value={5} target={8} size={64} />
        <ProgressRing value={3} target={9} size={48} />
      </>
    );
    expect(rulesFor(screen.getByText('of 8'))).toMatch(/font-size:16px;/);
    expect(rulesFor(screen.getByText('of 9'))).toMatch(/font-size:11px;[^}]*line-height:1\.1;/);
  });

  it('keeps its full label for screen readers, the numbers inside hidden', () => {
    show(<ProgressRing value={100} target={99} pending={2} />);
    const ring = screen.getByRole('img', { name: '100 of 99 signatures, 2 confirming' });
    expect(screen.getByText('of 99').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(ring).toContainElement(screen.getByText('of 99'));
  });
});
