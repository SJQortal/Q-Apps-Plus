/**
 * The navigation with the Explorer: the rail lists every page, the phone bar
 * gives Explorer Settings' slot, and Settings is then a gear on Home (named
 * exactly "Settings", which the screenshot check presses) with Back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { renderPage } from '../../test/render';
import HomePage from '../../pages/home/HomePage';
import SettingsPage from '../../pages/settings/SettingsPage';
import { BottomNav } from './BottomNav';
import { NavRail } from './NavRail';
import { isNavActive, NAV_ITEMS, phoneItems, railItems } from './navItems';

const T = { timeout: 4000 };
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

/** A screen `width` px wide, for MUI's breakpoint queries. */
function screenWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const sizes = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)];
    const matches =
      sizes.length > 0 &&
      sizes.every(([, edge, value]) =>
        edge === 'min' ? width >= Number(value) : width <= Number(value)
      );
    return { ...originalMatchMedia(query), matches };
  }) as typeof window.matchMedia;
}

function show(ui: React.ReactNode, path = '/') {
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </HubThemeProvider>
  );
}

const keys = (items: { key: string }[]) => items.map((item) => item.key);

describe('the nav items', () => {
  it('has an Explorer item with its own icon and path', () => {
    const explorer = NAV_ITEMS.find((item) => item.key === 'explorer');
    expect(explorer).toMatchObject({ label: 'Explorer', path: '/explorer' });
    expect(explorer?.Icon).toBeTruthy();
    expect(explorer?.short).toBeUndefined();
  });

  it('the rail: Home, Decisions (admins), Nominations, History, Activity, Explorer, Settings', () => {
    expect(keys(railItems(true))).toEqual([
      'home',
      'decisions',
      'nominations',
      'history',
      'activity',
      'explorer',
      'settings',
    ]);
    expect(keys(railItems(false))).toEqual([
      'home',
      'nominations',
      'history',
      'activity',
      'explorer',
      'settings',
    ]);
  });

  it('the phone bar: five items, Explorer last in Settings’ place', () => {
    expect(keys(phoneItems(true))).toEqual([
      'home',
      'decisions',
      'nominations',
      'activity',
      'explorer',
    ]);
    expect(keys(phoneItems(false))).toEqual([
      'home',
      'nominations',
      'history',
      'activity',
      'explorer',
    ]);
  });

  it('keeps Explorer lit on every Explorer page', () => {
    expect(isNavActive('/explorer', '/explorer')).toBe(true);
    expect(isNavActive('/explorer/account/QA/names', '/explorer')).toBe(true);
    expect(isNavActive('/explorers', '/explorer')).toBe(false);
  });
});

describe('the bars on screen', () => {
  it('the phone bar shows Explorer and no Settings', () => {
    show(<BottomNav isAdmin />, '/explorer/account/QA');
    const bar = screen.getByRole('navigation');
    const buttons = within(bar).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Home',
      'Decisions',
      'Nominees',
      'Activity',
      'Explorer',
    ]);
    expect(within(bar).getByRole('button', { name: 'Explorer' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('the rail shows Explorer before Settings', () => {
    show(<NavRail isAdmin={false} />, '/');
    const names = within(screen.getByRole('navigation', { name: 'Main' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '');
    const explorer = names.findIndex((n) => /Explorer/.test(n));
    const settings = names.findIndex((n) => /Settings/.test(n));
    expect(explorer).toBeGreaterThan(-1);
    expect(settings).toBe(explorer + 1);
  });
});

describe('Settings on phones', () => {
  it('is a gear named “Settings” in Home’s header that opens Settings', async () => {
    screenWidth(390);
    await renderPage(<HomePage />, { persona: 'learner' });
    const gear = await screen.findByRole('button', { name: 'Settings' }, T);
    expect(gear).toHaveStyle({ width: '44px', height: '44px' });
    await userEvent.setup().click(gear);
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });

  it('is not on Home where the rail has Settings', async () => {
    screenWidth(1280);
    await renderPage(<HomePage />, { persona: 'learner' });
    await screen.findAllByRole('heading', { level: 2 }, T);
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('Settings shows Back on a phone, and none beside the rail', async () => {
    screenWidth(390);
    const phone = await renderPage(<SettingsPage />, { persona: 'learner', path: '/settings' });
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument(),
      T
    );
    phone.unmount();
    screenWidth(1280);
    await renderPage(<SettingsPage />, { persona: 'learner', path: '/settings' });
    await screen.findByText('Leo Learner', {}, T);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});
