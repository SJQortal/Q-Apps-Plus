import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { MarkedName } from './MarkedName';
import { withMarkedName } from './markedText';
import { PersonChip } from './Person';

const BLANK = String.fromCharCode(0x2800);
const ADA = 'QaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaB';

function show(ui: React.ReactNode) {
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <MemoryRouter>{ui}</MemoryRouter>
    </HubThemeProvider>
  );
}

/** The CSS emotion wrote for an element's own class. */
function rulesFor(element: Element): string {
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
  const own = [...element.classList].filter((c) => c.startsWith('css-'));
  return own.flatMap((c) => css.match(new RegExp(`\\.${c}\\{[^}]*\\}`, 'g')) ?? []).join('\n');
}

describe('MarkedName', () => {
  it('crosses out a name with the blank Braille character, in red, and says why', () => {
    const { container } = show(<MarkedName name={`Ada${BLANK}`} />);
    const struck = container.querySelector('s') as HTMLElement;
    expect(struck).not.toBeNull();
    expect(struck.textContent).toBe(`Ada${BLANK} (written with a blank Braille character)`);
    expect(struck.title).toBe('This name is written with a blank Braille character.');
    const css = rulesFor(struck);
    expect(css).toMatch(/text-decoration-line:line-through/);
    expect(css).toMatch(/text-decoration-thickness:2px/);
    // The theme's error colour, never a hex of its own.
    expect(css).toMatch(/text-decoration-color:/);
  });

  it('shows what it is given for the name (dots for blanks), checking the name itself', () => {
    const { container } = show(<MarkedName name={`Ada${BLANK}`}>Ada·</MarkedName>);
    expect(container.querySelector('s')?.textContent).toMatch(/^Ada·/);
  });

  it('leaves every other name as it is', () => {
    const { container } = show(<MarkedName name="Ada" />);
    expect(container.querySelector('s')).toBeNull();
    expect(container.textContent).toBe('Ada');
  });
});

describe('withMarkedName', () => {
  it('crosses out only the name inside a line of text', () => {
    const { container } = show(
      <p>{withMarkedName(`Nominated by Ada${BLANK} today`, `Ada${BLANK}`)}</p>
    );
    expect(container.querySelector('s')?.firstChild?.textContent).toBe(`Ada${BLANK}`);
    expect(container.textContent).toMatch(/^Nominated by Ada.* today$/);
  });

  it('is the plain text for any other name', () => {
    expect(withMarkedName('Nominated by Ada today', 'Ada')).toBe('Nominated by Ada today');
  });
});

describe('PersonChip', () => {
  it('crosses out a person’s name with the character, wherever the app shows people', () => {
    const { container } = show(<PersonChip address={ADA} name={`Ada${BLANK}`} />);
    expect(screen.getByRole('link').querySelector('s')).not.toBeNull();
    expect(container.querySelectorAll('s')).toHaveLength(1);
  });
});
