import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { HubThemeProvider } from '../hub-theme';
import { createAppStore } from '../state/store';
import { THEME_STORAGE_KEY, themeConfig } from '../theme/qplus-theme';

/**
 * Render a component inside the app's providers (a fresh Redux store unless
 * one is passed, the theme kit, a router). Pass `initialEntries` to start on
 * a route. Returns the store too.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & {
    initialEntries?: MemoryRouterProps['initialEntries'];
    store?: ReturnType<typeof createAppStore>;
  } = {}
) {
  const { initialEntries, store = createAppStore(), ...rest } = options;
  const result = render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <RouterProvider router={createMemoryRouter([{ path: '*', element: ui }], { initialEntries })} />
      </HubThemeProvider>
    </Provider>,
    rest
  );
  return { ...result, store };
}
