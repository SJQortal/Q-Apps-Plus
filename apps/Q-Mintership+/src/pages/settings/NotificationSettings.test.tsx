/** Settings → Notifications: the in-app panel switch and the opt-in Hub alerts. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { peekQuery } from '../../data/query';
import { SINCE_LAST_VISIT_KEY, sinceLastVisitAtom } from '../../state/notifications';
import { renderPage } from '../../test/render';
import { mockQortalRequest, qortalCalls, qortalCallsFor } from '../../test/setup';
import { ADDR, NOW } from '../../test/world';
import { NotificationSettings } from './NotificationSettings';

const T = { timeout: 4000 };
const ACTIONS = [
  'GET_USER_ACCOUNT',
  'NOTIFICATION_PERMISSION',
  'NOTIFICATION_ADD',
  'NOTIFICATION_GET',
  'NOTIFICATION_REMOVE',
];

afterEach(() => {
  vi.useRealTimers();
  getDefaultStore().set(sinceLastVisitAtom, true);
});

/** A Hub that offers alerts, with `rules` already registered for this app. */
function hubWithAlerts(rules: string[] = []) {
  mockQortalRequest('SHOW_ACTIONS', ACTIONS);
  mockQortalRequest('NOTIFICATION_GET', () => rules.map((notificationId) => ({ notificationId })));
  mockQortalRequest('NOTIFICATION_PERMISSION', true);
  mockQortalRequest('NOTIFICATION_ADD', true);
  mockQortalRequest('NOTIFICATION_REMOVE', true);
}

const hubSwitch = () => screen.getByRole('switch', { name: 'Hub alerts' });
const section = () => screen.getByRole('region', { name: 'Notifications' });

