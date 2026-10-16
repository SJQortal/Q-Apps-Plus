/**
 * One transaction's page on the strict mock world: its type as the title,
 * the sentence, the facts, the people, the fields, raw API response on request
 * (never a message's content or an encrypted resource's identifier), a
 * minting-level move's recipient, a group approval's transaction and
 * MINTER decision, a waiting one, and a signature the node doesn't know
 * told apart from a failed read. Read-only: no POST, no write request.
 */
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ADDR,
  MESSAGE_CONTENT,
  answerCore,
  createWorld,
  fakeKey,
  type World,
} from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { expectNoAxeViolations } from '../../test/axe';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../test/setup';
import type { TxRow } from '../../data/types';
import { explorerTxPath } from '../../routes/paths';
import TxPage, { NO_SUCH_TX, NOT_A_SIGNATURE } from './TxPage';
import { readText } from '../../test/readText';

const T = { timeout: 4000 };

/**
 * The world's own answer to a read this test's route passes on, served the
 * way the harness serves it (its status too). A read the world can't answer
 * fails the test, as strict mode does, instead of coming back as 200 null.
 */
function worldAnswer(world: World, url: URL): Response {
  const answer = answerCore(world, url.pathname, url.searchParams);
  if (!answer) {
    const path = `${url.pathname}${url.search}`;
    onTestFinished(() => {
      throw new Error(`The mock world has no answer for: ${path}`);
    });
    throw new Error(`no mock for GET ${path}`);
  }
  if (answer.text !== undefined) return new Response(answer.text, { status: answer.status });
  return new Response(JSON.stringify(answer.body), { status: answer.status });
}
const ROUTE = '/explorer/tx/:signature';
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;
const sigs = createWorld().explorer.sigs;

async function open(signature: string, setup?: (world: World) => void) {
  const user = userEvent.setup();
  const result = await renderPage(<TxPage />, {
    persona: 'learner',
    path: explorerTxPath(signature),
    route: ROUTE,
    strict: true,
    setup,
  });
  return { ...result, user };
}

function noWrites(posts: string[]) {
  expect(posts).toEqual([]);
  expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
}

const fact = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent ?? '';
const h1 = (name: string) => screen.findByRole('heading', { level: 1, name }, T);

afterEach(() => vi.useRealTimers());

