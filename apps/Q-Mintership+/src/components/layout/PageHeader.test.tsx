import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { PageHeader } from './PageHeader';
import { resetPageFocus } from './pageFocus';

function app(start: string) {
  resetPageFocus();
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <PageHeader title="Home" />
                <Link to="/history">History</Link>
                <Link to="/decisions?d=abc">A decision</Link>
              </>
            }
          />
          <Route path="/history" element={<PageHeader title="History" />} />
          <Route path="/decisions" element={<PageHeader title="Decisions" />} />
        </Routes>
      </MemoryRouter>
    </HubThemeProvider>
  );
}

describe('PageHeader on a route change', () => {
  it('moves focus to the new page’s title and names the document after it', async () => {
    app('/');
    const home = screen.getByRole('heading', { level: 1, name: 'Home' });
    // The first page keeps the browser's focus.
    expect(home).not.toHaveFocus();
    expect(document.title).toBe('Home · Q-Mintership+');
    await userEvent.setup().click(screen.getByRole('link', { name: 'History' }));
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toHaveFocus();
    expect(document.title).toBe('History · Q-Mintership+');
  });

  it('leaves focus to the decision a ?d= link opens', async () => {
    app('/');
    await userEvent.setup().click(screen.getByRole('link', { name: 'A decision' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Decisions' })).not.toHaveFocus();
  });
});
