/** Hub alerts: the rules sent to Hub, feature detection, and turning them on and off. */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetQueries } from '../data/query';
import { mockQortalRequest, qortalCalls, qortalCallsFor } from '../test/setup';
import {
  ALERT_IDS,
  ALL_ALERT_IDS,
  alertRole,
  alertRules,
  getHubActions,
  getHubAlertIds,
  rulesMatch,
  supportsHubAlerts,
  turnOffHubAlerts,
  turnOnHubAlerts,
} from './hubAlerts';

const ME = 'QZm1mjw9Wr7Xy2Pq8sTnFhYk3Lc5Vb6NdA';

beforeEach(() => resetQueries());

describe('alert rules', () => {
  it('fits the account: Minter Admins, people not in MINTER, or nobody', () => {
    expect(alertRole({ isAdmin: true, isMember: true })).toBe('admin');
    expect(alertRole({ isAdmin: false, isMember: false })).toBe('nominee');
    expect(alertRole({ isAdmin: false, isMember: true })).toBe('none');
    expect(alertRole(undefined)).toBe('none');
  });

  it('tells Minter Admins about every new nomination record', () => {
    expect(alertRules('admin', ME)).toEqual([
      {
        notificationId: 'qmp-new-nomination',
        link: 'qortal://APP/Q-Mintership+/nominations',
        image: '/arbitrary/THUMBNAIL/Q-Mintership%2B/qortal_avatar?async=true',
        message: { en: 'A new nomination was published. Open it to check it and sign first.' },
        filters: {
          service: 'JSON',
          identifier: 'qmp-nomination-',
          prefix: true,
          excludeBlocked: true,
        },
      },
    ]);
  });

  it('tells a nominee about records about them only', () => {
    const rules = alertRules('nominee', ME);
    expect(rules.map((r) => [r.notificationId, r.filters.identifier, r.link])).toEqual([
      ['qmp-nominated-you', `qmp-nomination-${ME}`, 'qortal://APP/Q-Mintership+'],
      ['qmp-supported-you', `qmp-support-${ME}`, 'qortal://APP/Q-Mintership+'],
    ]);
    expect(rules.every((r) => r.filters.service === 'JSON' && r.filters.excludeBlocked)).toBe(true);
    expect(rules.every((r) => r.message.en.length > 0)).toBe(true);
  });

  it('has nothing for members who are not admins, or without an address', () => {
    expect(alertRules('none', ME)).toEqual([]);
    expect(alertRules('nominee', '')).toEqual([]);
  });

  it('uses only filter keys Hub accepts', () => {
    // Qortal-Hub get.ts NOTIFICATION_FILTER_SPEC: an unknown key makes NOTIFICATION_ADD fail.
    const accepted = new Set(['service', 'identifier', 'prefix', 'excludeBlocked', 'mode']);
    for (const rule of [...alertRules('admin', ME), ...alertRules('nominee', ME)]) {
      expect(Object.keys(rule.filters).every((key) => accepted.has(key))).toBe(true);
    }
  });

  it('knows when the rules Hub has fit the role', () => {
    expect(rulesMatch(['qmp-new-nomination'], 'admin', ME)).toBe(true);
    expect(rulesMatch(['qmp-nominated-you', 'qmp-supported-you'], 'nominee', ME)).toBe(true);
    expect(rulesMatch(['qmp-supported-you', 'qmp-nominated-you', 'theirs'], 'nominee', ME)).toBe(
      true
    );
    expect(rulesMatch(['qmp-nominated-you'], 'nominee', ME)).toBe(false);
    expect(rulesMatch(['qmp-nominated-you', 'qmp-supported-you'], 'admin', ME)).toBe(false);
    expect(rulesMatch(['qmp-new-nomination'], 'none', ME)).toBe(false);
  });
});

