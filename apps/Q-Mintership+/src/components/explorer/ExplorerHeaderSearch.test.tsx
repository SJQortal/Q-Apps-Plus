/**
 * The Explorer's search in the header of its other pages: a compact field
 * on wider screens, a button that opens the field in a dialog on phones.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { renderPage } from '../../test/render';
import { ADDR, NOW } from '../../test/world';
import { resetExplorerState } from '../../state/explorer';
import AccountPage from '../../pages/explorer/AccountPage';
import { ExplorerHeaderSearch } from './ExplorerHeaderSearch';

const T = { timeout: 4000 };
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  resetExplorerState();
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

function Where() {
  return <output data-testid="at">{useLocation().pathname}</output>;
}

describe('the Explorer search in the header', () => {
  it('is in the header of an account’s page, as a field', async () => {
    screenWidth(1280);
    await renderPage(<AccountPage />, {
      persona: 'learner',
      path: `/explorer/account/${ADDR.nominator}`,
      route: '/explorer/account/:who/:tab?',
    });
    const header = await screen.findByRole('heading', { level: 1 }, T);
    const bar = header.closest('header') as HTMLElement;
    expect(within(bar).getByRole('combobox', { name: 'Search the Explorer' })).toBeVisible();
  });

  it('on phones is a button that opens the field, which closes once it has opened something', async () => {
    screenWidth(390);
    const user = userEvent.setup();
    await renderPage(
      <>
        <ExplorerHeaderSearch />
        <Where />
      </>,
      {
        persona: 'learner',
        path: '/explorer/tx/x',
        route: '/explorer/*',
        setup: (world) =>
          world.records.push({
            name: 'Nora Nominator',
            identifier: 'my-doc-abc',
            created: NOW - 3_600_000,
            body: {},
          }),
      }
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Search the Explorer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Search the Explorer' });
    const field = within(dialog).getByRole('combobox', { name: 'Search the Explorer' });
    expect(field).toHaveFocus();
    await user.paste('my-doc-abc');
    await user.click(await within(dialog).findByRole('option', { name: /^JSON · my-doc-abc/ }, T));
    await waitFor(() =>
      expect(screen.getByTestId('at').textContent).toMatch(/^\/explorer\/tx\/[^x]/)
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), T);
  });
});
