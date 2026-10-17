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
 * - nominators (level 5+ members and Minter Admins): a support record on a
 *   nomination they made, one rule per open nomination (at most 20), kept
 *   in step on Settings while alerts are on (syncNominatorAlerts);
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
import { NOMINATOR_MIN_LEVEL } from '../data/constants';
import type { Nomination } from '../data/nominations';
import { NOMINATION_PREFIX, RECORD_SERVICE, SUPPORT_PREFIX } from '../data/records';
import { fetchQuery, peekQuery, setQueryData } from '../data/query';
import { nominationPath, PATHS } from '../routes/paths';
import { nominationsMade } from '../rules/sinceLastVisit';
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

/** Nominators: someone added their support to a nomination you made (one rule per nominee). */
export const SUPPORTED_YOURS_PREFIX = 'qmp-supported-yours-';
/** Support rules kept at most: a nominator's open nominations, newest first. */
export const MAX_SUPPORT_ALERTS = 20;

export type RoleAlertId = (typeof ALERT_IDS)[keyof typeof ALERT_IDS];
export type AlertId = RoleAlertId | `${typeof SUPPORTED_YOURS_PREFIX}${string}`;
/** The rules that come with a role (the support rules come and go with nominations). */
export const ALL_ALERT_IDS: readonly RoleAlertId[] = Object.values(ALERT_IDS);

export function isSupportAlertId(id: string): id is `${typeof SUPPORTED_YOURS_PREFIX}${string}` {
  return id.startsWith(SUPPORTED_YOURS_PREFIX) && id.length > SUPPORTED_YOURS_PREFIX.length;
}

function isRoleAlertId(id: string): id is RoleAlertId {
  return ALL_ALERT_IDS.includes(id as RoleAlertId);
}

/** One of this app's rule ids. */
export function isAlertId(id: unknown): id is AlertId {
  return typeof id === 'string' && (isRoleAlertId(id) || isSupportAlertId(id));
}

/** The Hub requests the alerts need (all listed by SHOW_ACTIONS in Hubs that have them). */
export const HUB_ALERT_ACTIONS = [
  'NOTIFICATION_PERMISSION',
  'NOTIFICATION_ADD',
  'NOTIFICATION_GET',
  'NOTIFICATION_REMOVE',
] as const;

/**
 * Which alerts fit the account: Minter Admins, nominators (members at level
 * 5+), nominees (anyone not in MINTER), or none (members below level 5).
 */
export type AlertRole = 'admin' | 'nominator' | 'nominee' | 'none';

export function alertRole(
  status: Pick<MyStatus, 'isAdmin' | 'isMember' | 'level'> | undefined
): AlertRole {
  if (!status) return 'none';
  if (status.isAdmin) return 'admin';
  if (!status.isMember) return 'nominee';
  return status.level >= NOMINATOR_MIN_LEVEL ? 'nominator' : 'none';
}

/** Minter Admins and level 5+ members can have made nominations. */
export function makesNominations(role: AlertRole): boolean {
  return role === 'admin' || role === 'nominator';
}

/**
 * The nominees of the open nominations `address` made (waiting for a first
 * signature, or collecting signatures), newest first, at most
 * MAX_SUPPORT_ALERTS: one support rule each.
 */
