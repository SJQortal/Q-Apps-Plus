/**
 * Home for every status in the mock world: the headline, a real number and
 * the primary action, plus the Accept / Join flows up to Hub (declined by
 * the mock, or answered by the test) without anything reaching a node.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getDefaultStore } from 'jotai';
import { HubThemeProvider } from '../../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme';
import { STORAGE_PREFIX } from '../../constants/plus';
import { invalidate, queryLoadCounts } from '../../data/query';
import { resetSessionStarter, signIn } from '../../state/session';
import { markWrite, pendingWritesAtom, writeKeys } from '../../writes/optimistic';
import { PROPOSE_NOMINATION } from '../../constants/words';
import { renderPage } from '../../test/render';
import { fetchCalls, mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR, TIP, installWorld } from '../../test/world';
import { decisionPath } from '../../routes/paths';
import { formatDate } from '../../utils/format';
import { seenTargetKey } from '../decisions/seenTarget';
import HomePage from './HomePage';

afterEach(() => vi.useRealTimers());

const T = { timeout: 3000 };

/** Headline of the status hero. */
async function headline(text: string | RegExp) {
  return screen.findByRole('heading', { level: 2, name: text }, T);
}

/** Makes Hub "accept" the next JOIN_GROUP: answers like Hub with the new transaction. */
function hubAcceptsJoin(address: string) {
  mockQortalRequest('JOIN_GROUP', () => ({
    type: 'JOIN_GROUP',
    signature: 'testJoinSignature1111111111111111111111111111111111111111111111',
    timestamp: Date.now(),
    groupId: 694,
    txGroupId: 0,
    creatorAddress: address,
  }));
}

/** What a join says after Hub's timeout when the lookup found nothing yet (runner.ts). */
const NOT_YET =
  "Hub stopped waiting before it answered, and the transaction hasn't shown up yet. It may still arrive: check again in a minute before trying again.";

