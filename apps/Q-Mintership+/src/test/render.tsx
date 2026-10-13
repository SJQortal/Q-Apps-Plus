/**
 * Render a screen the way the app does (theme kit, router, the mock MINTER
 * world, a signed-in persona) for page tests:
 *
 *   const { world, address } = await renderPage(<HomePage />, { persona: 'nominator' });
 *   expect(await screen.findByText(/You can nominate/)).toBeInTheDocument();
 *
 * Every write is declined unless the test answers it (mockQortalRequest).
 */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getDefaultStore } from 'jotai';
import { HubThemeProvider } from '../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../theme/qplus-theme';
import { resetSessionStarter, signIn } from '../state/session';
import { pendingWritesAtom } from '../writes/optimistic';
import { resetPageFocus } from '../components/layout/pageFocus';
import { installWorld, type InstalledWorld } from './world';

export interface RenderPageOptions {
  /** Who is signed in (a key of PEOPLE in e2e/world.mjs), or 'signedOut' / 'outside'. */
  persona?: string;
  /** The URL the router starts at. */
  path?: string;
  /** The route pattern the page is mounted on (for useParams), e.g. '/people/:address'. */
  route?: string;
  /** Change the mock world before the page first reads it. */
  setup?: (world: InstalledWorld['world']) => void;
}

export async function renderPage(
  ui: ReactElement,
  options: RenderPageOptions = {}
): Promise<InstalledWorld & ReturnType<typeof render>> {
  const persona = options.persona ?? 'admin';
  const installed = installWorld(persona === 'outside' ? 'admin' : persona);
  options.setup?.(installed.world);
  resetSessionStarter();
  resetPageFocus();
  getDefaultStore().set(pendingWritesAtom, {});
  const saved = (globalThis as { qortalRequest?: unknown }).qortalRequest;
  if (persona === 'outside') (globalThis as { qortalRequest?: unknown }).qortalRequest = undefined;
  await signIn();
  if (persona === 'outside') (globalThis as { qortalRequest?: unknown }).qortalRequest = saved;
  const path = options.path ?? '/';
  const result = render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={options.route ?? path.split('?')[0]} element={ui} />
          <Route path="*" element={<div data-testid="navigated-away" />} />
        </Routes>
      </MemoryRouter>
    </HubThemeProvider>
  );
  return Object.assign(result, installed);
}
