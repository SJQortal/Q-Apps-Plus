import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { PersonChip, PersonInline } from './Person';

const ADA = 'QaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaB';

function show(ui: React.ReactNode) {
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <MemoryRouter>{ui}</MemoryRouter>
    </HubThemeProvider>
  );
}

/** The CSS emotion wrote for an element's own class. */
function rulesFor(element: Element, pseudo = ''): string {
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
  const own = [...element.classList].filter((c) => c.startsWith('css-'));
  return own
    .flatMap((c) => css.match(new RegExp(`\\.${c}${pseudo}\\{[^}]*\\}`, 'g')) ?? [])
    .join('\n');
}

describe('PersonChip: a 44 px tap target', () => {
  it('the whole chip, at least 44 px tall, is the link’s tap area; the link is still the name', () => {
    show(<PersonChip address={ADA} name="Ada" size={28} secondary="Level 3" />);
    const link = screen.getByRole('link', { name: 'Ada: open their page' });
    // Only the name is the link's content, so the second line is still read on its own.
    expect(link).toHaveTextContent(/^Ada$/);
    expect(screen.getByText('Level 3')).not.toBeNull();
    expect(link.contains(screen.getByText('Level 3'))).toBe(false);
    // Its ::after covers the chip, which is at least 44 px tall.
    expect(rulesFor(link, '::after')).toMatch(/position:absolute;[^}]*inset:0/);
    const chip = link.closest('div[class*="css-"]')?.parentElement as HTMLElement;
    expect(rulesFor(chip)).toMatch(/position:relative/);
    expect(rulesFor(chip)).toMatch(/min-height:44px/);
  });

  it('a person inside a sentence stays a plain link at the text’s size', () => {
    show(<PersonInline address={ADA} name="Ada" />);
    const link = screen.getByRole('link', { name: 'Ada: open their page' });
    expect(rulesFor(link, '::after')).toBe('');
  });
});
