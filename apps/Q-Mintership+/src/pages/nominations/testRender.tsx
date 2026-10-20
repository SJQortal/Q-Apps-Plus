/**
 * Test-only: render a nominations screen like src/test/render.tsx does, but
 * with a hook to change the mock world (or add routes) before the first read,
 * for empty, failing and very long lists.
 */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getDefaultStore } from 'jotai';
import type { World } from '../../../e2e/world.mjs';
import { HubThemeProvider } from '../../hub-theme';
import { resetSessionStarter, signIn } from '../../state/session';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { installWorld } from '../../test/world';
import { pendingWritesAtom } from '../../writes/optimistic';

export async function renderWithWorld(
  ui: ReactElement,
  options: { persona: string; path: string; route: string; before?: (world: World) => void }
) {
  const installed = installWorld(options.persona);
  options.before?.(installed.world);
  resetSessionStarter();
  getDefaultStore().set(pendingWritesAtom, {});
  await signIn();
  const result = render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <MemoryRouter initialEntries={[options.path]}>
        <Routes>
          <Route path={options.route} element={ui} />
          <Route path="*" element={<div data-testid="navigated-away" />} />
        </Routes>
      </MemoryRouter>
    </HubThemeProvider>
  );
  return Object.assign(result, installed);
}
