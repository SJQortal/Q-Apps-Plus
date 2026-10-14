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
});
