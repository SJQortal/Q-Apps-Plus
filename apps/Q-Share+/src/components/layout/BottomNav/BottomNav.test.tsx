import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { store } from '../../../state/store';
import { addUser } from '../../../state/features/authSlice';
import { setAddToDownloads, removeDownload } from '../../../state/features/globalSlice';
import { OPEN_PUBLISH_EVENT } from '../../../constants/events';
import { BottomNav, BottomNavSpacer } from './BottomNav';
import { OPEN_DOWNLOADS_EVENT } from './events';

const originalMatchMedia = window.matchMedia;

type Viewport = { width: number; height: number; touch: boolean };
const PORTRAIT: Viewport = { width: 390, height: 844, touch: true };
const LANDSCAPE: Viewport = { width: 844, height: 390, touch: true };
// GO resizes the app for the soft keyboard: at 360×740 the frame is about 320 px tall.
const PORTRAIT_KEYBOARD: Viewport = { width: 360, height: 320, touch: true };
const DESKTOP: Viewport = { width: 1440, height: 900, touch: false };

/**
 * Just enough of a media query engine for hooks/usePhoneLayout.ts: a comma is
 * "or", every (feature: value) in a branch must hold.
 */
function matchesViewport(query: string, vp: Viewport): boolean {
  return query
    .replace(/^@media\s*/, '')
    .split(',')
    .some((branch) =>
      [...branch.matchAll(/\(\s*([a-z-]+)\s*:\s*([^()]+?)\s*\)/g)].every(([, feature, value]) => {
        const px = parseFloat(value);
        switch (feature) {
          case 'max-width':
            return vp.width <= px;
          case 'min-width':
            return vp.width >= px;
          case 'max-height':
            return vp.height <= px;
          case 'min-height':
            return vp.height >= px;
          case 'pointer':
            return value === (vp.touch ? 'coarse' : 'fine');
          default:
            return false;
        }
      })
    );
}

function mockViewport(vp: Viewport) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: matchesViewport(query, vp),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
}

const signIn = () =>
  store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
const signOut = () => store.dispatch(addUser(null));

describe('BottomNav', () => {
  beforeAll(() => mockViewport(PORTRAIT));
  afterAll(() => {
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia });
  });
  afterEach(() => signOut());

  it('renders the four items with labels and marks the current page', async () => {
    renderWithProviders(<BottomNav />, { initialEntries: ['/settings'] });

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(nav).toBeInTheDocument();
    for (const label of ['Home', 'Collections', 'Downloads', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('the Share button asks the publish dialog to open when signed in, and is absent when signed out', async () => {
    const onOpen = vi.fn();
    window.addEventListener(OPEN_PUBLISH_EVENT, onOpen);
    signIn();
    const { unmount } = renderWithProviders(<BottomNav />);

    const fab = await screen.findByRole('button', { name: 'Share files' });
    // In portrait it floats above the bar.
    expect(fab).toHaveClass('MuiFab-root');
    fireEvent.click(fab);
    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_PUBLISH_EVENT, onOpen);
    unmount();

    signOut();
    renderWithProviders(<BottomNav />);
    await screen.findByRole('navigation', { name: 'Main' });
    expect(screen.queryByRole('button', { name: 'Share files' })).not.toBeInTheDocument();
  });

  it('on a phone in landscape, Share is an item in the compact bar instead of a floating button', async () => {
    mockViewport(LANDSCAPE);
    const onOpen = vi.fn();
    window.addEventListener(OPEN_PUBLISH_EVENT, onOpen);
    try {
      signIn();
      const { container, unmount } = renderWithProviders(
        <>
          <BottomNav />
          <BottomNavSpacer />
        </>
      );
      const nav = await screen.findByRole('navigation', { name: 'Main' });
      expect(container.querySelector('.MuiFab-root')).toBeNull();
      const buttons = Array.from(nav.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
      expect(buttons).toEqual(['Home', 'Collections', 'Downloads', 'Settings', 'Share files']);

      const share = screen.getByRole('button', { name: 'Share files' });
      expect(share).toHaveTextContent('Share');
      fireEvent.click(share);
      expect(onOpen).toHaveBeenCalledTimes(1);
      // Only the 52 px bar to clear: no floating button.
      expect(screen.getByTestId('bottom-nav-spacer').style.height).toBe('calc(52px + env(safe-area-inset-bottom, 0px))');
      unmount();

      signOut();
      renderWithProviders(<BottomNav />);
      await screen.findByRole('navigation', { name: 'Main' });
      expect(screen.queryByRole('button', { name: 'Share files' })).not.toBeInTheDocument();
    } finally {
      window.removeEventListener(OPEN_PUBLISH_EVENT, onOpen);
      mockViewport(PORTRAIT);
    }
  });

  it('stays as in portrait when the keyboard makes a portrait phone short', async () => {
    mockViewport(PORTRAIT_KEYBOARD);
    try {
      signIn();
      renderWithProviders(
        <>
          <BottomNav />
          <BottomNavSpacer />
        </>
      );
      await screen.findByRole('navigation', { name: 'Main' });
      // Only the floating Share button, not the compact bar's pill.
      const share = screen.getAllByRole('button', { name: 'Share files' });
      expect(share).toHaveLength(1);
      expect(share[0]).toHaveClass('MuiFab-root');
      expect(screen.getByTestId('bottom-nav-spacer').style.height).toBe('calc(144px + env(safe-area-inset-bottom, 0px))');
    } finally {
      mockViewport(PORTRAIT);
    }
  });

  it('the Downloads item shows the count and dispatches the open-downloads event', async () => {
    store.dispatch(setAddToDownloads({ identifier: 'file-1', status: { status: 'DOWNLOADING', percentLoaded: 10 } }));
    store.dispatch(setAddToDownloads({ identifier: 'file-2', status: { status: 'READY', percentLoaded: 100 } }));
    const onOpen = vi.fn((e: Event) => e.preventDefault());
    window.addEventListener(OPEN_DOWNLOADS_EVENT, onOpen);
    try {
      renderWithProviders(<BottomNav />);
      const item = await screen.findByRole('button', { name: 'Downloads, 2 in the list' });
      expect(item).toHaveTextContent('2');
      fireEvent.click(item);
      expect(onOpen).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(OPEN_DOWNLOADS_EVENT, onOpen);
      store.dispatch(removeDownload('file-1'));
      store.dispatch(removeDownload('file-2'));
    }
  });

  it('the spacer clears the bar, and the Share button too when signed in', () => {
    const { unmount } = renderWithProviders(<BottomNavSpacer />);
    expect(screen.getByTestId('bottom-nav-spacer').style.height).toBe('calc(72px + env(safe-area-inset-bottom, 0px))');
    unmount();

    signIn();
    renderWithProviders(<BottomNavSpacer />);
    // 72 bar + 16 gap + 56 button.
    expect(screen.getByTestId('bottom-nav-spacer').style.height).toBe('calc(144px + env(safe-area-inset-bottom, 0px))');
  });

  it('renders nothing on wider screens', () => {
    mockViewport(DESKTOP);
    try {
      const { container } = renderWithProviders(
        <>
          <BottomNav />
          <BottomNavSpacer />
        </>
      );
      expect(container.querySelector('nav')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
    } finally {
      mockViewport(PORTRAIT);
    }
  });
});
