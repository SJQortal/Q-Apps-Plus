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
 * - accounts not in MINTER: a nomination or a support record about them;
 * - anyone with a registered name: a reply to one of their comments (and,
 *   for Minter Admins, to one of their comments for the Minter Admins). A
 *   reply carries a marker for whose comment it answers in its description
 *   (data/replyMarkers.ts), which the rule matches; Hub skips the account's
 *   own publishes, and only a new identifier alerts (an edit doesn't).
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
import { ADMIN_COMMENT_PREFIX, ADMIN_NOTE_SERVICE } from '../data/adminNoteRecords';
import { COMMENT_PREFIX } from '../data/commentRecords';
import { NOMINATOR_MIN_LEVEL } from '../data/constants';
import type { Nomination } from '../data/nominations';
import { NOMINATION_PREFIX, RECORD_SERVICE, SUPPORT_PREFIX } from '../data/records';
import { fetchQuery, peekQuery, setQueryData } from '../data/query';
import { nameMark, replyMarker } from '../data/replyMarkers';
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

/**
 * Anyone with a registered name: someone replied to your comment. The id ends
 * in the name's mark (data/replyMarkers.ts), so a rule set up for another
 * name reads as out of date.
 */
export const REPLIED_PREFIX = 'qmp-replied-';
/** Minter Admins: someone replied to your comment for the Minter Admins. */
export const REPLIED_ADMINS_PREFIX = 'qmp-replied-ma-';
const REPLY_ALERT_RE = /^qmp-replied-(?:ma-)?[0-9a-f]{16}$/;

/**
 * Q-Mintership 3's own alert rules (3.0.7: `qmintership-hub-<kind>-<name>`). Hub keeps rules by
 * app name, so once this version is Q-Mintership itself, they are under the same app. They
 * watch records this version doesn't publish (its boards' cards, forum and events): turning
 * alerts on or off here removes them as well, so none keeps firing unseen. They never count
 * as this app's alerts being on.
 */
export const LEGACY_ALERT_PREFIX = 'qmintership-hub-';

function isLegacyAlertId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith(LEGACY_ALERT_PREFIX) && id.length <= 200;
}

export type RoleAlertId = (typeof ALERT_IDS)[keyof typeof ALERT_IDS];
export type ReplyAlertId = `${typeof REPLIED_PREFIX}${string}`;
export type AlertId = RoleAlertId | ReplyAlertId | `${typeof SUPPORTED_YOURS_PREFIX}${string}`;
/** The rules that come with a role (the support rules come and go with nominations). */
export const ALL_ALERT_IDS: readonly RoleAlertId[] = Object.values(ALERT_IDS);

export function isSupportAlertId(id: string): id is `${typeof SUPPORTED_YOURS_PREFIX}${string}` {
  return id.startsWith(SUPPORTED_YOURS_PREFIX) && id.length > SUPPORTED_YOURS_PREFIX.length;
}

function isRoleAlertId(id: string): id is RoleAlertId {
  return ALL_ALERT_IDS.includes(id as RoleAlertId);
}

export function isReplyAlertId(id: string): id is ReplyAlertId {
  return REPLY_ALERT_RE.test(id);
}

