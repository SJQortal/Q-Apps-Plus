import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import NavBar from './Navbar';

const baseProps = {
  userAvatar: '',
  accountNames: [],
  setActiveName: () => {},
};

const TAGLINE = 'Public file sharing on Qortal';
const originalMatchMedia = window.matchMedia;

/** The phone layout (hooks/usePhoneLayout.ts) on or off; every other query stays off. */
function mockPhone(phone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: phone && query.includes('599.95'),
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

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia });
});

describe('NavBar', () => {
  it('offers Sign in when signed out, and asks Hub again when tapped', () => {
    const authenticate = vi.fn();
    renderWithProviders(<NavBar {...baseProps} isAuthenticated={false} userName="" authenticate={authenticate} canSignIn />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('shows no Sign in while a request is out or once signed in', () => {
    const { unmount } = renderWithProviders(
      <NavBar {...baseProps} isAuthenticated={false} userName="" authenticate={() => {}} canSignIn={false} />
    );
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <NavBar
        {...baseProps}
        isAuthenticated
        userName="alice"
        accountNames={[{ name: 'alice' }]}
        authenticate={() => {}}
        canSignIn={false}
      />
    );
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu for alice' })).toBeInTheDocument();
  });

  it("spans the window but keeps the logo and actions in the page's 1200 px column", () => {
    renderWithProviders(
      <NavBar {...baseProps} isAuthenticated userName="alice" accountNames={[{ name: 'alice' }]} authenticate={() => {}} />
    );
    const header = screen.getByRole('banner');
    expect(getComputedStyle(header).position).toBe('sticky');
    expect(getComputedStyle(header).justifyContent).toBe('center');

    const column = header.firstElementChild as HTMLElement;
    expect(getComputedStyle(column).maxWidth).toBe('1200px');
    expect(column).toContainElement(screen.getByRole('button', { name: 'Q-Share+ home' }));
    expect(column).toContainElement(screen.getByRole('button', { name: 'Account menu for alice' }));
  });
});

describe('NavBar tagline', () => {
  it('sits on the title line, baseline to baseline, not under it', () => {
    mockPhone(false);
    renderWithProviders(<NavBar {...baseProps} isAuthenticated={false} userName="" authenticate={() => {}} />);

    const home = screen.getByRole('button', { name: 'Q-Share+ home' });
    const tagline = screen.getByText(TAGLINE);
    // Beside the button, in one row whose items share a baseline.
    const row = home.parentElement!;
    expect(row).toContainElement(tagline);
    expect(getComputedStyle(row).flexDirection).not.toBe('column');
    expect(getComputedStyle(row).alignItems).toBe('baseline');
    expect(getComputedStyle(tagline).color).not.toBe(getComputedStyle(screen.getByText('Q-Share+')).color);
  });

  it("stays out of the home button, whose name holds all of the button's visible text", () => {
    mockPhone(false);
    renderWithProviders(<NavBar {...baseProps} isAuthenticated={false} userName="" authenticate={() => {}} />);

    const home = screen.getByRole('button', { name: 'Q-Share+ home' });
    expect(home).not.toContainElement(screen.getByText(TAGLINE));
    expect(home).toHaveTextContent(/^Q-Share\+$/);
  });

  it('never makes the header taller: where it does not fit whole, its one clipped line hides it', () => {
    mockPhone(false);
    renderWithProviders(<NavBar {...baseProps} isAuthenticated={false} userName="" authenticate={() => {}} />);

    const slot = screen.getByText(TAGLINE).parentElement!;
    const style = getComputedStyle(slot);
    expect(style.flexWrap).toBe('wrap');
    expect(style.overflow).toBe('hidden');
    expect(style.height).toBe(style.lineHeight);
    // Its own width is 0: it only takes the room the logo and the actions leave.
    expect(style.width).toBe('0px');
  });

  it('is left out on phones and landscape phones, as before', () => {
    mockPhone(true);
    renderWithProviders(
      <NavBar {...baseProps} isAuthenticated userName="alice" accountNames={[{ name: 'alice' }]} authenticate={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'Q-Share+ home' })).toBeInTheDocument();
    expect(screen.queryByText(TAGLINE)).not.toBeInTheDocument();
  });
});
