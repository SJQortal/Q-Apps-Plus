import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { store } from '../../../state/store';
import { addUser } from '../../../state/features/authSlice';
import { setAddToDownloads, removeDownload } from '../../../state/features/globalSlice';
import { OPEN_PUBLISH_EVENT } from '../../../constants/events';
import { BottomNav, BottomNavSpacer } from './BottomNav';
import { OPEN_DOWNLOADS_EVENT } from './events';

const PHONE_QUERY = '599.95'; // part of PHONE_MEDIA in hooks/usePhoneLayout.ts
const originalMatchMedia = window.matchMedia;

/** Pretend the viewport is a phone: only the phone breakpoint query matches. */
function mockPhoneViewport(phone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: phone && query.includes(PHONE_QUERY),
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
  beforeAll(() => mockPhoneViewport(true));
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
    fireEvent.click(fab);
    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_PUBLISH_EVENT, onOpen);
    unmount();

    signOut();
    renderWithProviders(<BottomNav />);
    await screen.findByRole('navigation', { name: 'Main' });
    expect(screen.queryByRole('button', { name: 'Share files' })).not.toBeInTheDocument();
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

  it('renders nothing on wider screens', () => {
    mockPhoneViewport(false);
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
      mockPhoneViewport(true);
    }
  });
});