describe('what Hub offers', () => {
  const FULL = [
    'GET_USER_ACCOUNT',
    'NOTIFICATION_PERMISSION',
    'NOTIFICATION_ADD',
    'NOTIFICATION_GET',
    'NOTIFICATION_REMOVE',
  ];

  it('needs every alert request in SHOW_ACTIONS', () => {
    expect(supportsHubAlerts(FULL)).toBe(true);
    expect(supportsHubAlerts(FULL.filter((a) => a !== 'NOTIFICATION_ADD'))).toBe(false);
    expect(supportsHubAlerts(null)).toBe(false);
    expect(supportsHubAlerts('NOTIFICATION_ADD')).toBe(false);
  });

  it('asks Hub once a session, and takes no answer as "none"', async () => {
    mockQortalRequest('SHOW_ACTIONS', FULL);
    expect(await getHubActions()).toEqual(FULL);
    expect(await getHubActions()).toEqual(FULL);
    expect(qortalCallsFor('SHOW_ACTIONS')).toHaveLength(1);
    resetQueries();
    mockQortalRequest('SHOW_ACTIONS', () => {
      throw {
        error: 'timeout',
        message: 'Request timed out after 30000 ms (action: SHOW_ACTIONS)',
      };
    });
    expect(await getHubActions()).toEqual([]);
    expect(await getHubActions()).toEqual([]);
    expect(qortalCallsFor('SHOW_ACTIONS')).toHaveLength(2);
  });

  it("lists this app's alert rules from NOTIFICATION_GET", async () => {
    mockQortalRequest('NOTIFICATION_GET', [
      { notificationId: 'qmp-new-nomination', link: 'x', message: { en: 'x' }, filters: {} },
      { notificationId: 'something-else' },
      null,
    ]);
    expect(await getHubAlertIds()).toEqual(['qmp-new-nomination']);
  });
});

describe('turning alerts on and off', () => {
  it('asks permission, adds the rules for the role, and drops the other ones', async () => {
    mockQortalRequest('NOTIFICATION_PERMISSION', true);
    mockQortalRequest('NOTIFICATION_ADD', true);
    mockQortalRequest('NOTIFICATION_REMOVE', true);
    expect(await turnOnHubAlerts('admin', ME)).toEqual([ALERT_IDS.newNomination]);
    expect(qortalCalls.map((c) => c.action)).toEqual([
      'NOTIFICATION_PERMISSION',
      'NOTIFICATION_ADD',
      'NOTIFICATION_REMOVE',
    ]);
    expect(qortalCallsFor('NOTIFICATION_ADD')[0].notifications).toEqual(alertRules('admin', ME));
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toEqual([
      ALERT_IDS.nominatedYou,
      ALERT_IDS.supportedYou,
    ]);
    // The switch reads the new state without asking Hub again.
    expect(await getHubAlertIds()).toEqual([ALERT_IDS.newNomination]);
    expect(qortalCallsFor('NOTIFICATION_GET')).toHaveLength(0);
  });

  it('adds nothing when Hub declines', async () => {
    mockQortalRequest('NOTIFICATION_PERMISSION', () => {
      throw { error: 'User declined request', message: 'User declined request' };
    });
    await expect(turnOnHubAlerts('nominee', ME)).rejects.toMatchObject({
      error: 'User declined request',
    });
    expect(qortalCallsFor('NOTIFICATION_ADD')).toHaveLength(0);
  });

  it('refuses a role without alerts', async () => {
    await expect(turnOnHubAlerts('none', ME)).rejects.toThrow('No alerts fit this account.');
    expect(qortalCalls).toHaveLength(0);
  });

  it('removes every rule of this app to turn them off', async () => {
    mockQortalRequest('NOTIFICATION_REMOVE', true);
    await turnOffHubAlerts();
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toEqual([...ALL_ALERT_IDS]);
    expect(qortalCallsFor('NOTIFICATION_PERMISSION')).toHaveLength(0);
    expect(await getHubAlertIds()).toEqual([]);
  });

  it('makes one change at a time', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    mockQortalRequest(
      'NOTIFICATION_PERMISSION',
      () =>
        new Promise((resolve) => {
          order.push('ask');
          release = () => resolve(true);
        })
    );
    mockQortalRequest('NOTIFICATION_ADD', () => order.push('add'));
    mockQortalRequest('NOTIFICATION_REMOVE', () => order.push('remove'));
    const on = turnOnHubAlerts('admin', ME);
    const off = turnOffHubAlerts();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(order).toEqual(['ask']);
    release();
    await Promise.all([on, off]);
    expect(order).toEqual(['ask', 'add', 'remove', 'remove']);
    expect(await getHubAlertIds()).toEqual([]);
  });
});
