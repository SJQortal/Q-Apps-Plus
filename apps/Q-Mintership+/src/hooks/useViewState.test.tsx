/**
 * Back from a rabbit hole (Simon, 2026-10-17): a page returned to by the
 * app's Back, the browser's or Hub's opens as it was left (what was opened,
 * where it was scrolled); the same page opened anew starts fresh; views
 * under one scope don't meet those under another.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router-dom';
import { ViewScope } from '../components/common/ViewScope';
import { useSafeBack, useTrackInAppHistory } from './useSafeBack';
import { useScrollTopOnNewPage } from './useScrollTopOnNewPage';
import { useViewState } from './useViewState';

function Shell() {
  useTrackInAppHistory();
  useScrollTopOnNewPage();
  return <Outlet />;
}

function Toggle({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useViewState(id, false);
  return (
    <button type="button" aria-pressed={open} onClick={() => setOpen((value) => !value)}>
      {label}
    </button>
  );
}

function ListPage() {
  return (
    <>
      <Toggle id="row:1" label="Row 1" />
      <ViewScope name="dialog">
        <Toggle id="row:1" label="Row 1 in the dialog" />
      </ViewScope>
      <Link to="/item">Open the item</Link>
    </>
  );
}

function ItemPage() {
  const back = useSafeBack('/');
  return (
    <>
      <button type="button" onClick={back}>
        Back
      </button>
      <Link to="/other">Somewhere else</Link>
    </>
  );
}

function OtherPage() {
  return <Link to="/list">The list again</Link>;
}

let scrollY = 0;

function setup() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Shell />,
        children: [
          { path: 'list', element: <ListPage /> },
          { path: 'item', element: <ItemPage /> },
          { path: 'other', element: <OtherPage /> },
        ],
      },
    ],
    { initialEntries: ['/list'] }
  );
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

/** The reader scrolls the window to `y`. */
function scrollTo(y: number) {
  scrollY = y;
  window.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
  scrollY = 0;
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
  vi.spyOn(window, 'scrollTo').mockImplementation(((options: ScrollToOptions | number) => {
    scrollY = typeof options === 'number' ? 0 : (options.top ?? 0);
  }) as typeof window.scrollTo);
});

afterEach(() => vi.restoreAllMocks());

const pressed = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('useViewState', () => {
  it('opens a page as it was left on the app’s Back, scrolled to where it was', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Row 1' }));
    expect(pressed('Row 1')).toBe('true');
    // The same id under the dialog's scope is a view of its own.
    expect(pressed('Row 1 in the dialog')).toBe('false');
    scrollTo(1200);
    await user.click(screen.getByRole('link', { name: 'Open the item' }));
    // A new page opens at its top.
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(pressed('Row 1')).toBe('true');
    expect(pressed('Row 1 in the dialog')).toBe('false');
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: 'instant' });
  });

  it('does the same on the browser’s Back', async () => {
    const { router, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Row 1 in the dialog' }));
    await user.click(screen.getByRole('link', { name: 'Open the item' }));
    await act(() => router.navigate(-1));
    expect(pressed('Row 1 in the dialog')).toBe('true');
    expect(pressed('Row 1')).toBe('false');
  });

  it('starts fresh on the same page opened anew', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Row 1' }));
    await user.click(screen.getByRole('link', { name: 'Open the item' }));
    await user.click(screen.getByRole('link', { name: 'Somewhere else' }));
    await user.click(screen.getByRole('link', { name: 'The list again' }));
    expect(pressed('Row 1')).toBe('false');
  });
});
