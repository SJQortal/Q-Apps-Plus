/**
 * Whose first QORT payment came from an account, in the mock world
 * (strict): the summary with how many were checked of how many, 50 more
 * per tap, rows with the amount and block, and the empty and invalid
 * states. Read-only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { expectNoAxeViolations } from '../../test/axe';
import { fetchCallsFor, qortalCalls } from '../../test/setup';
import { ADDR } from '../../test/world';
import { FUNDER } from '../../../e2e/world.mjs';
import { explorerAccountPath, explorerFundedPath } from '../../routes/paths';
import { fundedSummary } from './sets/words';
import FundedPage from './FundedPage';

const T = { timeout: 5000 };

async function open(address: string) {
  const result = await renderPage(<FundedPage />, {
    persona: 'learner',
    path: explorerFundedPath(address),
    route: '/explorer/funded/:address',
    strict: true,
  });
  return { ...result, user: userEvent.setup() };
}

afterEach(() => vi.useRealTimers());

describe('first QORT payments from an account', () => {
  it('checks 50 of the accounts it paid, then 50 more on request', async () => {
    const { container, posts, user } = await open(FUNDER.address);
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'First QORT payments from Hal Helper' },
        T
      )
    ).toBeVisible();
    expect(
      await screen.findByText(
        'Checked 50 of the 100 accounts Hal Helper paid in its first 100 payments: Hal Helper made the first QORT payment to 50 of them.',
        {},
        T
      )
    ).toBeInTheDocument();
    const list = screen.getByRole('list', {
      name: 'Accounts whose first QORT payment came from Hal Helper',
    });
    expect(list.children).toHaveLength(20);
    const kit = within(list).getByRole('link', { name: 'Kit Kicked: explore this account' });
    expect(kit).toHaveAttribute('href', explorerAccountPath(ADDR.kicked));
    expect(list.children[0]).toHaveTextContent(/5\.4321 QORT, .* · block 1,364,165/);
    expect(screen.getByRole('button', { name: 'Show more (30 more)' })).toBeInTheDocument();
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('button', { name: 'Check 50 more' }));
    expect(
      await screen.findByText(
        'Of the 100 accounts Hal Helper paid in its first 100 payments, Hal Helper made the first QORT payment to 100.',
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Check \d+ more/ })).toBeNull();
    // One read of its payments, then one per account it paid.
    await waitFor(() =>
      expect(
        fetchCallsFor('/transactions/payments/between?recipientAddress=').length
      ).toBeGreaterThanOrEqual(100)
    );
    expect(posts).toEqual([]);
    expect(
      qortalCalls.filter((c) => /INVITE|KICK|BAN|JOIN|SIGN|PUBLISH/.test(String(c.action)))
    ).toEqual([]);
  });

  it('an account that paid no one, and an address that isn’t one', async () => {
    const first = await open(ADDR.newcomer);
    expect(
      await screen.findByText(/has sent no QORT payments to other accounts\./, {}, T)
    ).toBeInTheDocument();
    first.unmount();
    await open('nope');
    expect(
      await screen.findByText("This isn't a valid Qortal address. A letter may be wrong.", {}, T)
    ).toBeInTheDocument();
  });
});

describe('the summary', () => {
  const base = { payments: 6, truncated: false, checked: 4, paid: [1, 2, 3, 4] };
  it('says how many were checked of how many', () => {
    expect(fundedSummary(base, 'H', 2)).toBe(
      'Of the 4 accounts H paid in its 6 payments, H made the first QORT payment to 2.'
    );
    expect(fundedSummary({ ...base, checked: 2 }, 'H', 1)).toBe(
      'Checked 2 of the 4 accounts H paid in its 6 payments: H made the first QORT payment to 1 of them.'
    );
    expect(fundedSummary({ ...base, payments: 1, paid: [1], checked: 1 }, 'H', 1)).toBe(
      'Of the 1 account H paid in its only payment, H made the first QORT payment to 1.'
    );
  });
});
