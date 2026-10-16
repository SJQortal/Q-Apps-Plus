/**
 * One transaction in a list: one button that opens to the details, people
 * linking into the Explorer and "Open transaction"; what is never shown (a
 * message's content, an encrypted resource's identifier, fields only the
 * raw data has); the raw API response, opened in the row, coloured by kind
 * and copied as JSON; a minting-level move's recipient. Strict mock world.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADDR, MESSAGE_CONTENT, OLD_MINTER, createWorld, type World } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { expectNoAxeViolations } from '../../test/axe';
import { fetchCallsFor } from '../../test/setup';
import type { TxRow } from '../../data/types';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../common/personLinks';
import { TxList } from './TxListRow';

const T = { timeout: 4000 };
const world: World = createWorld();
const sigs = world.explorer.sigs;
const row = (signature: string): TxRow =>
  (world.explorer.rows as TxRow[]).find((r) => r.signature === signature) as TxRow;

async function show(rows: TxRow[], viewpoint: string | null = null) {
  const result = await renderPage(
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <TxList rows={rows} viewpoint={viewpoint} label="Transactions" />
    </PersonLinkContext>,
    { path: '/list', strict: true }
  );
  return { ...result, user: userEvent.setup() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('TxListRow', () => {
  it('is one button that opens to the details and closes again, keeping focus', async () => {
    const { user, container, posts } = await show([row(sigs.kitLou[0])], ADDR.kicked);
    const button = await screen.findByRole('button', { name: /Sent 10 QORT to Lou Left/ }, T);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('block 1,364,500');
    // Nothing inside the button is a link.
    expect(within(button).queryAllByRole('link')).toEqual([]);
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveFocus();
    const details = screen.getByRole('list', { name: 'Accounts involved' });
    expect(
      within(details).getByRole('link', { name: 'Lou Left: explore this account' })
    ).toHaveAttribute('href', `/explorer/account/${ADDR.left}`);
    expect(screen.getByText('Amount', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('Recipient', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open transaction' })).toHaveAttribute(
      'href',
      `/explorer/tx/${sigs.kitLou[0]}`
    );
    await expectNoAxeViolations(container);
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
    expect(posts).toEqual([]);
  });

  it('tells the other side from its own viewpoint, and needs none', async () => {
    await show([row(sigs.kitLou[0])], ADDR.left);
    expect(
      await screen.findByRole('button', { name: /Received 10 QORT from Kit Kicked/ }, T)
    ).toBeInTheDocument();
  });

  it('never shows a message’s content, open or closed', async () => {
    const { user, container } = await show([row(sigs.message)], ADDR.kicked);
    const button = await screen.findByRole('button', { name: /Sent a message to Lou Left/ }, T);
    await user.click(button);
    expect(await screen.findByText('Encrypted', { selector: 'dt' }, T)).toBeInTheDocument();
    expect(container.textContent).not.toContain(MESSAGE_CONTENT);
  });

  it('shows an encrypted resource by its service only, never its identifier', async () => {
    const { user, container } = await show([row(sigs.publishes[3])], ADDR.admin);
    const button = await screen.findByRole(
      'button',
      { name: /Published an encrypted resource/ },
      T
    );
    await user.click(button);
    expect(screen.getByText('MAIL_PRIVATE')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/qortal_qmail_explorer_test|Identifier/);
  });

  it('names who got a minting level: from the raw bytes when the account moved it', async () => {
    await show([row(sigs.privs)], OLD_MINTER.address);
    expect(
      await screen.findByRole('button', { name: /Moved its minting level to Kai Target/ }, T)
    ).toBeInTheDocument();
    expect(fetchCallsFor(`/transactions/signature/${sigs.privs}/raw`)).toHaveLength(1);
  });

  it('names who got a minting level: the account itself in its own list, with no read', async () => {
    await show([row(sigs.privs)], ADDR.kickTarget);
    expect(
      await screen.findByRole('button', { name: /Got its minting level from Olga Old/ }, T)
    ).toBeInTheDocument();
    expect(fetchCallsFor('/transactions/signature/')).toEqual([]);
  });

  it('opens the raw API response right in the row, coloured by kind, and copies it', async () => {
    const { user, container } = await show([row(sigs.kitLou[0])], ADDR.kicked);
    await user.click(await screen.findByRole('button', { name: /Sent 10 QORT to Lou Left/ }, T));
    const raw = screen.getByRole('button', { name: 'Raw API response' });
    expect(raw).toHaveAttribute('aria-expanded', 'false');
    // Nothing is laid out until it opens.
    expect(container.querySelector('pre')).toBeNull();
    await user.click(raw);
    expect(raw).toHaveAttribute('aria-expanded', 'true');
    const box = screen.getByRole('region', { name: 'Raw API response' });
    expect(box).toHaveAttribute('tabindex', '0');
    const line = [...box.children].find((el) => el.textContent?.includes('"signature"'));
    expect(line?.textContent).toBe(`"signature": "${sigs.kitLou[0]}",`);
    expect(line?.querySelector('[data-k="key"]')?.textContent).toBe('"signature"');
    expect(line?.querySelector('[data-k="string"]')?.textContent).toBe(`"${sigs.kitLou[0]}"`);
    const height = [...box.children].find((el) => el.textContent?.includes('"blockHeight"'));
    expect(height?.querySelector('[data-k="number"]')?.textContent).toBe('1364500');

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
      writeText,
    } as unknown as Clipboard);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(JSON.parse(writeText.mock.calls[0][0] as string)).toEqual(row(sigs.kitLou[0]));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.click(raw);
    expect(raw).toHaveAttribute('aria-expanded', 'false');
  });

  it('never shows a message’s content, not even in the raw API response', async () => {
    const { user } = await show([row(sigs.message)]);
    await user.click(await screen.findByRole('button', { name: /message/i }, T));
    await user.click(screen.getByRole('button', { name: 'Raw API response' }));
    expect(screen.getByRole('region', { name: 'Raw API response' })).toHaveTextContent(
      '"data": "(not shown)"'
    );
    expect(document.body.textContent).not.toContain(MESSAGE_CONTENT);
  });

  it('shows a group change in words, without the fields only its raw data has', async () => {
    const invite = (world.pending as TxRow[]).find((t) => t.type === 'GROUP_INVITE') as TxRow;
    const { user, container } = await show([invite]);
    const button = await screen.findByRole('button', { name: /invite .* to MINTER/ }, T);
    await user.click(button);
    expect(screen.getByText('Group approval', { selector: 'dt' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/txGroupId|timeToLive|time to live/i);
  });

  it('marks a transaction waiting for a block', async () => {
    const waiting = { ...row(sigs.kitLou[0]), blockHeight: undefined };
    await show([waiting], ADDR.kicked);
    expect(
      await screen.findByRole('button', { name: /Waiting to be confirmed/ }, T)
    ).toBeInTheDocument();
  });
});