describe('one transaction', () => {
  it('a payment: its type, sentence, facts, people, fields, raw API response on request', async () => {
    const { user, container, posts } = await open(sigs.kitLou[0]);
    expect(await h1('Payment')).toBeVisible();
    // In the sentence, among the people, and as the payer's field.
    const kit = await screen.findAllByRole('link', { name: 'Kit Kicked: explore this account' }, T);
    expect(kit[0]).toHaveAttribute('href', `/explorer/account/${ADDR.kicked}`);
    expect(fact('Block')).toBe('1,364,500Every transaction in this block');
    expect(screen.getByRole('link', { name: 'Every transaction in this block' })).toHaveAttribute(
      'href',
      '/explorer/transactions?type=all&blocks=from-1364500&span=1&order=oldest'
    );
    expect(fact('Fee')).toBe('0.01 QORT');
    expect(fact('Signature')).toBe(`${sigs.kitLou[0]}Copy`);
    expect(screen.getByRole('button', { name: 'Copy the signature' })).toBeVisible();
    expect(screen.queryByText('Group approval', { selector: 'dt' })).toBeNull();
    const people = screen.getByRole('list', { name: 'Accounts involved' });
    expect(within(people).getAllByRole('listitem')).toHaveLength(2);
    expect(within(people).getByText('Creator')).toBeInTheDocument();
    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(details).getByText('Amount', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy a link to this transaction' })).toBeVisible();

    const raw = screen.getByRole('button', { name: 'Raw API response' });
    expect(raw).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('pre')).toBeNull();
    await user.click(raw);
    expect(raw).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Raw API response' })).toHaveTextContent(
      `"signature": "${sigs.kitLou[0]}"`
    );
    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('a message: never its content, not even in the raw data', async () => {
    const { user, container } = await open(sigs.message);
    expect(await h1('Message')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Raw API response' }));
    expect(container.querySelector('pre')?.textContent).toContain('"data": "(not shown)"');
    expect(document.body.textContent).not.toContain(MESSAGE_CONTENT);
  });

  it('an encrypted resource: its service, never its identifier', async () => {
    const { user } = await open(sigs.publishes[3]);
    expect(await h1('QDN publish')).toBeVisible();
    expect(await screen.findByText('MAIL_PRIVATE', {}, T)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Raw API response' }));
    expect(document.body.textContent).not.toContain('qortal_qmail_explorer_test');
  });

  it('a minting-level move names its recipient', async () => {
    await open(sigs.privs);
    expect(await h1('Minting level move')).toBeVisible();
    expect(
      await screen.findAllByRole('link', { name: 'Kai Target: explore this account' }, T)
    ).toHaveLength(3);
    expect(screen.getByText(/moved its minting level to/)).toBeInTheDocument();
    expect(screen.getByText('Moved to', { selector: 'dt' })).toBeInTheDocument();
  });

  it('a group approval links to what it answers, and to the MINTER decision', async () => {
    const world = createWorld();
    const approval = (world.approvals as TxRow[])[0];
    const pending = approval.pendingSignature as string;
    const { container, posts } = await open(approval.signature);
    expect(await h1('Group approval')).toBeVisible();
    const answers = await screen.findByRole('region', { name: 'The transaction it answers' }, T);
    await waitFor(() => expect(readText(answers)).toMatch(/invite .+ to MINTER/), T);
    expect(within(answers).getByRole('link', { name: 'Open that transaction' })).toHaveAttribute(
      'href',
      `/explorer/tx/${pending}`
    );
    expect(
      await within(answers).findByRole('link', { name: 'Open the MINTER decision' }, T)
    ).toHaveAttribute('href', `/decisions/${pending}`);
    // The region holds the sentence and its two links, nothing more.
    const sentence = readText(answers.querySelector('div.MuiTypography-body1'));
    expect(sentence).toMatch(/invite .+ to MINTER/);
    expect(readText(answers)).toBe(
      `The transaction it answers${sentence}Open that transactionOpen the MINTER decision`
    );
    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('a group approval of another group’s change has no MINTER decision link', async () => {
    const answerSig = fakeKey('tx-page:approval', 64);
    const targetSig = fakeKey('tx-page:target', 64);
    await open(answerSig, () => {
      mockFetchRoute(`/transactions/signature/${answerSig}`, {
        type: 'GROUP_APPROVAL',
        timestamp: 1_791_800_000_000,
        signature: answerSig,
        txGroupId: 0,
        blockHeight: 2_757_000,
        fee: '0.01000000',
        approvalStatus: 'NOT_REQUIRED',
        creatorAddress: ADDR.left,
        pendingSignature: targetSig,
        approval: true,
      });
      mockFetchRoute(`/transactions/signature/${targetSig}`, {
        type: 'GROUP_INVITE',
        timestamp: 1_791_790_000_000,
        signature: targetSig,
        txGroupId: 1203,
        blockHeight: 2_756_900,
        fee: '0.01000000',
        approvalStatus: 'APPROVED',
        creatorAddress: ADDR.left,
        groupId: 1203,
        invitee: ADDR.kicked,
      });
    });
    const answers = await screen.findByRole('region', { name: 'The transaction it answers' }, T);
    expect(await within(answers).findByText('Book Club', {}, T)).toBeInTheDocument();
    expect(within(answers).queryByRole('link', { name: 'Open the MINTER decision' })).toBeNull();
  });

  it('a transaction still waiting for a block says so, and where its approval stands', async () => {
    const world = createWorld();
    const waiting = (world.pending as TxRow[]).find((t) => typeof t.blockHeight !== 'number');
    await open((waiting as TxRow).signature);
    expect(await h1('Group admin removed')).toBeVisible();
    expect(fact('Block')).toBe('Waiting to be confirmed');
    expect(fact('Group approval')).toBe('Waiting for group approval');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('tells a signature the node doesn’t know apart from a failed read', async () => {
    await open(fakeKey('tx-page:unknown', 64));
    expect(await h1('No such transaction')).toBeVisible();
    expect(screen.getByText(NO_SUCH_TX)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Find an account or transaction' })).toBeVisible();
  });

  it('offers Retry after a failed read, then shows the transaction', async () => {
    let fail = true;
    const { user } = await open(sigs.kitLou[0], (world) =>
      mockFetchRoute('/transactions/signature/', (url: URL) => {
        if (fail) return new Response('node down', { status: 503 });
        return worldAnswer(world, url);
      })
    );
    expect(await screen.findByText("Couldn't load this transaction.", {}, T)).toBeVisible();
    expect(screen.queryByText(NO_SUCH_TX)).toBeNull();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await h1('Payment')).toBeVisible();
  });

  it('says so for text that isn’t a signature, without asking the node', async () => {
    await open('not-a-signature');
    expect(await screen.findByText(NOT_A_SIGNATURE, {}, T)).toBeVisible();
    expect(fetchCallsFor('/transactions/signature/')).toEqual([]);
  });
});
