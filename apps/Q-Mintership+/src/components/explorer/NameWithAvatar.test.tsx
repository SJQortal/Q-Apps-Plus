import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { resetQueries } from '../../data/query';
import { NameWithAvatar } from './NameWithAvatar';

function show(ui: React.ReactNode) {
  resetQueries();
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      {ui}
    </HubThemeProvider>
  );
}

describe('NameWithAvatar', () => {
  it('shows the name’s own avatar beside it, hidden from screen readers', () => {
    show(
      <p>
        Bought the name <NameWithAvatar name="Q-Maps" quoted /> from Bob
      </p>
    );
    const line = screen.getByText(/Bought the name/);
    const avatar = line.querySelector('[aria-hidden="true"]');
    expect(avatar?.textContent).toBe('Q');
    expect(screen.getByText('Q-Maps').tagName).toBe('BDI');
    // The line reads as its words: no letter, no extra gap.
    const clone = line.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
    expect(clone.textContent).toBe('Bought the name “Q-Maps” from Bob');
  });

  it('keeps a suffix with the name, so a link reads "Bob’s nomination"', () => {
    show(
      <a href="/nominations/x">
        <NameWithAvatar name="Bob" suffix="’s" /> nomination
      </a>
    );
    expect(screen.getByRole('link', { name: 'Bob’s nomination' })).toBeInTheDocument();
  });

  it('shows invisible characters as dots', () => {
    show(<NameWithAvatar name={'a\u200Bb'} />);
    expect(screen.getByText('a·b')).toBeInTheDocument();
  });
});
