import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { mockAllIsIntersecting, mockIsIntersecting } from 'react-intersection-observer/test-utils';
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

/**
 * The min-height a browser would give `el` at `viewport`, from the page's CSS
 * rules in order. jsdom's getComputedStyle ignores @media rules, and the one
 * that matters here is MenuItem's own `min-height: auto` from 600 px up.
 * Every min-height rule on a MenuItem is a single class, so the last matching
 * one wins.
 */
function minHeightAt(el: Element, viewport: { width: number; height: number; coarse: boolean }) {
  const holds = (feature: string, value: string) => {
    const px = parseFloat(value);
    switch (feature) {
      case 'min-width':
        return viewport.width >= px;
      case 'max-width':
        return viewport.width <= px;
      case 'min-height':
        return viewport.height >= px;
      case 'max-height':
        return viewport.height <= px;
      case 'pointer':
        return (value === 'coarse') === viewport.coarse;
      default:
        return false;
    }
  };
  const matches = (media: string) =>
    media
      .split(',')
      .some((query) => [...query.matchAll(/\(\s*([a-z-]+)\s*:\s*([\w.]+)\s*\)/g)].every(([, f, v]) => holds(f, v)));
  let minHeight = '';
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        if (matches(rule.media.mediaText)) walk(rule.cssRules);
      } else if (rule instanceof CSSStyleRule) {
        let applies = false;
        try {
          applies = el.matches(rule.selectorText);
        } catch {
          // A pseudo-element selector: not the element itself.
        }
        const value = rule.style.getPropertyValue('min-height');
        if (applies && value) minHeight = value;
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
  return minHeight;
}

describe('NavBar account menu', () => {
  const NAMES = [{ name: 'alice' }, { name: 'bob' }, { name: 'Ωmega' }];
  const avatarImg = (name: string, root: ParentNode = document) =>
    root.querySelector<HTMLImageElement>(`img[src="/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar"]`);
  const avatarOf = (row: HTMLElement) => row.querySelector<HTMLElement>('.MuiAvatar-root')!;
  const row = (name: string) => screen.getByRole('menuitemradio', { name });
  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Account menu for alice' }));

  // NameAvatar remembers each avatar's result for the session, so every test
  // that loads or fails one uses names of its own.
  const renderSignedIn = (names = NAMES, setActiveName = () => {}) =>
    renderWithProviders(
      <NavBar
        {...baseProps}
        isAuthenticated
        userName="alice"
        accountNames={names}
        setActiveName={setActiveName}
        authenticate={() => {}}
      />
    );

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for another name's avatar only once its row scrolls into the menu's view", () => {
    // Records every preload, as MUI's Avatar makes for its `src` on mount.
    const preloaded: string[] = [];
    class RecordingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        preloaded.push(value);
      }
    }
    vi.stubGlobal('Image', RecordingImage);
    mockPhone(false);
    renderSignedIn();
    // Page load: the trigger's own avatar, nothing for the other names.
    expect(avatarImg('alice')).toBeInTheDocument();
    expect(avatarImg('bob')).toBeNull();
    fireEvent.load(avatarImg('alice')!);

    openMenu();
    // The active row shows the header's avatar, already loaded, at once.
    expect(avatarImg('alice', row('alice'))).toBeInTheDocument();
    // Mounted but not yet in view: nothing asked for, not even a preload.
    expect(avatarImg('bob', row('bob'))).toBeNull();
    expect(avatarImg('Ωmega', row('Ωmega'))).toBeNull();
    expect(preloaded.filter((src) => !src.includes('/alice/'))).toEqual([]);

    mockIsIntersecting(avatarOf(row('bob')), true);
    expect(avatarImg('bob', row('bob'))).toBeInTheDocument();
    expect(avatarImg('Ωmega', row('Ωmega'))).toBeNull();
  });

  it('keeps the active name marked, and switches on a tap', () => {
    mockPhone(false);
    const setActiveName = vi.fn();
    renderSignedIn(NAMES, setActiveName);
    openMenu();

    const alice = row('alice');
    const bob = row('bob');
    expect(alice).toHaveAttribute('aria-checked', 'true');
    expect(alice).toHaveClass('Mui-selected');
    expect(alice.querySelector('[data-testid="CheckIcon"]')).toBeInTheDocument();
    expect(bob).toHaveAttribute('aria-checked', 'false');
    expect(bob.querySelector('[data-testid="CheckIcon"]')).toBeNull();

    fireEvent.click(bob);
    expect(setActiveName).toHaveBeenCalledWith('bob');
  });

  it("shows a name's first letter where it has no avatar, and does not ask again on the next open", async () => {
    mockPhone(false);
    renderSignedIn([{ name: 'alice' }, { name: 'carol' }, { name: 'Ωrion' }]);
    openMenu();
    mockAllIsIntersecting(true);

    // Core answers 404: the name has no qortal_avatar.
    fireEvent.error(avatarImg('carol', row('carol'))!);
    fireEvent.error(avatarImg('Ωrion', row('Ωrion'))!);
    expect(within(row('carol')).getByText('C')).toBeInTheDocument();
    expect(within(row('Ωrion')).getByText('Ω')).toBeInTheDocument();
    // The letter is decoration: the row is still named by the name alone.
    expect(row('carol')).toHaveAccessibleName('carol');

    fireEvent.keyDown(screen.getByRole('menu', { name: 'Account menu' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument());
    openMenu();
    // Before anything scrolls into view: the letter at once, and no second request.
    expect(within(row('carol')).getByText('C')).toBeInTheDocument();
    expect(avatarImg('carol')).toBeNull();
  });

  it('lists every name with its avatar in the phone sheet', () => {
    mockPhone(true);
    const names = [{ name: 'alice' }, { name: 'dave' }, { name: 'erin' }];
    renderSignedIn(names);
    expect(avatarImg('dave')).toBeNull();

    openMenu();
    mockAllIsIntersecting(true);
    const sheet = screen.getByRole('dialog', { name: 'alice' });
    for (const { name } of names) {
      expect(avatarImg(name, within(sheet).getByRole('menuitemradio', { name }))).toBeInTheDocument();
    }
  });

  it('keeps every row a 44 px tap target on phones, landscape phones 600 px and wider included', () => {
    mockPhone(true);
    renderSignedIn();
    openMenu();
    const sheet = screen.getByRole('dialog', { name: 'alice' });
    const rows = within(sheet).getAllByRole('menuitem').concat(within(sheet).getAllByRole('menuitemradio'));
    expect(rows).toHaveLength(NAMES.length + 2);

    for (const viewport of [
      { width: 360, height: 740, coarse: true },
      { width: 844, height: 390, coarse: true },
      { width: 700, height: 390, coarse: true },
    ]) {
      for (const r of rows) expect(minHeightAt(r, viewport), `${r.textContent} at ${viewport.width}x${viewport.height}`).toBe('44px');
    }
  });
});
