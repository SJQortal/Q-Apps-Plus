import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { HubThemeProvider } from '../hub-theme';
import { ToastProvider } from '../components/Toast';
import { themeConfig, THEME_STORAGE_KEY } from '../theme/qplus-theme';

export function Providers({ children, route = '/' }: { children: ReactNode; route?: string }) {
  return (
    <JotaiProvider>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </ToastProvider>
      </HubThemeProvider>
    </JotaiProvider>
  );
}

export function renderWithProviders(ui: ReactElement, route = '/') {
  return render(<Providers route={route}>{ui}</Providers>);
}
