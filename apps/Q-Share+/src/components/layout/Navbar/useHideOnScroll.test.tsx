import type { ComponentType, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { SubHeader } from '../../../pages/FileContent/FileContent-styles';
import { PhoneHeader } from '../../../pages/Collections/Collections-styles';
import NavBar from './Navbar';
import { HEADER_OFFSET_VAR } from './useHideOnScroll';

const originalMatchMedia = window.matchMedia;
const HEADER_HEIGHT = 56;

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

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true });
  fireEvent.scroll(window);
}

const offset = () => document.documentElement.style.getPropertyValue(HEADER_OFFSET_VAR);

type Bar = ComponentType<{ children: ReactNode; 'data-testid': string }>;

const renderNavBar = (Sub: Bar = SubHeader) =>
  renderWithProviders(
    <>
      <NavBar isAuthenticated={false} userName="" userAvatar="" authenticate={() => {}} canSignIn accountNames={[]} setActiveName={() => {}} />
      <main>
        <Sub data-testid="sub-header">Back</Sub>
      </main>
    </>
  );

describe('header offset for sticky sub-headers', () => {
  beforeEach(() => {
    // jsdom does no layout: give the header its real height.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(HEADER_HEIGHT);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia });
    scrollTo(0);
  });

  it("publishes the header's height on desktop, where it never hides, and clears it on unmount", () => {
    mockPhone(false);
    const { unmount } = renderNavBar();
    expect(offset()).toBe(`${HEADER_HEIGHT}px`);
    unmount();
    expect(offset()).toBe('');
  });

  it('drops to 0 while the phone header is scrolled away and comes back with it', async () => {
    mockPhone(true);
    renderNavBar();
    expect(offset()).toBe(`${HEADER_HEIGHT}px`);

    act(() => scrollTo(300));
    await waitFor(() => expect(offset()).toBe('0px'));
    act(() => scrollTo(250));
    await waitFor(() => expect(offset()).toBe(`${HEADER_HEIGHT}px`));
  });

  it.each([
    ['the share page', SubHeader],
    ['Collections', PhoneHeader],
  ])("keeps %s's sub-header below the header, never over it", (_page, Sub) => {
    mockPhone(true);
    renderNavBar(Sub as Bar);
    const header = document.querySelector<HTMLElement>('.MuiAppBar-root')!;
    const sub = screen.getByTestId('sub-header');
    const headerZ = Number(getComputedStyle(header).zIndex);
    const subZ = Number(getComputedStyle(sub).zIndex);
    expect(subZ).toBeLessThan(headerZ);
    expect(getComputedStyle(sub).top).toBe(`var(${HEADER_OFFSET_VAR}, 0px)`);
  });
});
