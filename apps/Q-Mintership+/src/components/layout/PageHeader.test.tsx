import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { PageHeader } from './PageHeader';
import { resetPageFocus } from './pageFocus';

/** An Explorer account with two tab links that switch the URL in place. */
function AccountTabs() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Ada" />
      <button
        type="button"
        onClick={() => navigate('/explorer/account/QA/names', { replace: true })}
      >
        Names
      </button>
      <button type="button" onClick={() => navigate('/explorer/account/QB')}>
        Another account
      </button>
    </>
  );
}

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
                <Link to="/decisions/abc">A decision</Link>
              </>
            }
          />
          <Route path="/history" element={<PageHeader title="History" />} />
          <Route path="/decisions/:signature" element={<PageHeader title="Decision" />} />
          <Route path="/explorer/account/:who/:tab?" element={<AccountTabs />} />
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

  it('gives a decision’s own page the focus on its title, like any page', async () => {
    app('/');
    await userEvent.setup().click(screen.getByRole('link', { name: 'A decision' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Decision' })).toHaveFocus();
  });

  it('leaves focus on an Explorer account’s tab when only the tab changes', async () => {
    app('/explorer/account/QA');
    const user = userEvent.setup();
    const tab = screen.getByRole('button', { name: 'Names' });
    await user.click(tab);
    // The same account's tab: focus stays where it was.
    expect(tab).toHaveFocus();
    // Another account is another page: its title takes focus.
    await user.click(screen.getByRole('button', { name: 'Another account' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Ada' })).toHaveFocus();
  });
});