/** Home's "Show you're ready to mint": the self-check ticked, then Continue to Hub. Returns the Hub step. */
async function readyThroughTheCheck() {
  await userEvent.click(screen.getByRole('button', { name: "Show you're ready to mint" }));
  const dialog = await screen.findByRole('dialog', { name: "Show you're ready to mint" }, T);
  await within(dialog).findByText(/so that's covered/, {}, T);
  for (const box of within(dialog).getAllByRole('checkbox')) await userEvent.click(box);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
  const go = await screen.findByRole('button', { name: 'Continue to Hub' }, T);
  const hub = go.closest<HTMLElement>('[role="dialog"]') as HTMLElement;
  expect(within(hub).getByText('Fee: 0.01 QORT')).toBeInTheDocument();
  await userEvent.click(go);
  return hub;
}

describe('Home: outside Hub and signed out', () => {
  it('explains Mintership with live numbers outside Hub', async () => {
    await renderPage(<HomePage />, { persona: 'outside' });
    await headline('Who mints QORT is decided here');
    expect(screen.getByText('Open this in Qortal Hub or GO to sign in.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy the app link/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
    // Live stats: 65 members, 19 who can sign, 8 needed (40% of 20 seats), 6 open nominations.
    const stats = await screen.findByRole('region', { name: 'MINTER today' });
    expect(await within(stats).findByText('65', {}, T)).toBeInTheDocument();
    expect(within(stats).getByText('19')).toBeInTheDocument();
    expect(within(stats).getByText('40% of 20 admin seats')).toBeInTheDocument();
    expect(await within(stats).findByText('6', {}, T)).toBeInTheDocument();
  });

  it('offers Sign in when signed out, and asks Hub again', async () => {
    await renderPage(<HomePage />, { persona: 'signedOut' });
    await headline('Who mints QORT is decided here');
    const hero = screen.getByRole('region', { name: 'Who mints QORT is decided here' });
    await waitFor(() => expect(hero).toHaveTextContent(/8 signatures are needed today/));
    const before = qortalCallsFor('GET_USER_ACCOUNT').length;
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(qortalCallsFor('GET_USER_ACCOUNT').length).toBeGreaterThan(before));
  });
});

describe('Home: Minter Admins', () => {
  it('leads with the decisions waiting for their signature', async () => {
    const { posts } = await renderPage(<HomePage />, { persona: 'admin' });
    await headline('Avery Admin, 6 decisions are waiting for your signature');
    expect(screen.getByText(/2 days 5 hours/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review decisions/ })).toHaveAttribute(
      'href',
      '/decisions'
    );
    // The three most urgent rows, most urgent first.
    const waiting = screen.getByRole('region', { name: 'Waiting for your signature' });
    const rows = within(waiting).getAllByRole('link', { name: /signatures\./ });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName(/Become a Minter Admin: Pia Promote\. 5 of 8 signatures/);
    // Activity: signed 2 of the 8 open ones; 4 approved invites nobody used.
    const activity = screen.getByRole('region', { name: 'Your activity' });
    expect(within(activity).getByText('2 of 8')).toBeInTheDocument();
    expect(await within(activity).findByText('4', {}, T)).toBeInTheDocument();
    expect(within(activity).getByText('Unusual approval route')).toBeInTheDocument();
    // A nomination still waiting for its first signature.
    const hero = screen.getByRole('region', { name: /waiting for your signature$/ });
    await waitFor(() =>
      expect(hero).toHaveTextContent(/1 nomination is waiting for a first signature/)
    );
    expect(screen.getByRole('region', { name: 'Waiting for a first signature' })).toHaveTextContent(
      /Wren Waiting/
    );
    // The member view below: their own minting numbers.
    expect(screen.getByText('1,730,799')).toBeInTheDocument();
    expect(posts).toEqual([]);
  });

  it('reloads every section on Refresh, even while the status is being read', async () => {
    await renderPage(<HomePage />, { persona: 'admin' });
    await headline('Avery Admin, 6 decisions are waiting for your signature');
    const decisionReads = () => queryLoadCounts().decisions ?? 0;
    await waitFor(() => expect(decisionReads()).toBeGreaterThan(0));
    const before = decisionReads();
    // The status poll is reading when Refresh is pressed.
    act(() => invalidate('status:'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(decisionReads()).toBeGreaterThan(before));
  });

  it('lets an admin below level 5 nominate too', async () => {
    await renderPage(<HomePage />, { persona: 'adminL4' });
    await headline(/Juniper L4, 8 decisions are waiting/);
    expect(screen.getByText(/1 hour 35 minutes/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: PROPOSE_NOMINATION }, T)).toHaveAttribute(
      'href',
      '/nominate'
    );
    expect(screen.getByText('217,400')).toBeInTheDocument();
  });

  it('says the target changed since Decisions last showed it, and links there', async () => {
    // Decisions last showed 21 admin seats and 9 signatures; today it is 20 and 8.
    const seen = JSON.stringify({ adminCount: 21, needed: 9, height: TIP - 100 });
    window.localStorage.setItem(seenTargetKey(), seen);
    await renderPage(<HomePage />, { persona: 'admin' });
    const hero = await screen.findByRole('region', { name: /waiting for your signature$/ }, T);
    await waitFor(() =>
      expect(hero).toHaveTextContent(
        /The target changed from 9 to 8 signatures since you last looked at Decisions\. See what changed/
      )
    );
    expect(within(hero).getByRole('link', { name: 'See what changed' })).toHaveAttribute(
      'href',
      '/decisions'
    );
    // Only Decisions keeps the seen target: Home leaves it as it was.
    expect(window.localStorage.getItem(seenTargetKey())).toBe(seen);
  });

  it('says nothing about the target when it has not moved, or Decisions was never opened', async () => {
    const seen = JSON.stringify({ adminCount: 20, needed: 8, height: TIP - 100 });
    window.localStorage.setItem(seenTargetKey(), seen);
    const first = await renderPage(<HomePage />, { persona: 'admin' });
    const hero = await screen.findByRole('region', { name: /waiting for your signature$/ }, T);
    await waitFor(() => expect(hero).toHaveTextContent(/Each decision needs 8 signatures/));
    expect(hero).not.toHaveTextContent(/target changed/);
    expect(within(hero).queryByRole('link', { name: 'See what changed' })).toBeNull();
    expect(window.localStorage.getItem(seenTargetKey())).toBe(seen);
    first.unmount();

    window.localStorage.removeItem(seenTargetKey());
    await renderPage(<HomePage />, { persona: 'admin' });
    const again = await screen.findByRole('region', { name: /waiting for your signature$/ }, T);
    await waitFor(() => expect(again).toHaveTextContent(/Each decision needs 8 signatures/));
    expect(again).not.toHaveTextContent(/target changed/);
    expect(window.localStorage.getItem(seenTargetKey())).toBeNull();
  });
});

describe('Home: members', () => {
  it('tells a level 5+ member they can nominate, with their nominations', async () => {
    await renderPage(<HomePage />, { persona: 'nominator' });
    await headline('Nora Nominator, you can nominate new minters');
    expect(screen.getAllByText('980,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('502,400').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: PROPOSE_NOMINATION })[0]).toHaveAttribute(
      'href',
      '/nominate'
    );
    expect(
      await screen.findByText(
        /open nominations: 1 waiting for a Minter Admin and 2 collecting signatures/,
        {},
        T
      )
    ).toBeInTheDocument();
    const mine = screen.getByRole('region', { name: 'Your nominations' });
    expect(within(mine).getAllByRole('article')).toHaveLength(3);
    expect(
      within(mine).getByRole('link', { name: 'See all 5 on Nominations' })
    ).toBeInTheDocument();
  });

  it('shows a member below level 5 their way to level 5, with minting tips', async () => {
    await renderPage(<HomePage />, { persona: 'learner' });
    await headline("You're minting, Leo Learner");
    expect(screen.getAllByText('90,500').length).toBeGreaterThan(0);
    expect(screen.getByText('111,100')).toBeInTheDocument();
    // Every number says what it counts.
    const sentence = (re: RegExp) => (_: string, el: Element | null) =>
      Boolean(
        el &&
        re.test(el.textContent ?? '') &&
        ![...el.children].some((c) => re.test(c.textContent ?? ''))
      );
    expect(
      screen.getByText(sentence(/blocks minted: 111,100 more blocks to go\./))
    ).toBeInTheDocument();
    expect(
      screen.getByText(sentence(/blocks for level 5 \([\d,]+ blocks to go\)/))
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Progress to level 5: 15%' })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Minting tips' }));
    const dialog = await screen.findByRole('dialog', { name: 'Minting tips' });
    expect(within(dialog).getByText('618,400')).toBeInTheDocument();
  });

  it('welcomes a nominee who became a member since Home last showed them, once', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}last-status:${ADDR.learner}`, 'nominated');
    const first = await renderPage(<HomePage />, { persona: 'learner' });
    expect(await headline('Welcome to MINTER, Leo Learner!')).toBeInTheDocument();
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}last-status:${ADDR.learner}`)).toBe(
      'member'
    );
    first.unmount();
    await renderPage(<HomePage />, { persona: 'learner' });
    expect(await headline("You're minting, Leo Learner")).toBeInTheDocument();
  });

  it('welcomes an account that had shown it was ready, once it becomes a member', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}last-status:${ADDR.learner}`, 'ready');
    await renderPage(<HomePage />, { persona: 'learner' });
    expect(await headline('Welcome to MINTER, Leo Learner!')).toBeInTheDocument();
  });

  it('does not load the whole group for members who cannot nominate', async () => {
    await renderPage(<HomePage />, { persona: 'learner' });
    await headline("You're minting, Leo Learner");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchCalls.some((p) => p.startsWith('/groups/members/694?limit='))).toBe(false);
    expect(fetchCalls.some((p) => p.includes('identifier=qmp-nomination-&'))).toBe(false);
  });
});

describe('Home: the Minter Admin role', () => {
  it("posts an optional statement as the proposal's first comment, one more Hub step", async () => {
    const { world, address } = await renderPage(<HomePage />, { persona: 'learner' });
    await headline("You're minting, Leo Learner");
    const role = await screen.findByRole('region', { name: 'Minter Admins' }, T);
    const proposal = 'statementSignature1111111111111111111111111111111111111111111111';
    mockQortalRequest('ADD_GROUP_ADMIN', (req: Record<string, unknown>) => {
      const tx = {
        type: 'ADD_GROUP_ADMIN',
        timestamp: Date.now(),
        reference: 'r',
        signature: proposal,
        txGroupId: 694,
        groupId: 694,
        approvalStatus: 'PENDING',
        creatorAddress: address,
        member: req.qortalAddress,
      };
      world.pending.push(tx);
      return tx;
    });
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (req: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      timestamp: Date.now(),
      signature: 'statementPublish11111111111111111111111111111111111111111111111',
      identifier: req.identifier,
    }));
    await waitFor(() =>
      expect(within(role).getByRole('button', { name: 'Become a Minter Admin' })).toBeEnabled()
    );
    await userEvent.click(within(role).getByRole('button', { name: 'Become a Minter Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Become a Minter Admin' }, T);
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'A short statement (optional)' }),
      'I check Decisions every day.'
    );
    expect(within(dialog).getByText(/Step 2 of 2: Post your statement/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Proposed', {}, T)).toBeVisible();
    const [published] = qortalCallsFor('PUBLISH_QDN_RESOURCE') as Array<Record<string, unknown>>;
    expect(published).toEqual(
      expect.objectContaining({
        service: 'JSON',
        identifier: expect.stringMatching(new RegExp(`^qmp-comment-${proposal.slice(0, 40)}-`)),
      })
    );
    const body = JSON.parse(atob(String(published.data64)));
    expect(body).toEqual(
      expect.objectContaining({
        v: 1,
        key: proposal.slice(0, 40),
        text: 'I check Decisions every day.',
      })
    );
  });

  it('lets any member propose themselves in one Hub step, and says the admins decide', async () => {
    const { world, address } = await renderPage(<HomePage />, { persona: 'learner' });
    await headline("You're minting, Leo Learner");
    const role = await screen.findByRole('region', { name: 'Minter Admins' }, T);
    expect(
      within(role).getByText(
        /Any member can propose themselves; the Minter Admins decide, with 8 signatures\./
      )
    ).toBeVisible();
    mockQortalRequest('ADD_GROUP_ADMIN', (req: Record<string, unknown>) => {
      const tx = {
        type: 'ADD_GROUP_ADMIN',
        timestamp: Date.now(),
        reference: 'r',
        signature: 'becomeSignature111111111111111111111111111111111111111111111111',
        txGroupId: 694,
        groupId: 694,
        approvalStatus: 'PENDING',
        creatorAddress: address,
        member: req.qortalAddress,
      };
      world.pending.push(tx);
      return tx;
    });
    await waitFor(() =>
      expect(within(role).getByRole('button', { name: 'Become a Minter Admin' })).toBeEnabled()
    );
    await userEvent.click(within(role).getByRole('button', { name: 'Become a Minter Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Become a Minter Admin' }, T);
    expect(within(dialog).getByText(/This proposes you as a Minter Admin\./)).toBeVisible();
    expect(
      within(dialog).getByText(
        /this is one Hub confirmation: once it is proposed, the Minter Admins decide/
      )
    ).toBeVisible();
    // One step, one fee: a member can't sign.
    expect(within(dialog).getByText('Fee: 0.01 QORT')).toBeInTheDocument();
    expect(within(dialog).getByText('Propose it')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Sign it/)).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Proposed', {}, T)).toBeVisible();
    expect(within(dialog).getByText(/The Minter Admins will now decide/)).toBeVisible();
    expect(qortalCallsFor('ADD_GROUP_ADMIN')).toEqual([
      expect.objectContaining({ groupId: 694, qortalAddress: address, txGroupId: 694 }),
    ]);
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    // The queue shows it at once: Home says it is waiting, and links to it.
    expect(
      await within(role).findByText(/Your proposal to become a Minter Admin is waiting/, {}, T)
    ).toBeVisible();
  });

  it('suggests level 5+ to a member below it, without stopping them', async () => {
    await renderPage(<HomePage />, { persona: 'learner' });
    const role = await screen.findByRole('region', { name: 'Minter Admins' }, T);
    expect(
      within(role).getByText(
        'Level 5+ is suggested for Minter Admins, and you’re level 2. You can still propose yourself.'
      )
    ).toBeVisible();
    // A note, not a block: the button works as for anyone.
    const become = within(role).getByRole('button', { name: 'Become a Minter Admin' });
    await waitFor(() => expect(become).toBeEnabled());
    await userEvent.click(become);
    const dialog = await screen.findByRole('dialog', { name: 'Become a Minter Admin' }, T);
    expect(
      within(dialog).getByText(/^Level 5\+ is suggested for Minter Admins, and you’re level 2\./)
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Continue to Hub' })).toBeEnabled();
  });

  it('says nothing about the level to a member at level 5 or above', async () => {
    await renderPage(<HomePage />, { persona: 'nominator' });
    const role = await screen.findByRole('region', { name: 'Minter Admins' }, T);
    const become = within(role).getByRole('button', { name: 'Become a Minter Admin' });
    await waitFor(() => expect(become).toBeEnabled());
    expect(within(role).queryByText(/is suggested for Minter Admins/)).toBeNull();
    await userEvent.click(become);
    const dialog = await screen.findByRole('dialog', { name: 'Become a Minter Admin' }, T);
    expect(within(dialog).queryByText(/is suggested for Minter Admins/)).toBeNull();
  });

  it('says when a member’s own proposal is already waiting, and links to it', async () => {
    const { world } = await renderPage(<HomePage />, { persona: 'promote' });
    const role = await screen.findByRole('region', { name: 'Minter Admins' }, T);
    expect(
      await within(role).findByText(/Your proposal to become a Minter Admin is waiting/, {}, T)
    ).toBeVisible();
    const add = world.pending.find((t: { type: string }) => t.type === 'ADD_GROUP_ADMIN');
    expect(within(role).getByRole('link', { name: 'Open the decision' })).toHaveAttribute(
      'href',
      decisionPath(add.signature)
    );
    expect(within(role).queryByRole('button', { name: 'Become a Minter Admin' })).toBeNull();
  });

  it('leaves Step down off an admin’s Home: it is on their own page', async () => {
    await renderPage(<HomePage />, { persona: 'adminL4' });
    await headline(/Juniper L4, 8 decisions are waiting/);
    // The member view below the admin's is in: nothing about the role follows it.
    expect(await screen.findByRole('region', { name: 'Your minting' }, T)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your Minter Admin role' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Minter Admins' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Step down as Minter Admin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Become a Minter Admin' })).toBeNull();
  });

  it('offers nothing about the role to someone outside MINTER', async () => {
    await renderPage(<HomePage />, { persona: 'newcomerName' });
    await headline(/Zoë/);
    expect(screen.queryByRole('button', { name: 'Become a Minter Admin' })).toBeNull();
  });
});

describe('Home: not in MINTER yet', () => {
  it('tells a newcomer nominators reach out, and offers to show they are ready', async () => {
    const { address, posts } = await renderPage(<HomePage />, { persona: 'newcomer' });
    await headline("You're not in the MINTER group yet");
    const hero = screen.getByRole('region', { name: "You're not in the MINTER group yet" });
    expect(hero).toHaveTextContent(
      /Nominators, minters at level 5 or above, look for people who.d make good minters, and often reach out first\./
    );
    await waitFor(() =>
      expect(hero).toHaveTextContent(
        /When one nominates you, you accept, and 8 Minter Admins sign, you.re in\./
      )
    );
    expect(await within(hero).findByText('0 QORT', {}, T)).toBeInTheDocument();
    expect(hero).toHaveTextContent(/ask someone you know on Qortal to send you a little QORT/);
    expect(within(hero).getByRole('button', { name: 'Copy your address' })).toBeInTheDocument();
    expect(within(hero).getByRole('link', { name: 'See open nominations' })).toHaveAttribute(
      'href',
      '/nominations'
    );
    // "Show you're ready to mint" replaced "Find a nominator": nothing offers it any more.
    expect(screen.queryByText(/find a nominator/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /nominator/i })).toBeNull();
    mockQortalRequest('OPEN_NEW_TAB', true);
    await userEvent.click(within(hero).getByRole('button', { name: /Register a name/ }));
    expect(qortalCallsFor('OPEN_NEW_TAB')[0]).toMatchObject({ qortalLink: 'qortal://APP/Names' });

    // The self-check opens first; with 0 QORT it can't go on.
    await userEvent.click(screen.getByRole('button', { name: "Show you're ready to mint" }));
    const dialog = await screen.findByRole('dialog', { name: "Show you're ready to mint" }, T);
    expect(
      await within(dialog).findByText('You need 0.01 QORT for the fee first.', {}, T)
    ).toBeInTheDocument();
    expect(within(dialog).getByText(address)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(qortalCallsFor('JOIN_GROUP')).toHaveLength(0);
    expect(posts).toEqual([]);
  });

  it('uses the name, and copies it to share with a nominator', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderPage(<HomePage />, { persona: 'newcomerName' });
    await headline("Hi Zoë Newcomer, you're not in MINTER yet");
    const hero = screen.getByRole('region', { name: /you're not in MINTER yet/ });
    expect(await within(hero).findByText('12.5 QORT', {}, T)).toBeInTheDocument();
    expect(hero).toHaveTextContent(/Nominators can find you by your name, Zoë Newcomer/);
    expect(within(hero).queryByRole('button', { name: /Register a name/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Copy your name' }));
    expect(writeText).toHaveBeenCalledWith('Zoë Newcomer');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See open nominations' })).toBeInTheDocument();
  });

  it('changes nothing on Home when Hub is declined', async () => {
    const { posts } = await renderPage(<HomePage />, { persona: 'newcomerName' });
    await headline("Hi Zoë Newcomer, you're not in MINTER yet");
    const hub = await readyThroughTheCheck();
    expect(await within(hub).findByText(/Cancelled in Hub/, {}, T)).toBeInTheDocument();
    await userEvent.click(within(hub).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await headline("Hi Zoë Newcomer, you're not in MINTER yet")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Show you're ready to mint" })).toBeEnabled();
    expect(qortalCallsFor('JOIN_GROUP')).toHaveLength(1);
    expect(posts).toEqual([]);
  }, 20_000);

  it('shows "You\'ve shown you\'re ready to mint" once Hub sends the join request', async () => {
    const { address, posts } = await renderPage(<HomePage />, { persona: 'newcomerName' });
    await headline("Hi Zoë Newcomer, you're not in MINTER yet");
    hubAcceptsJoin(address);
    const hub = await readyThroughTheCheck();
    expect(
      await within(hub).findByText("You've shown you're ready to mint ✓", {}, T)
    ).toBeInTheDocument();
    await userEvent.click(within(hub).getByRole('button', { name: 'Done' }));
    expect(await headline("Zoë Newcomer, you've shown you're ready to mint")).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: /you've shown you're ready to mint/ });
    expect(hero).toHaveTextContent(/Your join request is on its way into a block/);
    expect(within(hero).queryByRole('button', { name: "Show you're ready to mint" })).toBeNull();
    expect(posts).toEqual([]);
    getDefaultStore().set(pendingWritesAtom, {});
  }, 20_000);

  it('drops "hasn’t shown up yet" once the join request is in a block', async () => {
    const { world, address } = await renderPage(<HomePage />, { persona: 'newcomerName' });
    await headline("Hi Zoë Newcomer, you're not in MINTER yet");
    // Hub stopped waiting, and the lookup found nothing yet.
    act(() => markWrite(writeKeys.join(address), 'failed', { message: NOT_YET }));
    const hero = screen.getByRole('region', { name: /you're not in MINTER yet/ });
    expect(await within(hero).findByText(NOT_YET)).toBeVisible();
    // A minute later it is in a block.
    world.joinRequests.push({ groupId: 694, joiner: address });
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await headline("Zoë Newcomer, you've shown you're ready to mint")).toBeInTheDocument();
    expect(screen.queryByText(NOT_YET)).toBeNull();
    getDefaultStore().set(pendingWritesAtom, {});
  });

  it('says what happens next once they have shown they are ready', async () => {
    const { world, address } = await renderPage(<HomePage />, { persona: 'newcomerName' });
    await headline("Hi Zoë Newcomer, you're not in MINTER yet");
    world.joinRequests.push({ groupId: 694, joiner: address });
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await headline("Zoë Newcomer, you've shown you're ready to mint")).toBeInTheDocument();
    expect(screen.getByText('Ready to mint')).toBeInTheDocument();
    // Remembered, so the welcome plays when an approved nomination makes them a member.
    await waitFor(() =>
      expect(window.localStorage.getItem(`${STORAGE_PREFIX}last-status:${address}`)).toBe('ready')
    );
    const hero = screen.getByRole('region', { name: /you've shown you're ready to mint/ });
    expect(hero).toHaveTextContent(
      /Your join request is open, so nominators and Minter Admins can see that you.d like to mint\./
    );
    expect(hero).toHaveTextContent(/It can.t be withdrawn/);
    expect(hero).toHaveTextContent(
      /may nominate you\. Then Minter Admins sign: once 8 have signed, you.re in at once/
    );
    expect(within(hero).queryByRole('button', { name: "Show you're ready to mint" })).toBeNull();
    expect(within(hero).getByRole('button', { name: 'Copy your name' })).toBeInTheDocument();
    // How it works says the same: nominators reach out, and being ready counts as accepting.
    const how = screen.getByRole('region', { name: 'How joining MINTER works' });
    expect(how).toHaveTextContent(/often reach out first/);
    expect(how).toHaveTextContent(/shown you.re ready to mint, that request is in/);
  });
});

describe('Home: nominated', () => {
  it('shows who nominated and how long it stays open, and explains Accept before Hub', async () => {
    const { posts } = await renderPage(<HomePage />, { persona: 'nominatedWaiting' });
    await headline("Wren Waiting, you've been nominated for MINTER");
    const hero = screen.getByRole('region', { name: /you've been nominated/ });
    expect(hero).toHaveTextContent(
      /Nominated by Nora Nominator 2 days ago, also supported by Juniper L4\./
    );
    expect(hero).toHaveTextContent(/stays open for 6 days 12 hours more/);

    await userEvent.click(screen.getByRole('button', { name: 'Accept nomination' }));
    const dialog = await screen.findByRole('dialog', { name: 'Accept your nomination' });
    expect(within(dialog).getByText(/Hub asks you to confirm joining the group MINTER/));
    expect(within(dialog).getByText('Fee: 0.01 QORT')).toBeInTheDocument();
    expect(qortalCallsFor('JOIN_GROUP')).toHaveLength(0);

    // The mock Hub declines: nothing changes on the page.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText(/Cancelled in Hub\. Nothing was sent\./, {}, T));
    expect(qortalCallsFor('JOIN_GROUP')).toEqual([{ action: 'JOIN_GROUP', groupId: 694 }]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Accept nomination' })).toBeEnabled();
    expect(screen.queryByText(/You're ready ✓/)).toBeNull();
    expect(posts).toEqual([]);
  });

  it('shows "You\'re ready ✓" once Hub sends the join request', async () => {
    const { address, posts } = await renderPage(<HomePage />, { persona: 'nominatedWaiting' });
    await headline("Wren Waiting, you've been nominated for MINTER");
    hubAcceptsJoin(address);
    await userEvent.click(screen.getByRole('button', { name: 'Accept nomination' }));
    const dialog = await screen.findByRole('dialog', { name: 'Accept your nomination' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText("You're ready ✓", {}, T)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(
      await screen.findByText(
        "You're ready ✓ (confirming…): when the admins approve, you're in at once.",
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept nomination' })).toBeNull();
    expect(posts).toEqual([]);
    getDefaultStore().set(pendingWritesAtom, {});
  });

  it('shows k of n with the time left to sign once Minter Admins are signing', async () => {
    await renderPage(<HomePage />, { persona: 'nominatedSigning' });
    await headline('bob+builder, Minter Admins are signing your nomination');
    // An earlier Accept whose lookup found nothing in time: the join request is in now.
    act(() => markWrite(writeKeys.join(ADDR.nominatedSigning), 'failed', { message: NOT_YET }));
    const hero = screen.getByRole('region', { name: /signing your nomination/ });
    expect(hero).not.toHaveTextContent(NOT_YET);
    expect(within(hero).getByRole('img', { name: '5 of 8 signatures, 1 confirming' }));
    expect(hero).toHaveTextContent(/5 of 8 signatures so far, 1 more confirming\. 2 more needed/);
    expect(within(hero).getByText('left to sign')).toBeInTheDocument();
    expect(within(hero).getByText(/^Last block a signature counts in: /)).toBeVisible();
    // The join request is in: one wording, however it was sent.
    expect(
      within(hero).getByText("You're ready ✓: when the admins approve, you're in at once.")
    ).toBeInTheDocument();
    expect(hero).not.toHaveTextContent(/accepted/i);
    expect(screen.queryByRole('button', { name: 'Accept nomination' })).toBeNull();
    expect(within(hero).getByRole('link', { name: 'See your nomination' })).toHaveAttribute(
      'href',
      `/nominations/${ADDR.nominatedSigning}`
    );
    // The full nomination below, with its reason.
    expect(screen.getByRole('region', { name: 'Your nomination' })).toHaveTextContent(
      /reliable node/
    );
    getDefaultStore().set(pendingWritesAtom, {});
  });
});

describe('Home: approved, one step left', () => {
  it('explains Join now before Hub, and a decline changes nothing', async () => {
    const { posts } = await renderPage(<HomePage />, { persona: 'approved' });
    await headline('You were approved, one step left');
    const hero = screen.getByRole('region', { name: /one step left/ });
    expect(hero).toHaveTextContent(/approved you 6 days ago, on an invite from Admin D/);
    await userEvent.click(screen.getByRole('button', { name: 'Join now' }));
    const dialog = await screen.findByRole('dialog', { name: 'Join MINTER' });
    expect(within(dialog).getByText('Fee: 0.01 QORT')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText(/Cancelled in Hub/, {}, T));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await headline('You were approved, one step left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join now' })).toBeEnabled();
    expect(posts).toEqual([]);
  });

  it('welcomes them once Hub sends the join', async () => {
    const { address } = await renderPage(<HomePage />, { persona: 'approved' });
    await headline('You were approved, one step left');
    hubAcceptsJoin(address);
    await userEvent.click(screen.getByRole('button', { name: 'Join now' }));
    const dialog = await screen.findByRole('dialog', { name: 'Join MINTER' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Welcome to MINTER ✓', {}, T)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(await headline('Welcome to MINTER, Ada Approved!')).toBeInTheDocument();
    getDefaultStore().set(pendingWritesAtom, {});
  });
});

describe('Home: former members', () => {
  it('tells a kicked member when, that the level stays, and how to come back', async () => {
    await renderPage(<HomePage />, { persona: 'kicked' });
    await headline('Kit Kicked, you were removed from MINTER');
    const hero = screen.getByRole('region', { name: /removed from MINTER/ });
    expect(hero).toHaveTextContent(
      /removed you on 26 Aug 2026 \(46 days ago\), proposed by Admin B/
    );
    expect(hero).toHaveTextContent(/level 3 with 210,000 blocks minted/);
    expect(hero).toHaveTextContent(/A new nomination is possible\. Nominators, minters at level 5/);
    expect(hero).toHaveTextContent(/often reach out first/);
    expect(within(hero).getByRole('button', { name: 'Copy your name' })).toBeInTheDocument();
    expect(within(hero).getByRole('link', { name: 'See your MINTER history' })).toBeInTheDocument();
    // Former members are offered "Show you're ready to mint", not "Find a nominator".
    expect(screen.queryByText(/find a nominator/i)).toBeNull();
    await userEvent.click(within(hero).getByRole('button', { name: "Show you're ready to mint" }));
    expect(await screen.findByRole('dialog', { name: "Show you're ready to mint" }, T));
  });

  it('words a removal right for an account that was never a member', async () => {
    const { world, address } = await renderPage(<HomePage />, { persona: 'kicked' });
    await headline('Kit Kicked, you were removed from MINTER');
    world.decided = world.decided.filter(
      (tx: { type: string; invitee?: string }) =>
        !(tx.type === 'GROUP_INVITE' && tx.invitee === address)
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await headline("You were removed from MINTER's join list")).toBeInTheDocument();
    expect(screen.getByText('Not in MINTER')).toBeInTheDocument();
  });

  it('tells a banned member the ban must be lifted first', async () => {
    await renderPage(<HomePage />, { persona: 'banned' });
    await headline('Bram Banned, your account is banned from MINTER');
    const hero = screen.getByRole('region', { name: /banned from MINTER/ });
    expect(hero).toHaveTextContent(/61 days ago/);
    expect(hero).toHaveTextContent(/It's permanent\./);
    expect(hero).toHaveTextContent(/Minter Admins must lift the ban/);
    expect(hero).toHaveTextContent(/needs 8 signatures/);
    expect(within(hero).queryByRole('button')).toBeNull();
  });

  it('tells a banned account that was never a member it can join, not rejoin', async () => {
    await renderPage(<HomePage />, {
      persona: 'banned',
      setup: (world) => {
        world.decided = world.decided.filter(
          (tx: { type: string; invitee?: string }) =>
            !(tx.type === 'GROUP_INVITE' && tx.invitee === world.bans[0].offender)
        );
      },
    });
    await headline('Bram Banned, your account is banned from MINTER');
    const hero = screen.getByRole('region', { name: /banned from MINTER/ });
    expect(hero).toHaveTextContent(/Before you can join, Minter Admins must lift the ban/);
    expect(hero).not.toHaveTextContent(/rejoin/);
    expect(screen.getByText('Not in MINTER')).toBeInTheDocument();
  });

  it('says a lifted ban was lifted, not that it ran out', async () => {
    await renderPage(<HomePage />, {
      persona: 'banned',
      setup: (world) => {
        const ban = world.decided.find((tx: { type: string }) => tx.type === 'GROUP_BAN');
        world.bans = world.bans.filter((b: { offender: string }) => b.offender !== ban.offender);
        world.decided.push({
          ...ban,
          type: 'CANCEL_GROUP_BAN',
          signature: `${ban.signature.slice(0, -4)}Lift`,
          member: ban.offender,
          offender: undefined,
          timeToLive: undefined,
          blockHeight: ban.approvalHeight + 1000,
          approvalHeight: ban.approvalHeight + 1500,
        });
      },
    });
    await headline('Your ban from MINTER was lifted');
    const hero = screen.getByRole('region', { name: /ban from MINTER was lifted/ });
    expect(hero).toHaveTextContent(/The Minter Admins banned this account on /);
    expect(hero).toHaveTextContent(/The Minter Admins lifted it on /);
    expect(hero).not.toHaveTextContent(/run out|removed/);
  });

  it('says when a timed ban ended, not that they were removed', async () => {
    let ended = 0;
    await renderPage(<HomePage />, {
      persona: 'banned',
      setup: (world) => {
        const ban = world.decided.find((tx: { type: string }) => tx.type === 'GROUP_BAN');
        ban.timeToLive = 3 * 86_400;
        // Counted from when it was proposed, as Core counts it.
        ended = ban.timestamp + 3 * 86_400_000;
        world.bans = world.bans.filter((b: { offender: string }) => b.offender !== ban.offender);
      },
    });
    await headline('Your ban from MINTER has ended');
    const hero = screen.getByRole('region', { name: /ban from MINTER has ended/ });
    expect(hero).toHaveTextContent(new RegExp(`The ban ended on ${formatDate(ended)} \\(`));
    expect(hero).not.toHaveTextContent(/run out|removed/);
  });

  it('says a permanent ban that is no longer in force has ended, not run out', async () => {
    await renderPage(<HomePage />, {
      persona: 'banned',
      setup: (world) => {
        world.bans = world.bans.slice(1);
      },
    });
    await headline('Your ban from MINTER has ended');
    const hero = screen.getByRole('region', { name: /ban from MINTER has ended/ });
    expect(hero).toHaveTextContent(/That ban has ended\./);
    expect(hero).not.toHaveTextContent(/run out/);
  });

  it('tells a member who left when, and that a new nomination is possible', async () => {
    await renderPage(<HomePage />, { persona: 'left' });
    await headline('Lou Left, you left MINTER');
    const hero = screen.getByRole('region', { name: /you left MINTER/ });
    expect(hero).toHaveTextContent(/14 days ago/);
    expect(hero).toHaveTextContent(/level 5 with 640,000 blocks minted/);
    expect(hero).toHaveTextContent(/A new nomination is possible/);
    expect(
      within(hero).getByRole('button', { name: "Show you're ready to mint" })
    ).toBeInTheDocument();
  });

  it("keeps a former member's story and says they have shown they are ready", async () => {
    await renderPage(<HomePage />, {
      persona: 'left',
      setup: (world) => world.joinRequests.push({ groupId: 694, joiner: ADDR.left }),
    });
    await headline('Lou Left, you left MINTER');
    // An earlier send whose lookup found nothing in time: the join request is in now.
    act(() => markWrite(writeKeys.join(ADDR.left), 'failed', { message: NOT_YET }));
    const hero = screen.getByRole('region', { name: /you left MINTER/ });
    expect(hero).not.toHaveTextContent(NOT_YET);
    expect(hero).toHaveTextContent(/14 days ago/);
    expect(within(hero).getByRole('status')).toHaveTextContent(
      'You’ve shown you’re ready to mint ✓'
    );
    expect(hero).toHaveTextContent(/see that you.d like to mint again/);
    expect(hero).toHaveTextContent(/once 8 have signed, you.re in at once/);
    expect(within(hero).queryByRole('button', { name: "Show you're ready to mint" })).toBeNull();
    getDefaultStore().set(pendingWritesAtom, {});
  });
});

describe('Home: loading and errors', () => {
  it('shows a skeleton, then an error with Retry, then the status', async () => {
    const installed = installWorld('learner');
    let fail = true;
    mockFetchRoute(/^\/addresses\/Q/, (url: URL) =>
      fail
        ? new Response(JSON.stringify({ error: 1, message: 'node busy' }), { status: 500 })
        : new Response(
            JSON.stringify({
              address: installed.address,
              level: 2,
              blocksMinted: 90_500,
              blocksMintedAdjustment: 0,
              blocksMintedPenalty: 0,
              path: url.pathname,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
    );
    resetSessionStarter();
    getDefaultStore().set(pendingWritesAtom, {});
    await signIn();
    render(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </MemoryRouter>
      </HubThemeProvider>
    );
    expect(screen.getByRole('status', { name: 'Loading your status' })).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load your MINTER status.", {}, T)).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await headline("You're minting, Leo Learner")).toBeInTheDocument();
    expect(ADDR.learner).toBe(installed.address);
  });
});

describe('Home: an admin with no open decisions', () => {
  it('says there are none, not "0 of 0"', async () => {
    await renderPage(<HomePage />, {
      persona: 'admin',
      setup: (world) => {
        world.pending.length = 0;
      },
    });
    const activity = await screen.findByRole('region', { name: 'Your activity' });
    await waitFor(() => expect(within(activity).getByText('None')).toBeInTheDocument());
    expect(within(activity).getByText('Open decisions right now')).toBeInTheDocument();
    expect(within(activity).queryByText(/0 of 0/)).toBeNull();
  }, 15_000);
});