/** One of this app's rule ids. */
export function isAlertId(id: unknown): id is AlertId {
  return (
    typeof id === 'string' && (isRoleAlertId(id) || isSupportAlertId(id) || isReplyAlertId(id))
  );
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
  /**
   * Hub's NOTIFICATION_ADD filters (service, identifier, prefix, excludeBlocked;
   * a reply rule's description too, matched from its start with `prefix`).
   */
  filters: {
    service: string;
    identifier: string;
    prefix: boolean;
    excludeBlocked: boolean;
    description?: string;
  };
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

/**
 * The reply rules for an account publishing under `name` (pure): replies to
 * its public comments, and for a Minter Admin to its comments for the Minter
 * Admins. None without a name. The alert opens the reply where it was
 * posted: Core fills in `{name}` and `{identifier}` (encoded) in the link.
 */
export function replyAlertRules(role: AlertRole, name: string | null | undefined): HubAlertRule[] {
  if (!name?.trim()) return [];
  const mark = nameMark(name);
  const link = `${appLink(PATHS.comments)}/{name}/{identifier}`;
  const reply = (
    notificationId: ReplyAlertId,
    service: string,
    identifier: string,
    en: string
  ): HubAlertRule => ({
    notificationId,
    link,
    image: IMAGE,
    message: { en },
    filters: {
      service,
      identifier,
      prefix: true,
      excludeBlocked: true,
      description: replyMarker(name),
    },
  });
  const rules = [
    reply(
      `${REPLIED_PREFIX}${mark}`,
      RECORD_SERVICE,
      COMMENT_PREFIX,
      'Someone replied to your comment.'
    ),
  ];
  if (role === 'admin')
    rules.push(
      reply(
        `${REPLIED_ADMINS_PREFIX}${mark}`,
        ADMIN_NOTE_SERVICE,
        ADMIN_COMMENT_PREFIX,
        'A Minter Admin replied to your comment for the Minter Admins.'
      )
    );
  return rules;
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
 * the open nominations the account made, for Minter Admins and nominators;
 * `name`: the name it comments under, for the reply rules.
 */
export function alertRules(
  role: AlertRole,
  address: string,
  nominees: readonly string[] = [],
  name?: string | null
): HubAlertRule[] {
  const support = makesNominations(role) ? supportAlertRules(nominees) : [];
  return [...roleRules(role, address), ...replyAlertRules(role, name), ...support];
}

/**
 * True when the rules Hub has fit the role: exactly its role rules, and
 * support rules only for a role that makes nominations. Which support and
 * reply rules are there is kept in step separately (syncHubAlerts).
 */
export function rulesMatch(present: readonly string[], role: AlertRole, address: string): boolean {
  const ours = present.filter(isAlertId);
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

/**
 * The ids of this app's alert rules Hub has for the account (NOTIFICATION_GET). Q-Mintership
 * 3's are noted apart (LEGACY_ALERT_PREFIX), to be removed with the next change.
 */
export function getHubAlertIds(): Promise<AlertId[]> {
  return fetchQuery(
    'hub:alerts',
    async () => {
      const rules = await qortal<unknown>({ action: 'NOTIFICATION_GET' });
      if (!Array.isArray(rules)) return [];
      const ids = rules.map(
        (rule) => (rule as { notificationId?: unknown } | null)?.notificationId
      );
      setQueryData<string[]>('hub:alerts:legacy', ids.filter(isLegacyAlertId));
      return ids.filter(isAlertId);
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

/** The rules Hub was last known to have (read on Settings). */
function knownAlertIds(): AlertId[] {
  return peekQuery<AlertId[]>('hub:alerts') ?? [];
}

/** Q-Mintership 3's rules Hub was last known to have. */
function legacyAlertIds(): string[] {
  return peekQuery<string[]>('hub:alerts:legacy') ?? [];
}

let changing: Promise<unknown> | null = null;

/** One change at a time: a second tap while Hub is asking waits for the first. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = (changing ?? Promise.resolve()).then(work, work);
  changing = run.catch(() => undefined);
  return run;
}

/** Drop rules by id; never an empty list (Hub reads that as "every rule of this app"). */
async function removeRules(ids: readonly string[]): Promise<void> {
  if (ids.length) await qortal({ action: 'NOTIFICATION_REMOVE', notificationIds: [...ids] });
}

/**
 * Turn the alerts on for `role`: Hub asks for permission (once; it remembers),
 * then the rules are added and any of this app's other rules removed.
 * `nominees`: the open nominations the account made (supportAlertNominees);
 * `name`: the name it comments under (the reply rules). Rejects when Hub
 * declines or stops waiting.
 */
export function turnOnHubAlerts(
  role: AlertRole,
  address: string,
  nominees: readonly string[] = [],
  name?: string | null
): Promise<AlertId[]> {
  return serial(async () => {
    const rules = alertRules(role, address, nominees, name);
    if (!rules.length) throw new Error('No alerts fit this account.');
    await qortal({ action: 'NOTIFICATION_PERMISSION' });
    await qortal({ action: 'NOTIFICATION_ADD', notifications: rules });
    const ids = rules.map((r) => r.notificationId);
    const others = [...new Set<AlertId>([...ALL_ALERT_IDS, ...knownAlertIds()])].filter(
      (id) => !ids.includes(id)
    );
    await removeRules([...others, ...legacyAlertIds()]);
    setQueryData<AlertId[]>('hub:alerts', ids);
    setQueryData<string[]>('hub:alerts:legacy', []);
    return ids;
  });
}

/** Turn every alert of this app off (no permission needed). */
export function turnOffHubAlerts(): Promise<void> {
  return serial(async () => {
    await removeRules([
      ...new Set<AlertId>([...ALL_ALERT_IDS, ...knownAlertIds()]),
      ...legacyAlertIds(),
    ]);
    setQueryData<AlertId[]>('hub:alerts', []);
    setQueryData<string[]>('hub:alerts:legacy', []);
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
 * Keep the rules that come and go in step (Settings, only while alerts are
 * on): the support rules with the open nominations a Minter Admin or
 * nominator made (`nominees`; null when they couldn't be read, which leaves
 * those rules as they are), and the reply rules with the name the account
 * comments under (`name`; left out, they are left as they are). Rules for
 * new ones are added and the others removed. Adding needs Hub's permission,
 * and it is only checked, never asked for: unless Hub says the app may
 * alert, nothing is added (Hub then shows no dialog). The app's last rule
 * is never removed here: one closed rule stays until a new one is added, so
 * alerts stay on until they are turned off. Returns the rules Hub has now,
 * or null when nothing changed.
 */
export function syncHubAlerts(
  role: AlertRole,
  nominees: readonly string[] | null,
  name?: string | null
): Promise<AlertId[] | null> {
  return serial(async () => {
    const present = knownAlertIds();
    const support = makesNominations(role) && nominees !== null;
    const replies = name !== undefined;
    if (!present.length || (!support && !replies)) return null;
    const wanted = [
      ...(replies ? replyAlertRules(role, name) : []),
      ...(support ? supportAlertRules(nominees) : []),
    ];
    const wantedIds: string[] = wanted.map((r) => r.notificationId);
    const toAdd = wanted.filter((r) => !present.includes(r.notificationId));
    const closed = present.filter(
      (id) =>
        ((support && isSupportAlertId(id)) || (replies && isReplyAlertId(id))) &&
        !wantedIds.includes(id)
    );
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

/** The support rules alone in step with the open nominations (syncHubAlerts without replies). */
export function syncNominatorAlerts(
  role: AlertRole,
  nominees: readonly string[]
): Promise<AlertId[] | null> {
  return syncHubAlerts(role, nominees);
}
