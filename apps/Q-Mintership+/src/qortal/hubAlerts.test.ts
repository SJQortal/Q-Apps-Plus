/** Hub alerts: the rules sent to Hub, feature detection, and turning them on and off. */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Nomination } from '../data/nominations';
import { resetQueries, setQueryData } from '../data/query';
import { mockQortalRequest, qortalCalls, qortalCallsFor } from '../test/setup';
import {
  ALERT_IDS,
  ALL_ALERT_IDS,
  MAX_SUPPORT_ALERTS,
  alertRole,
  alertRules,
  getHubActions,
  getHubAlertIds,
  rulesMatch,
  supportAlertNominees,
  supportsHubAlerts,
  syncNominatorAlerts,
  turnOffHubAlerts,
  turnOnHubAlerts,
} from './hubAlerts';

const ME = 'QZm1mjw9Wr7Xy2Pq8sTnFhYk3Lc5Vb6NdA';
const N1 = 'QN1111111111111111111111111111111a';
const N2 = 'QN2222222222222222222222222222222b';
const N3 = 'QN3333333333333333333333333333333c';
const yours = (nominee: string) => `qmp-supported-yours-${nominee}`;

beforeEach(() => resetQueries());

describe('alert rules', () => {
  it('fits the account: Minter Admins, nominators, people not in MINTER, or nobody', () => {
    expect(alertRole({ isAdmin: true, isMember: true, level: 1 })).toBe('admin');
    expect(alertRole({ isAdmin: false, isMember: true, level: 5 })).toBe('nominator');
    expect(alertRole({ isAdmin: false, isMember: false, level: 7 })).toBe('nominee');
    expect(alertRole({ isAdmin: false, isMember: true, level: 4 })).toBe('none');
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

  it('has nothing for members below level 5, or without an address', () => {
    expect(alertRules('none', ME, [N1])).toEqual([]);
    expect(alertRules('nominee', '')).toEqual([]);
    expect(alertRules('nominator', ME)).toEqual([]);
  });

  it('tells a nominator about support on each open nomination they made', () => {
    expect(alertRules('nominator', ME, [N1])).toEqual([
      {
        notificationId: `qmp-supported-yours-${N1}`,
        link: `qortal://APP/Q-Mintership+/nominations/${N1}`,
        image: '/arbitrary/THUMBNAIL/Q-Mintership%2B/qortal_avatar?async=true',
        message: { en: 'Someone added their support to a nomination you made.' },
        filters: {
          service: 'JSON',
          identifier: `qmp-support-${N1}`,
          prefix: true,
          excludeBlocked: true,
        },
      },
    ]);
    // A Minter Admin gets them too, after the new-nomination rule; a nominee never does.
    expect(alertRules('admin', ME, [N1, N2]).map((r) => r.notificationId)).toEqual([
      'qmp-new-nomination',
      yours(N1),
      yours(N2),
    ]);
    expect(alertRules('nominee', ME, [N1]).map((r) => r.notificationId)).toEqual([
      'qmp-nominated-you',
      'qmp-supported-you',
    ]);
    // At most 20, each nominee once.
    const many = Array.from({ length: MAX_SUPPORT_ALERTS + 5 }, (_, i) => `Q${i}`);
    expect(alertRules('nominator', ME, [...many, 'Q0'])).toHaveLength(MAX_SUPPORT_ALERTS);
  });

  it('picks the open nominations a nominator made, newest first', () => {
    const byMe = { publisher: { address: ME } } as Nomination['nomination'];
    const byOther = { publisher: { address: 'QOther' } } as Nomination['nomination'];
    const n = (nominee: string, over: Partial<Nomination>) =>
      ({ nominee, supporters: [], nomination: byMe, publishedAt: 0, ...over }) as Nomination;
    const all = [
      n(N1, { state: 'waiting', publishedAt: 1 }),
      n(N2, { state: 'signing', publishedAt: 3 }),
      n(N3, { state: 'expired', publishedAt: 5 }),
      n('Qapproved', { state: 'approved', publishedAt: 6 }),
      n('Qtheirs', { state: 'waiting', publishedAt: 7, nomination: byOther }),
    ];
    expect(supportAlertNominees(all, ME)).toEqual([N2, N1]);
  });

  it('uses only filter keys Hub accepts', () => {
    // Qortal-Hub get.ts NOTIFICATION_FILTER_SPEC: an unknown key makes NOTIFICATION_ADD fail.
    const accepted = new Set(['service', 'identifier', 'prefix', 'excludeBlocked', 'mode']);
    for (const rule of [
      ...alertRules('admin', ME, [N1]),
      ...alertRules('nominator', ME, [N1]),
      ...alertRules('nominee', ME),
    ]) {
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
    // Support rules come and go with nominations: any of them fits a nominator or an admin.
    expect(rulesMatch([yours(N1), yours(N2)], 'nominator', ME)).toBe(true);
    expect(rulesMatch(['qmp-new-nomination', yours(N1)], 'admin', ME)).toBe(true);
    expect(rulesMatch(['qmp-new-nomination', yours(N1)], 'nominator', ME)).toBe(false);
    expect(rulesMatch(['qmp-nominated-you', 'qmp-supported-you', yours(N1)], 'nominee', ME)).toBe(
      false
    );
    expect(rulesMatch([yours(N1)], 'none', ME)).toBe(false);
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
      { notificationId: yours(N1) },
      { notificationId: 'qmp-supported-yours-' },
      { notificationId: 'something-else' },
      null,
    ]);
    expect(await getHubAlertIds()).toEqual(['qmp-new-nomination', yours(N1)]);
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

  it('removes the support rules Hub has too', async () => {
    mockQortalRequest('NOTIFICATION_REMOVE', true);
    setQueryData('hub:alerts', ['qmp-new-nomination', yours(N1)]);
    await turnOffHubAlerts();
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toEqual([
      ...ALL_ALERT_IDS,
      yours(N1),
    ]);
  });

  it("turns a nominator's alerts on with a rule per open nomination, dropping old ones", async () => {
    mockQortalRequest('NOTIFICATION_PERMISSION', true);
    mockQortalRequest('NOTIFICATION_ADD', true);
    mockQortalRequest('NOTIFICATION_REMOVE', true);
    setQueryData('hub:alerts', [yours(N3)]);
    expect(await turnOnHubAlerts('nominator', ME, [N1, N2])).toEqual([yours(N1), yours(N2)]);
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toEqual([
      ...ALL_ALERT_IDS,
      yours(N3),
    ]);
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

describe('keeping the support alerts in step', () => {
  const ACTIONS = [
    'NOTIFICATION_PERMISSION',
    'NOTIFICATION_ADD',
    'NOTIFICATION_GET',
    'NOTIFICATION_REMOVE',
    'NOTIFICATION_HAS_PERMISSION',
  ];
  function hub({ actions = ACTIONS, allowed = true } = {}) {
    mockQortalRequest('SHOW_ACTIONS', actions);
    mockQortalRequest('NOTIFICATION_HAS_PERMISSION', allowed);
    mockQortalRequest('NOTIFICATION_PERMISSION', true);
    mockQortalRequest('NOTIFICATION_ADD', true);
    mockQortalRequest('NOTIFICATION_REMOVE', true);
  }

  it('adds rules for new nominations and drops the ones that closed', async () => {
    hub();
    setQueryData('hub:alerts', ['qmp-new-nomination', yours(N1), yours(N3)]);
    expect(await syncNominatorAlerts('admin', [N1, N2])).toEqual([
      'qmp-new-nomination',
      yours(N1),
      yours(N2),
    ]);
    expect(qortalCalls.map((c) => c.action)).toEqual([
      'SHOW_ACTIONS',
      'NOTIFICATION_HAS_PERMISSION',
      'NOTIFICATION_PERMISSION',
      'NOTIFICATION_ADD',
      'NOTIFICATION_REMOVE',
    ]);
    const added = qortalCallsFor('NOTIFICATION_ADD')[0].notifications as Array<{
      notificationId: string;
    }>;
    expect(added.map((r) => r.notificationId)).toEqual([yours(N2)]);
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toEqual([yours(N3)]);
    expect(await getHubAlertIds()).toEqual(['qmp-new-nomination', yours(N1), yours(N2)]);
  });

  it('asks Hub nothing when the rules already fit', async () => {
    hub();
    setQueryData('hub:alerts', [yours(N1)]);
    expect(await syncNominatorAlerts('nominator', [N1])).toBeNull();
    expect(qortalCalls).toHaveLength(0);
  });

  it('changes nothing while alerts are off, or for a role without nominations', async () => {
    hub();
    setQueryData('hub:alerts', []);
    expect(await syncNominatorAlerts('nominator', [N1])).toBeNull();
    setQueryData('hub:alerts', ['qmp-nominated-you', 'qmp-supported-you']);
    expect(await syncNominatorAlerts('nominee', [N1])).toBeNull();
    expect(qortalCalls).toHaveLength(0);
  });

  it('never adds a rule unless Hub says the app may alert, so Hub shows no dialog', async () => {
    hub({ allowed: false });
    setQueryData('hub:alerts', [yours(N1), yours(N3)]);
    expect(await syncNominatorAlerts('nominator', [N2])).toEqual([yours(N1)]);
    expect(qortalCallsFor('NOTIFICATION_PERMISSION')).toHaveLength(0);
    expect(qortalCallsFor('NOTIFICATION_ADD')).toHaveLength(0);
    // Dropping a closed one needs no permission; the last one stays, so alerts stay on.
    expect(qortalCallsFor('NOTIFICATION_REMOVE')).toHaveLength(1);
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toEqual([yours(N3)]);
  });

  it("keeps a nominator's alerts on when their open nominations close, until a new one's rule is in", async () => {
    hub();
    setQueryData('hub:alerts', [yours(N1)]);
    // N1 closed and nothing is open: the rule stays, and Hub is asked nothing.
    expect(await syncNominatorAlerts('nominator', [])).toBeNull();
    expect(qortalCalls).toHaveLength(0);
    expect(await getHubAlertIds()).toEqual([yours(N1)]);
    // A later nomination: its rule is added, then the closed one goes.
    expect(await syncNominatorAlerts('nominator', [N2])).toEqual([yours(N2)]);
    const added = qortalCallsFor('NOTIFICATION_ADD')[0].notifications as Array<{
      notificationId: string;
    }>;
    expect(added.map((r) => r.notificationId)).toEqual([yours(N2)]);
    expect(qortalCallsFor('NOTIFICATION_REMOVE')[0].notificationIds).toEqual([yours(N1)]);
  });

  it('keeps the last rule when Hub cannot add the new ones', async () => {
    hub({ allowed: false });
    setQueryData('hub:alerts', [yours(N1)]);
    expect(await syncNominatorAlerts('nominator', [N2])).toBeNull();
    expect(qortalCallsFor('NOTIFICATION_ADD')).toHaveLength(0);
    expect(qortalCallsFor('NOTIFICATION_REMOVE')).toHaveLength(0);
    expect(await getHubAlertIds()).toEqual([yours(N1)]);
  });

  it('adds nothing in a Hub that cannot say whether the app may alert', async () => {
    hub({ actions: ACTIONS.filter((a) => a !== 'NOTIFICATION_HAS_PERMISSION') });
    setQueryData('hub:alerts', ['qmp-new-nomination']);
    expect(await syncNominatorAlerts('admin', [N1])).toBeNull();
    expect(qortalCallsFor('NOTIFICATION_HAS_PERMISSION')).toHaveLength(0);
    expect(qortalCallsFor('NOTIFICATION_PERMISSION')).toHaveLength(0);
    expect(qortalCallsFor('NOTIFICATION_ADD')).toHaveLength(0);
    // Never an empty remove: Hub would drop every rule of the app.
    expect(qortalCallsFor('NOTIFICATION_REMOVE')).toHaveLength(0);
  });
});
