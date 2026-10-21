import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { isStaleBuildError, reloadForNewBuild } from './staleBuild';

const KEY = 'qmintershipplus-stale-build-reload';
const realLocation = window.location;
let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reload = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, reload },
  });
  window.sessionStorage.removeItem(KEY);
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  window.sessionStorage.removeItem(KEY);
  vi.restoreAllMocks();
});

const chunkError = () =>
  new TypeError('Failed to fetch dynamically imported module: /assets/SettingsPage-abc123.js');

function Throws({ error }: { error: Error }): null {
  throw error;
}

describe('a screen from an older build', () => {
  it('knows each browser’s words for a file that could not be loaded', () => {
    expect(isStaleBuildError(chunkError())).toBe(true);
    expect(isStaleBuildError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleBuildError(undefined)).toBe(false);
  });

  it('reloads once, and not again within a minute', () => {
    expect(reloadForNewBuild()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForNewBuild()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('the error boundary says it is loading the new version, and reloads', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Throws error={chunkError()} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Q-Mintership+ was updated. Loading the new version…'
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('just after a reload, or for any other error, shows the message with Retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.sessionStorage.setItem(KEY, String(Date.now()));
    const { unmount } = render(
      <ErrorBoundary>
        <Throws error={chunkError()} />
      </ErrorBoundary>
    );
    expect(screen.getByText('This part of Q-Mintership+ could not be shown.')).toBeVisible();
    expect(reload).not.toHaveBeenCalled();
    unmount();
    render(
      <ErrorBoundary>
        <Throws error={new Error('boom')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('This part of Q-Mintership+ could not be shown.')).toBeVisible();
    expect(reload).not.toHaveBeenCalled();
  });
});
