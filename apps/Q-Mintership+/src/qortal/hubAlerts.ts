/**
 * Hub alerts (opt-in, Settings → Notifications; off until you turn it on).
 *
 * Qortal Hub and GO let a Q-App register alert rules: NOTIFICATION_PERMISSION
 * (Hub asks once), then NOTIFICATION_ADD; NOTIFICATION_GET lists the app's
 * rules and NOTIFICATION_REMOVE drops them (Qortal-Hub
 * src/qortal/qortal-requests.ts and get.ts). Hub keeps the rules for the
 * account and listens on the node's notifications socket, so the app polls
 * nothing for them, open or closed.
 *
 * A rule can only match a QDN publish: Hub registers every rule as
 * RESOURCE_PUBLISHED, and Core's notifications socket knows only QDN
 * publishes and payments. So the alerts cover the events that are QDN
 * records:
 *
 * - Minter Admins: a new nomination record (it waits for a first signature);
 * - accounts not in MINTER: a nomination or a support record about them.
 *
 * Signatures, approvals, expiry and joining are chain transactions: they
 * show on Home ("Since your last visit"), not as Hub alerts.
 *
 * Hub doesn't check who published a record, so an alert says a record was
 * published and the app checks it when opened. Hub keeps at most one alert
 * per identifier (for three days), and Core sends a resource at most once
 * per five minutes per connection: the alerts can't pile up.
 */
import { APP_NAME } from '../constants/plus';
import { NOMINATION_PREFIX, RECORD_SERVICE, SUPPORT_PREFIX } from '../data/records';
import { fetchQuery, setQueryData } from '../data/query';
import type { MyStatus } from '../rules/status';
import { appLink } from '../utils/links';
import { qortal } from './client';

export const ALERT_IDS = {
  /** Minter Admins: someone published a nomination. */
  newNomination: 'qmp-new-nomination',
  /** Not in MINTER: someone published a nomination of you. */
  nominatedYou: 'qmp-nominated-you',
  /** Not in MINTER: someone added their support to your nomination. */
  supportedYou: 'qmp-supported-you',
} as const;

export type AlertId = (typeof ALERT_IDS)[keyof typeof ALERT_IDS];
export const ALL_ALERT_IDS: readonly AlertId[] = Object.values(ALERT_IDS);

/** The Hub requests the alerts need (all listed by SHOW_ACTIONS in Hubs that have them). */
export const HUB_ALERT_ACTIONS = [
  'NOTIFICATION_PERMISSION',
  'NOTIFICATION_ADD',
  'NOTIFICATION_GET',
  'NOTIFICATION_REMOVE',
] as const;

/** Which alerts fit the account: Minter Admins, nominees (anyone not in MINTER), or none. */
export type AlertRole = 'admin' | 'nominee' | 'none';

export function alertRole(status: Pick<MyStatus, 'isAdmin' | 'isMember'> | undefined): AlertRole {
  if (!status) return 'none';
  if (status.isAdmin) return 'admin';
  return status.isMember ? 'none' : 'nominee';
}

export interface HubAlertRule {
  notificationId: AlertId;
  /** Where the alert opens: this app. */
  link: string;
  image: string;
  message: { en: string };
  /** Hub's NOTIFICATION_ADD filters (service, identifier, prefix, excludeBlocked). */
  filters: { service: string; identifier: string; prefix: boolean; excludeBlocked: boolean };
}

/** The app's avatar on QDN, for the alert's icon (Hub prefixes the node). */
const IMAGE = `/arbitrary/THUMBNAIL/${encodeURIComponent(APP_NAME)}/qortal_avatar?async=true`;

