/** Settings → Notifications: the in-app panel switch and the opt-in Hub alerts. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { SINCE_LAST_VISIT_KEY, sinceLastVisitAtom } from '../../state/notifications';
import { renderPage } from '../../test/render';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
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