export function supportAlertNominees(all: readonly Nomination[], address: string): string[] {
  return nominationsMade(all, address)
    .filter((n) => n.state === 'waiting' || n.state === 'signing')
    .slice(0, MAX_SUPPORT_ALERTS)
    .map((n) => n.nominee);
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

function rule(notificationId: AlertId, identifier: string, path: string, en: string): HubAlertRule {
  return {
    notificationId,
    link: appLink(path),
    image: IMAGE,
    message: { en },
    filters: { service: RECORD_SERVICE, identifier, prefix: true, excludeBlocked: true },
  };
}

/** One support rule per nominee (pure; at most MAX_SUPPORT_ALERTS). */
export function supportAlertRules(nominees: readonly string[]): HubAlertRule[] {
  return [...new Set(nominees)]
    .filter(Boolean)
    .slice(0, MAX_SUPPORT_ALERTS)
    .map((nominee) =>
      rule(
        `${SUPPORTED_YOURS_PREFIX}${nominee}`,
        `${SUPPORT_PREFIX}${nominee}`,
        nominationPath(nominee),
        'Someone added their support to a nomination you made.'
      )
    );
}

/** The rules that come with `role` (pure), without the support rules. */
function roleRules(role: AlertRole, address: string): HubAlertRule[] {
  if (role === 'admin') {
    return [
      rule(
        ALERT_IDS.newNomination,
        NOMINATION_PREFIX,
        PATHS.decisions,
        'A new nomination was published. Open it to check it and approve first.'
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

/**
 * The rules for `role` (pure: what NOTIFICATION_ADD is sent). `nominees`:
 * the open nominations the account made, for Minter Admins and nominators.
 */
export function alertRules(
  role: AlertRole,
  address: string,
  nominees: readonly string[] = []
): HubAlertRule[] {
  const support = makesNominations(role) ? supportAlertRules(nominees) : [];
  return [...roleRules(role, address), ...support];
}

/**
 * True when the rules Hub has fit the role: exactly its role rules, and
 * support rules only for a role that makes nominations. Which support rules
 * are there is kept in step separately (syncNominatorAlerts).
 */
export function rulesMatch(present: readonly string[], role: AlertRole, address: string): boolean {
  const ours = present.filter(isAlertId);
  if (role === 'none') return ours.length === 0;
  if (!makesNominations(role) && ours.some(isSupportAlertId)) return false;
  const wanted = roleRules(role, address).map((r) => r.notificationId);
  const fixed = ours.filter(isRoleAlertId);
  return fixed.length === wanted.length && wanted.every((id) => fixed.includes(id as RoleAlertId));
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
        .filter(isAlertId);
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

/** The rules Hub was last known to have (read on Settings). */
function knownAlertIds(): AlertId[] {
  return peekQuery<AlertId[]>('hub:alerts') ?? [];
}

let changing: Promise<unknown> | null = null;

/** One change at a time: a second tap while Hub is asking waits for the first. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = (changing ?? Promise.resolve()).then(work, work);
  changing = run.catch(() => undefined);
  return run;
}

/** Drop rules by id; never an empty list (Hub reads that as "every rule of this app"). */
async function removeRules(ids: readonly AlertId[]): Promise<void> {
  if (ids.length) await qortal({ action: 'NOTIFICATION_REMOVE', notificationIds: [...ids] });
}

/**
 * Turn the alerts on for `role`: Hub asks for permission (once; it remembers),
 * then the rules are added and any of this app's other rules removed.
 * `nominees`: the open nominations the account made (supportAlertNominees).
 * Rejects when Hub declines or stops waiting.
 */
export function turnOnHubAlerts(
  role: AlertRole,
  address: string,
  nominees: readonly string[] = []
): Promise<AlertId[]> {
  return serial(async () => {
    const rules = alertRules(role, address, nominees);
    if (!rules.length) throw new Error('No alerts fit this account.');
    await qortal({ action: 'NOTIFICATION_PERMISSION' });
    await qortal({ action: 'NOTIFICATION_ADD', notifications: rules });
    const ids = rules.map((r) => r.notificationId);
    const others = [...new Set<AlertId>([...ALL_ALERT_IDS, ...knownAlertIds()])].filter(
      (id) => !ids.includes(id)
    );
    await removeRules(others);
    setQueryData<AlertId[]>('hub:alerts', ids);
    return ids;
  });
}

/** Turn every alert of this app off (no permission needed). */
export function turnOffHubAlerts(): Promise<void> {
  return serial(async () => {
    await removeRules([...new Set<AlertId>([...ALL_ALERT_IDS, ...knownAlertIds()])]);
    setQueryData<AlertId[]>('hub:alerts', []);
  });
}

/**
 * Whether Hub already lets this app alert, asked without a dialog
 * (NOTIFICATION_HAS_PERMISSION). A Hub without that request counts as no.
 */
async function mayAlert(): Promise<boolean> {
  const actions = await getHubActions();
  if (!actions.includes('NOTIFICATION_HAS_PERMISSION')) return false;
  try {
    return (await qortal<unknown>({ action: 'NOTIFICATION_HAS_PERMISSION' })) === true;
  } catch {
    return false;
  }
}

/**
 * Keep the support rules in step with the open nominations the account made
 * (Settings, only while alerts are on): rules for new ones are added and
 * rules for ones that closed are removed. Adding needs Hub's permission, and
 * it is only checked, never asked for: unless Hub says the app may alert,
 * nothing is added (Hub then shows no dialog). The app's last rule is never
 * removed here: one closed rule stays until a new one is added, so alerts
 * stay on until they are turned off (a nominator has no other rule).
 * Returns the rules Hub has now, or null when nothing changed.
 */
export function syncNominatorAlerts(
  role: AlertRole,
  nominees: readonly string[]
): Promise<AlertId[] | null> {
  return serial(async () => {
    const present = knownAlertIds();
    if (!makesNominations(role) || !present.length) return null;
    const wanted = supportAlertRules(nominees);
    const wantedIds = wanted.map((r) => r.notificationId);
    const toAdd = wanted.filter((r) => !present.includes(r.notificationId));
    const closed = present.filter((id) => isSupportAlertId(id) && !wantedIds.includes(id));
    let added: AlertId[] = [];
    if (toAdd.length && (await mayAlert())) {
      // Hub has the permission: this only opens the session for NOTIFICATION_ADD.
      await qortal({ action: 'NOTIFICATION_PERMISSION' });
      await qortal({ action: 'NOTIFICATION_ADD', notifications: toAdd });
      added = toAdd.map((r) => r.notificationId);
    }
    const toRemove = !added.length && closed.length === present.length ? closed.slice(1) : closed;
    await removeRules(toRemove);
    if (!added.length && !toRemove.length) return null;
    const next = [...present.filter((id) => !toRemove.includes(id)), ...added];
    setQueryData<AlertId[]>('hub:alerts', next);
    return next;
  });
}
