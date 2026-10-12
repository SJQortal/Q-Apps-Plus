import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { HubThemeProvider } from '../hub-theme';
import { store } from '../state/store';
import { THEME_STORAGE_KEY, themeConfig } from '../theme/qplus-theme';

/**
 * Render a component inside the app's providers (Redux store, theme kit,
 * router). Pass `initialEntries` to start on a route.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { initialEntries?: MemoryRouterProps['initialEntries'] } = {}
) {
  const { initialEntries, ...rest } = options;
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </HubThemeProvider>
    </Provider>,
    rest
  );
}
