import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('render failed');
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the friendly fallback with a Reload button when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Something went wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it('renders its children when nothing throws', () => {
    renderWithProviders(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