describe('Settings → Notifications', () => {
  it('turns the "Since your last visit" panel off and on, in this browser', async () => {
    const u = userEvent.setup();
    await renderPage(<NotificationSettings />, { persona: 'admin', path: '/settings' });
    const panel = screen.getByRole('switch', { name: 'Since your last visit' });
    expect(panel).toBeChecked();
    await u.click(panel);
    expect(panel).not.toBeChecked();
    expect(window.localStorage.getItem(SINCE_LAST_VISIT_KEY)).toBe('false');
    await u.click(panel);
    expect(panel).toBeChecked();
  });

  it("is off by default and says when Hub doesn't offer alerts", async () => {
    mockQortalRequest('SHOW_ACTIONS', ['GET_USER_ACCOUNT', 'SIGN_TRANSACTION']);
    await renderPage(<NotificationSettings />, { persona: 'admin', path: '/settings' });
    expect(
      await within(section()).findByText(/Your Hub doesn't offer app alerts/, {}, T)
    ).toBeVisible();
    expect(hubSwitch()).not.toBeChecked();
    expect(hubSwitch()).toBeDisabled();
    expect(qortalCallsFor('NOTIFICATION_GET')).toHaveLength(0);
  });

  it('lets a Minter Admin turn alerts on: permission, then the rule', async () => {
    const u = userEvent.setup();
    hubWithAlerts();
    await renderPage(<NotificationSettings />, { persona: 'admin', path: '/settings' });
    expect(
      await within(section()).findByText(/Hub tells you when a new nomination is published/, {}, T)
    ).toBeVisible();
    expect(within(section()).getByText(/Hub asks you once to allow it\. No fee\./)).toBeVisible();
    await waitFor(() => expect(hubSwitch()).toBeEnabled());
    expect(hubSwitch()).not.toBeChecked();
    await u.click(hubSwitch());
    expect(await screen.findByText('Hub alerts are on.', {}, T)).toBeVisible();
    expect(hubSwitch()).toBeChecked();
    expect(qortalCallsFor('NOTIFICATION_PERMISSION')).toHaveLength(1);
    const added = qortalCallsFor('NOTIFICATION_ADD')[0].notifications as Array<{
      notificationId: string;
    }>;
    expect(added.map((r) => r.notificationId)).toEqual(['qmp-new-nomination']);
  });

  it('keeps focus on the switch while Hub asks, and ignores another press meanwhile', async () => {
    const u = userEvent.setup();
    hubWithAlerts();
    let allow: (value: boolean) => void = () => undefined;
    mockQortalRequest(
      'NOTIFICATION_PERMISSION',
      () => new Promise<boolean>((resolve) => (allow = resolve))
    );
    await renderPage(<NotificationSettings />, { persona: 'admin', path: '/settings' });
    await waitFor(() => expect(hubSwitch()).toBeEnabled(), T);
    await u.click(hubSwitch());
    expect(await within(section()).findByText('Waiting for Hub…', {}, T)).toBeVisible();
    expect(hubSwitch()).toBeEnabled();
    expect(hubSwitch()).toHaveFocus();
    expect(hubSwitch()).toHaveAttribute('aria-busy', 'true');
    await u.click(hubSwitch());
    expect(qortalCallsFor('NOTIFICATION_PERMISSION')).toHaveLength(1);
    allow(true);
    expect(await screen.findByText('Hub alerts are on.', {}, T)).toBeVisible();
    expect(hubSwitch()).toBeChecked();
    expect(hubSwitch()).toHaveFocus();
    expect(qortalCallsFor('NOTIFICATION_ADD')).toHaveLength(1);
  });

  it('turns them off again without asking for permission', async () => {
    const u = userEvent.setup();
    hubWithAlerts(['qmp-new-nomination']);
    await renderPage(<NotificationSettings />, { persona: 'admin', path: '/settings' });
    await waitFor(() => expect(hubSwitch()).toBeChecked(), T);
    await u.click(hubSwitch());
    expect(await screen.findByText('Hub alerts are off.', {}, T)).toBeVisible();
    expect(hubSwitch()).not.toBeChecked();
    expect(qortalCallsFor('NOTIFICATION_PERMISSION')).toHaveLength(0);
    expect(qortalCallsFor('NOTIFICATION_REMOVE')).toHaveLength(1);
  });

  it("tells a nominee without a name that Hub won't listen, and changes nothing on a decline", async () => {
    const u = userEvent.setup();
    hubWithAlerts();
    mockQortalRequest('NOTIFICATION_PERMISSION', () => {
      throw { error: 'User declined request', message: 'User declined request' };
    });
    await renderPage(<NotificationSettings />, { persona: 'newcomer', path: '/settings' });
    expect(
      await within(section()).findByText(/Hub tells you when someone nominates you/, {}, T)
    ).toBeVisible();
    expect(
      within(section()).getByText(
        'Hub listens for app alerts only on accounts with a registered name.'
      )
    ).toBeVisible();
    await waitFor(() => expect(hubSwitch()).toBeEnabled());
    await u.click(hubSwitch());
    expect(
      await screen.findByText("You didn't allow alerts in Hub. Nothing changed.", {}, T)
    ).toBeVisible();
    expect(hubSwitch()).not.toBeChecked();
    expect(qortalCallsFor('NOTIFICATION_ADD')).toHaveLength(0);
  });

  it('says what to do when Hub stops waiting', async () => {
    const u = userEvent.setup();
    hubWithAlerts();
    mockQortalRequest('NOTIFICATION_PERMISSION', () => {
      throw { error: 'timeout', message: 'Request timed out after 30000 ms' };
    });
    await renderPage(<NotificationSettings />, { persona: 'nominatedWaiting', path: '/settings' });
    await waitFor(() => expect(hubSwitch()).toBeEnabled(), T);
    await u.click(hubSwitch());
    expect(
      await screen.findByText(
        'Hub stopped waiting. If you allowed alerts there, turn this on again to finish.',
        {},
        T
      )
    ).toBeVisible();
  });

  it('has nothing to offer a member who is not an admin', async () => {
    hubWithAlerts();
    await renderPage(<NotificationSettings />, { persona: 'learner', path: '/settings' });
    expect(
      await within(section()).findByText(/Nothing to alert you about now/, {}, T)
    ).toBeVisible();
    expect(hubSwitch()).toBeDisabled();
  });

  it('notices alerts set up for an earlier role', async () => {
    hubWithAlerts(['qmp-nominated-you', 'qmp-supported-you']);
    await renderPage(<NotificationSettings />, { persona: 'admin', path: '/settings' });
    expect(await within(section()).findByText(/set up for your earlier role/, {}, T)).toBeVisible();
    expect(hubSwitch()).toBeChecked();
    expect(hubSwitch()).toBeEnabled();
  });

  it('says to turn off alerts that no longer fit a role with nothing to alert about', async () => {
    const u = userEvent.setup();
    hubWithAlerts(['qmp-nominated-you', 'qmp-supported-you']);
    await renderPage(<NotificationSettings />, { persona: 'learner', path: '/settings' });
    expect(
      await within(section()).findByText(/no longer fit\. Turn them off\./, {}, T)
    ).toBeVisible();
    expect(within(section()).queryByText(/Turn them off and on/)).toBeNull();
    expect(hubSwitch()).toBeChecked();
    expect(hubSwitch()).toBeEnabled();
    await u.click(hubSwitch());
    expect(
      await within(section()).findByText(/Nothing to alert you about now/, {}, T)
    ).toBeVisible();
    await waitFor(() => expect(hubSwitch()).toBeDisabled());
    expect(hubSwitch()).not.toBeChecked();
  });

  it('points to Hub or GO outside Hub', async () => {
    await renderPage(<NotificationSettings />, { persona: 'outside', path: '/settings' });
    expect(within(section()).getByText(/Open this app in Qortal Hub or GO/)).toBeVisible();
    expect(hubSwitch()).toBeDisabled();
    expect(qortalCallsFor('SHOW_ACTIONS')).toHaveLength(0);
  });
});

describe('Settings → Notifications: support alerts for nominators', () => {
  const yours = (nominee: string) => `qmp-supported-yours-${nominee}`;
  /** Nora Nominator's open nominations, newest first. */
  const OPEN = [ADDR.nominatedWaiting, ADDR.nominatedSigning, ADDR.urgent];
  const ids = (call: Record<string, unknown>) =>
    (call.notifications as Array<{ notificationId: string }>).map((r) => r.notificationId);

  /** A Hub that offers alerts and can say, without a dialog, whether the app may alert. */
  function hubThatChecks(rules: string[], allowed: boolean) {
    hubWithAlerts(rules);
    mockQortalRequest('SHOW_ACTIONS', [...ACTIONS, 'NOTIFICATION_HAS_PERMISSION']);
    mockQortalRequest('NOTIFICATION_HAS_PERMISSION', allowed);
  }

  it('lets a level 5+ nominator turn on alerts for support on the nominations they made', async () => {
    const u = userEvent.setup();
    hubWithAlerts();
    await renderPage(<NotificationSettings />, { persona: 'nominator', path: '/settings' });
    expect(
      await within(section()).findByText(
        /^Hub tells you when someone adds their support to a nomination you made, even when/,
        {},
        T
      )
    ).toBeVisible();
    expect(
      within(section()).getByText(
        /^Support alerts cover the nominations you made that are still open \(up to 20\)\./
      )
    ).toBeVisible();
    await waitFor(() => expect(hubSwitch()).toBeEnabled(), T);
    await u.click(hubSwitch());
    expect(await screen.findByText('Hub alerts are on.', {}, T)).toBeVisible();
    const add = qortalCallsFor('NOTIFICATION_ADD')[0];
    expect(ids(add)).toEqual(OPEN.map(yours));
    const filters = (add.notifications as Array<{ filters: { identifier: string } }>).map(
      (r) => r.filters.identifier
    );
    expect(filters).toEqual(OPEN.map((a) => `qmp-support-${a}`));
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toEqual([
      'qmp-new-nomination',
      'qmp-nominated-you',
      'qmp-supported-you',
    ]);
  });

  it('adds a Minter Admin’s support alerts with the new-nomination one', async () => {
    const u = userEvent.setup();
    hubWithAlerts();
    await renderPage(<NotificationSettings />, {
      persona: 'admin',
      path: '/settings',
      setup: (world) => {
        world.records.push({
          name: 'Avery Admin',
          identifier: `qmp-nomination-${ADDR.newcomerName}`,
          created: NOW - 3_600_000,
          body: {
            v: 1,
            nomineeAddress: ADDR.newcomerName,
            reason: 'Runs a reliable node and helps in the minting chat every week.',
            links: [],
          },
        });
      },
    });
    await waitFor(() => expect(peekQuery('nominations:all')).toBeDefined(), T);
    await waitFor(() => expect(hubSwitch()).toBeEnabled(), T);
    await u.click(hubSwitch());
    expect(await screen.findByText('Hub alerts are on.', {}, T)).toBeVisible();
    expect(ids(qortalCallsFor('NOTIFICATION_ADD')[0])).toEqual([
      'qmp-new-nomination',
      yours(ADDR.newcomerName),
    ]);
  });

  it('has nothing to turn on for a nominator with no open nominations', async () => {
    hubWithAlerts();
    await renderPage(<NotificationSettings />, { persona: 'promote', path: '/settings' });
    expect(
      await within(section()).findByText(/You have no open nominations now\.$/, {}, T)
    ).toBeVisible();
    expect(hubSwitch()).toBeDisabled();
    expect(within(section()).queryByText(/^Support alerts cover/)).toBeNull();
  });

  it('stays on when none of the nominations they made is open any more', async () => {
    const u = userEvent.setup();
    // Set up while Lapsed Person's nomination was open; Pia has none open now.
    hubThatChecks([yours(ADDR.lapsed)], true);
    await renderPage(<NotificationSettings />, { persona: 'promote', path: '/settings' });
    await waitFor(() => expect(peekQuery('nominations:all')).toBeDefined(), T);
    expect(
      await within(section()).findByText(/You have no open nominations now\.$/, {}, T)
    ).toBeVisible();
    // Give the sync its turn: it drops nothing.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(qortalCallsFor('NOTIFICATION_REMOVE')).toHaveLength(0);
    expect(hubSwitch()).toBeChecked();
    expect(hubSwitch()).toBeEnabled();
    expect(
      within(section()).getByText(
        /While alerts are on, opening Settings adds the ones you made since/
      )
    ).toBeVisible();
    // Turning them off still removes every rule.
    await u.click(hubSwitch());
    expect(await screen.findByText('Hub alerts are off.', {}, T)).toBeVisible();
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toContain(yours(ADDR.lapsed));
    expect(hubSwitch()).not.toBeChecked();
  });

  it('keeps them in step while alerts are on: checks first, so Hub shows no dialog', async () => {
    // Set up earlier: Lapsed Person's nomination has closed since, two are new.
    hubThatChecks([yours(ADDR.lapsed), yours(ADDR.urgent)], true);
    await renderPage(<NotificationSettings />, { persona: 'nominator', path: '/settings' });
    await waitFor(() => expect(qortalCallsFor('NOTIFICATION_REMOVE')).toHaveLength(1), T);
    const order = qortalCalls.map((c) => c.action);
    expect(order.indexOf('NOTIFICATION_HAS_PERMISSION')).toBeLessThan(
      order.indexOf('NOTIFICATION_PERMISSION')
    );
    expect(ids(qortalCallsFor('NOTIFICATION_ADD')[0])).toEqual([
      yours(ADDR.nominatedWaiting),
      yours(ADDR.nominatedSigning),
    ]);
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toEqual([yours(ADDR.lapsed)]);
    expect(hubSwitch()).toBeChecked();
    expect(within(section()).queryByText(/aren't set up yet/)).toBeNull();
    expect(within(section()).queryByText(/earlier role/)).toBeNull();
  });

  it("adds nothing when Hub doesn't let the app alert, and says how to add them", async () => {
    hubThatChecks([yours(ADDR.urgent)], false);
    await renderPage(<NotificationSettings />, { persona: 'nominator', path: '/settings' });
    expect(
      await within(section()).findByText(
        "Alerts for 2 open nominations you made aren't set up yet: turn alerts off and on to add them.",
        {},
        T
      )
    ).toBeVisible();
    expect(qortalCallsFor('NOTIFICATION_PERMISSION')).toHaveLength(0);
    expect(qortalCallsFor('NOTIFICATION_ADD')).toHaveLength(0);
    expect(qortalCallsFor('NOTIFICATION_REMOVE')).toHaveLength(0);
    expect(hubSwitch()).toBeChecked();
  });
});
