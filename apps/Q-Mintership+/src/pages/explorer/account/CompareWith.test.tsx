/**
 * "Compare with…" on an account page: a 44 px button in the header that
 * opens the Explorer's search in a dialog; the account picked opens side by
 * side with this one. Strict mock world; read-only.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { renderPage } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { explorerAccountPath, explorerComparePath } from '../../../routes/paths';
import { resetExplorerState } from '../../../state/explorer';
import AccountPage from '../AccountPage';
import { CompareWith } from './CompareWith';

const T = { timeout: 5000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;

function Probe() {
  return <output data-testid="at">{useLocation().pathname}</output>;
}
const at = () => screen.getByTestId('at').textContent ?? '';

beforeEach(() => resetExplorerState());

describe('Compare with…', () => {
  it('opens the search in a dialog; the account picked opens side by side with this one', async () => {
    const { posts } = await renderPage(
      <>
        <CompareWith address={ADDR.nominator} label="Nora Nominator" />
        <Probe />
      </>,
      { persona: 'nominator', path: explorerAccountPath(ADDR.nominator), route: '/*', strict: true }
    );
    const user = userEvent.setup();
    const button = screen.getByRole('button', {
      name: 'Compare Nora Nominator with another account',
    });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Compare with…' }, T);
    expect(dialog).toHaveTextContent('Find the account to compare Nora Nominator with.');
    await expectNoAxeViolations(dialog);

    // This same account: said, nothing opens.
    const field = within(dialog).getByRole('combobox', { name: 'Find an account' });
    await user.type(field, `${ADDR.nominator}{Enter}`);
    expect(
      await within(dialog).findByText('That’s this account. Pick another one.', {}, T)
    ).toBeVisible();
    expect(at()).toBe(explorerAccountPath(ADDR.nominator));

    await user.type(
      within(dialog).getByRole('combobox', { name: 'Find an account' }),
      `${ADDR.kicked}{Enter}`
    );
    await waitFor(() => expect(at()).toBe(explorerComparePath([ADDR.nominator, ADDR.kicked])), T);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), T);
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('is tall, so the names suggested under the field show without scrolling it', async () => {
    await renderPage(<CompareWith address={ADDR.nominator} label="Nora Nominator" />, {
      persona: 'nominator',
      path: explorerAccountPath(ADDR.nominator),
      route: '/*',
      strict: true,
    });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Compare Nora Nominator with another account' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Compare with…' }, T);
    await user.type(within(dialog).getByRole('combobox', { name: 'Find an account' }), 'No');
    const list = await within(dialog).findByRole('listbox', {}, T);
    // The room under the field, not MUI's 40vh.
    expect(list.style.maxHeight).toContain('800px');
    expect(list.style.maxHeight).toContain('200px');
  });

  it('sits in the account header, beside the Compare toggle', async () => {
    await renderPage(<AccountPage />, {
      persona: 'nominator',
      path: explorerAccountPath(ADDR.nominator),
      route: '/explorer/account/:who/:tab?',
      strict: true,
    });
    const compareWith = await screen.findByRole(
      'button',
      { name: 'Compare Nora Nominator with another account' },
      T
    );
    const toggle = screen.getByRole('button', { name: 'Add Nora Nominator to compare' });
    expect(compareWith.closest('header')).toBe(toggle.closest('header'));
    expect(compareWith).toHaveStyle({ width: '44px', height: '44px' });
  });
});