/** The rules for `role` (pure: what NOTIFICATION_ADD is sent). */
export function alertRules(role: AlertRole, address: string): HubAlertRule[] {
  const rule = (
    notificationId: AlertId,
    identifier: string,
    path: string,
    en: string
  ): HubAlertRule => ({
    notificationId,
    link: appLink(path),
    image: IMAGE,
    message: { en },
    filters: { service: RECORD_SERVICE, identifier, prefix: true, excludeBlocked: true },
  });
  if (role === 'admin') {
    return [
      rule(
        ALERT_IDS.newNomination,
        NOMINATION_PREFIX,
        '/nominations',
        'A new nomination was published. Open it to check it and sign first.'
      ),
    ];
  }
  if (role === 'nominee' && address) {
    return [
      rule(
        ALERT_IDS.nominatedYou,
        `${NOMINATION_PREFIX}${address}`,
        '/',
        'Someone nominated you for MINTER. Open it to see the nomination and accept.'
      ),
      rule(
        ALERT_IDS.supportedYou,
        `${SUPPORT_PREFIX}${address}`,
        '/',
        'Someone added their support to your MINTER nomination.'
      ),
    ];
  }
  return [];
}

/** True when the rules Hub has are exactly the ones for `role`. */
export function rulesMatch(present: readonly string[], role: AlertRole, address: string): boolean {
  const wanted = alertRules(role, address).map((r) => r.notificationId);
  const ours = present.filter((id): id is AlertId => ALL_ALERT_IDS.includes(id as AlertId));
  return ours.length === wanted.length && wanted.every((id) => ours.includes(id));
}

/** True when SHOW_ACTIONS lists every request the alerts need. */
export function supportsHubAlerts(actions: unknown): boolean {
  return Array.isArray(actions) && HUB_ALERT_ACTIONS.every((action) => actions.includes(action));
}

/** Hub's requests (SHOW_ACTIONS), asked once a session; none when Hub doesn't answer. */
export function getHubActions(): Promise<string[]> {
  return fetchQuery(
    'hub:actions',
    async () => {
      try {
        const actions = await qortal<unknown>({ action: 'SHOW_ACTIONS' });
        return Array.isArray(actions)
          ? actions.filter((a): a is string => typeof a === 'string')
          : [];
      } catch {
        return [];
      }
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

/** The ids of this app's alert rules Hub has for the account (NOTIFICATION_GET). */
export function getHubAlertIds(): Promise<AlertId[]> {
  return fetchQuery(
    'hub:alerts',
    async () => {
      const rules = await qortal<unknown>({ action: 'NOTIFICATION_GET' });
      if (!Array.isArray(rules)) return [];
      return rules
        .map((rule) => (rule as { notificationId?: unknown } | null)?.notificationId)
        .filter((id): id is AlertId => ALL_ALERT_IDS.includes(id as AlertId));
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

let changing: Promise<unknown> | null = null;

/** One change at a time: a second tap while Hub is asking waits for the first. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = (changing ?? Promise.resolve()).then(work, work);
  changing = run.catch(() => undefined);
  return run;
}

/**
 * Turn the alerts on for `role`: Hub asks for permission (once; it remembers),
 * then the rules are added and any of this app's other rules removed.
 * Rejects when Hub declines or stops waiting.
 */
export function turnOnHubAlerts(role: AlertRole, address: string): Promise<AlertId[]> {
  return serial(async () => {
    const rules = alertRules(role, address);
    if (!rules.length) throw new Error('No alerts fit this account.');
    await qortal({ action: 'NOTIFICATION_PERMISSION' });
    await qortal({ action: 'NOTIFICATION_ADD', notifications: rules });
    const ids = rules.map((r) => r.notificationId);
    const others = ALL_ALERT_IDS.filter((id) => !ids.includes(id));
    await qortal({ action: 'NOTIFICATION_REMOVE', notificationIds: others });
    setQueryData<AlertId[]>('hub:alerts', ids);
    return ids;
  });
}

/** Turn every alert of this app off (no permission needed). */
export function turnOffHubAlerts(): Promise<void> {
  return serial(async () => {
    await qortal({ action: 'NOTIFICATION_REMOVE', notificationIds: [...ALL_ALERT_IDS] });
    setQueryData<AlertId[]>('hub:alerts', []);
  });
}
