import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom';
import { useScrollTopOnNewPage } from './useScrollTopOnNewPage';

function Shell() {
  useScrollTopOnNewPage();
  return <Outlet />;
}

function setup() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Shell />,
        children: [
          { index: true, element: <p>home</p> },
          { path: 'decisions', element: <p>decisions</p> },
          { path: 'explorer/account/:who/:tab?', element: <p>account</p> },
        ],
      },
    ],
    { initialEntries: ['/'] }
  );
  render(<RouterProvider router={router} />);
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  return { router, scrollTo };
}

afterEach(() => vi.restoreAllMocks());

describe('useScrollTopOnNewPage', () => {
  it('opens a new page at its top, but not on Back or a query change', async () => {
    const { router, scrollTo } = setup();
    await act(() => router.navigate('/decisions'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockClear();
    await act(() => router.navigate('/decisions?show=ready'));
    expect(scrollTo).not.toHaveBeenCalled();
    await act(() => router.navigate(-1));
    await act(() => router.navigate(-1));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('keeps an Explorer account’s place when only its tab changes', async () => {
    const { router, scrollTo } = setup();
    await act(() => router.navigate('/explorer/account/QA'));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    scrollTo.mockClear();
    await act(() => router.navigate('/explorer/account/QA/names', { replace: true }));
    await act(() => router.navigate('/explorer/account/QA', { replace: true }));
    expect(scrollTo).not.toHaveBeenCalled();
    // Another account is another page.
    await act(() => router.navigate('/explorer/account/QB/names'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
