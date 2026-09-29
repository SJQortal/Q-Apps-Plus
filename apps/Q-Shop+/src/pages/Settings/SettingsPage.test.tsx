import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme';
import { store } from '../../state/store';
import { SettingsPage } from './SettingsPage';
import { SETTINGS_STORAGE_KEY } from '../../utils/settingsStorage';

function renderSettings() {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <SettingsPage />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  );
}

describe('SettingsPage', () => {
  it('shows the four sections and the version', () => {
    renderSettings();
    for (const name of ['Account', 'Appearance', 'Shop', 'About']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByText(/Q-Shop\+ 1\.0\.0-plus\.1/)).toBeInTheDocument();
  });

  it('switches theme from the picker and saves it', () => {
    renderSettings();
    const black = screen.getByRole('radio', { name: /Black/ });
    fireEvent.click(black);
    expect(black).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(JSON.stringify('black'));
    expect(document.documentElement.getAttribute('data-ui-theme')).toBe('black');
  });

  it('opens the changelog dialog', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /What's new/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Q-Shop+ first release');
  });

  it('persists the preferred coin', () => {
    renderSettings();
    store.dispatch({ type: 'store/setPreferredCoin', payload: 'ARRR' });
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')).toEqual({ preferredCoin: 'ARRR' });
    store.dispatch({ type: 'store/setPreferredCoin', payload: 'QORT' });
  });
});
