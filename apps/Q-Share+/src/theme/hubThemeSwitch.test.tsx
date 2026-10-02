import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';
import { HubThemeProvider, useHubTheme } from '../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from './qplus-theme';

function Probe() {
  const { hostMode } = useHubTheme();
  const theme = useTheme();
  return <p>{`${hostMode}/${theme.palette.mode}`}</p>;
}

const post = (data: unknown) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });

describe("Hub's light/dark switch", () => {
  afterEach(() => {
    delete (window as Window & { _qdnTheme?: string })._qdnTheme;
    localStorage.clear();
  });

  it('follows THEME_CHANGED without a reload, and ignores other messages', () => {
    (window as Window & { _qdnTheme?: string })._qdnTheme = 'dark';
    render(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <Probe />
      </HubThemeProvider>
    );
    expect(screen.getByText('dark/dark')).toBeInTheDocument();

    post({ action: 'THEME_CHANGED', theme: 'light', requestedHandler: 'UI' });
    expect(screen.getByText('light/light')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');

    post({ action: 'THEME_CHANGED', theme: 'sepia' });
    post({ action: 'NAVIGATE_TO_PATH', path: '/' });
    expect(screen.getByText('light/light')).toBeInTheDocument();

    post({ action: 'THEME_CHANGED', theme: 'dark' });
    expect(screen.getByText('dark/dark')).toBeInTheDocument();
  });
});
