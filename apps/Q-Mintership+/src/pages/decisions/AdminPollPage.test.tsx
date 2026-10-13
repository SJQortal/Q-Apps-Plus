import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADMIN_POLL_IDS } from '../../../e2e/world.mjs';
import { fromData64 } from '../../data/adminPollRecords';
import { resetPendingPollWrites } from '../../state/adminPolls';
import { withAdminPolls } from '../../test/adminPolls';
import { expectNoAxeViolations } from '../../test/axe';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import AdminPollPage from './AdminPollPage';

beforeEach(() => resetPendingPollWrites());
afterEach(() => vi.useRealTimers());
vi.setConfig({ testTimeout: 30_000 });

const T = { timeout: 6000 };
const OPEN_Q = 'Should only level 5+ minters become Minter Admins?';
const SHARED_Q = 'Should a nomination wait 48 hours before its first signature?';

function openPoll(id: string, persona = 'admin') {
  return renderPage(<AdminPollPage />, {
    persona,
    path: `/decisions/polls/${id}`,
    route: '/decisions/polls/:id',
    setup: withAdminPolls(persona),
  });
}

const privateReads = () => [
  ...fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
    p.includes('DOCUMENT_PRIVATE')
  ),
  ...fetchCallsFor('/arbitrary/DOCUMENT_PRIVATE/'),
];

describe('a Minter Admin poll’s own page', () => {
  it('shows the poll with its comments open, and Copy link in the header', async () => {
    await openPoll(ADMIN_POLL_IDS.open);
    const card = await screen.findByRole('article', { name: `Minter Admin poll: ${OPEN_Q}` }, T);
    expect(screen.getByRole('heading', { level: 1, name: 'Minter Admin poll' })).toBeVisible();
    expect(screen.getAllByText(OPEN_Q).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Copy a link to this poll' })).toBeVisible();
    expect(within(card).queryByRole('button', { name: /^Copy link to/ })).toBeNull();
    const thread = await within(card).findByRole('region', { name: `Comments on ${OPEN_Q}` }, T);
    expect(await within(thread).findByText(/they know how the network works/, {}, T)).toBeVisible();
    await expectNoAxeViolations(document.body);
  });

  it('votes from the page like from Decisions', async () => {
    const u = userEvent.setup();
    await openPoll(ADMIN_POLL_IDS.open);
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (request: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'S1',
      identifier: request.identifier,
    }));
    const card = await screen.findByRole('article', { name: `Minter Admin poll: ${OPEN_Q}` }, T);
    await u.click(within(card).getByRole('button', { name: `Vote Neutral: ${OPEN_Q}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Vote Neutral' });
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Vote published', {}, T)).toBeVisible();
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call).toMatchObject({
      encrypt: true,
      identifier: `qmp-adminvote-${ADMIN_POLL_IDS.open}`,
    });
    expect(fromData64(String(call.data64))).toMatchObject({ vote: 'neutral' });
  });

  it('a poll the admin reads through a share says so', async () => {
    await openPoll(ADMIN_POLL_IDS.shared);
    const card = await screen.findByRole('article', { name: `Minter Admin poll: ${SHARED_Q}` }, T);
    expect(within(card).getByText(/Shared by/)).toHaveTextContent(
      /Admin D ΑΩ: you read their copy/
    );
  });

  it('one the admin can’t read, or none at all, isn’t here; a malformed link says so', async () => {
    await openPoll(ADMIN_POLL_IDS.locked);
    expect(await screen.findByText('This poll isn’t here', {}, T)).toBeVisible();
    expect(screen.getByText(/a Minter Admin who can read it can share it with you/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'All decisions' })).toBeVisible();
  });

  it('a malformed link reads nothing', async () => {
    await openPoll('not-a-poll');
    expect(await screen.findByText('No Minter Admin poll with this link', {}, T)).toBeVisible();
    expect(privateReads()).toHaveLength(0);
  });

  it('“This is for Minter Admins only” to anyone else, and nothing read or decrypted', async () => {
    await openPoll(ADMIN_POLL_IDS.open, 'learner');
    expect(await screen.findByText('This is for Minter Admins only', {}, T)).toBeVisible();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy a link to this poll' })).toBeNull();
    expect(privateReads()).toHaveLength(0);
    expect(qortalCallsFor('DECRYPT_DATA')).toHaveLength(0);
  });

  it('signed out: the same, with Sign in', async () => {
    await openPoll(ADMIN_POLL_IDS.open, 'signedOut');
    expect(await screen.findByText('This is for Minter Admins only', {}, T)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(privateReads()).toHaveLength(0);
  });
});
