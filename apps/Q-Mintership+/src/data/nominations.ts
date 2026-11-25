/**
 * Nominations as everyone sees them: the QDN nomination and support
 * records, re-validated, joined with what the chain says about each nominee.
 *
 * Reads: two paged QDN searches (records, supports), one small JSON body per
 * record version (cached for the session), the MINTER member list (7 pages,
 * cached 10 minutes, for names and membership), admins, the publishers'
 * levels, join requests, stored invites, bans, the Decisions data (pending
 * invites) and the MINTER invites of the last two windows.
 *
 * Pending invites with no record (an admin invited someone directly, or the
 * original app did) are nominations too, with `source: 'chain'`.
 */
import { decisionSubject, type Decision } from '../rules/decision';
import {
  decidedAt,
  earlierRounds,
  isEligibleNominator,
  isOpenState,
  nominationState,
  pickRound,
  RECORD_CLOCK_SLACK_MS,
  waitingEndsAt,
  type DecidedInvite,
  type EarlierRound,
  type InviteSpan,
  type NominationState,
  nominationAnswered,
} from '../rules/nomination';
import { waitingWindowBlocks } from '../rules/timing';
import { getAccount, getNameOwner, getPrimaryName, primeNames } from './accounts';
import { loadDecisions, type DecisionsData } from './decisions';
import {
  activeBanFor,
  getBans,
  getJoinRequestFor,
  getJoinRequests,
  getMembers,
  getMembership,
  getStoredInviteFor,
  getStoredInvites,
} from './group';
import {
  QdnBlockedError,
  QdnUnavailableError,
  fetchQdnJson,
  mapLimit,
  rowTime,
  searchQdn,
} from './qdn';
import { fetchQuery, peekQuery } from './query';
import {
  NOMINATION_PREFIX,
  RECORD_SERVICE,
  SUPPORT_PREFIX,
  nominationIdentifier,
  nomineeFromIdentifier,
  parseNomination,
  parseSupport,
  supportIdentifier,
  type NominationRecord,
  type SupportRecord,
} from './records';
import { getAddressHistory, getDecisionsInRange } from './txs';
import type { AccountInfo, QdnRow, TxRow } from './types';

export interface Publisher {
  name: string;
  address: string;
  isAdmin: boolean;
  level: number;
}

/**
 * Why a record's text couldn't be read: its publisher is on this node's block
 * list (Core never fetches a blocked name's data), or the node hasn't got it yet.
 */
export type UnreadText = 'blocked' | 'missing';

export interface NominationEntry {
  publisher: Publisher;
  record: NominationRecord;
  /** The QDN row's newest timestamp (trusted over the body). */
  publishedAt: number;
  identifier: string;
  /**
   * The first publish of a record its nominator published again for a new
   * nomination (`publishedAt` is the row's `created`): only its time is
   * known, its text is the newer one's.
   */
  replaced?: true;
  /**
   * Its text couldn't be read on this node, so `record` has only the nominee,
   * from the identifier, and an empty reason. The nomination still counts:
   * who nominated whom and when come from the search row and the chain
   * (Simon, 2026-11-25: Minter Admins who block a nominator never saw that
   * nominator's nomination until another Minter Admin put it on chain).
   */
  unread?: UnreadText;
}

export interface SupportEntry {
  publisher: Publisher;
  record: SupportRecord;
  publishedAt: number;
}

export interface Nomination {
  nominee: string;
  /** From the member list or the record (a hint only, never trusted for identity). */
  nomineeName: string | null;
  /** 'qdn': a nomination record; 'chain': only a pending invite exists. */
  source: 'qdn' | 'chain';
  /** The first valid record of this round; null for chain-only nominations. */
  nomination: NominationEntry | null;
  /** Other valid nominations and supports, oldest first. */
  supporters: Array<NominationEntry | SupportEntry>;
  state: NominationState;
  publishedAt: number;
  /** For 'waiting': when it leaves the open list (ms). */
  waitingEndsAt: number | null;
  /** The decision collecting signatures ('signing'). */
  decision: Decision | null;
  /** The newest decided invite in this round. */
  latestInvite: TxRow | null;
  /**
   * Every valid nomination record about them, any round, oldest first: which
   * one an invite answered (nominationBehind).
   */
  records: NominationEntry[];
  /** Every valid support about them, any round, oldest first (the Minter Profile's links). */
  supportRecords: SupportEntry[];
  /**
   * When an earlier round's records stopped counting (ms): its newest record a
   * window on; null with none earlier. Records less than a window apart are
   * one round, as History's lapsed nominations group them (rules/nomination.ts
   * lapsedRounds). Comments and notes under the nominee's address count only
   * from then.
   */
  earlierRoundEnd: number | null;
  /**
   * Their rounds before this one, oldest first: lapsed, or decided by an
   * invite (rules/nomination.ts earlierRounds). Their comments show folded
   * under this one's (Simon, 2026-11-24).
   */
  earlierRounds: EarlierRound[];
  hasJoinRequest: boolean;
  hasStoredInvite: boolean;
}

export interface IgnoredRecord {
  name: string;
  identifier: string;
  why: 'unreadable' | 'invalid' | 'publisher' | 'self';
}

export interface NominationsData {
  all: Nomination[];
  open: Nomination[];
  ignored: IgnoredRecord[];
  truncated: boolean;
  decisions: DecisionsData;
  loadedAt: number;
}

interface RawRecord {
  row: QdnRow;
  body: unknown;
}

/** A body read: the body, one the node didn't give (`unread`), or one deleted or broken. */
type BodyRead = RawRecord | { row: QdnRow; unread: UnreadText } | { row: QdnRow; error: true };

/**
 * Each row's body. One the node didn't give is `unread`: at once when its
 * publisher is blocked on this node, else after the retries. A deleted body
 * (the publisher took it back) or one that isn't JSON is an error.
 */
async function readBodies(rows: QdnRow[]): Promise<BodyRead[]> {
  return mapLimit(rows, 6, async (row): Promise<BodyRead> => {
    try {
      const body = await fetchQdnJson(
        RECORD_SERVICE,
        row.name,
        row.identifier,
        row.latestSignature ?? rowTime(row)
      );
      return { row, body };
    } catch (error) {
      if (error instanceof QdnBlockedError) return { row, unread: 'blocked' };
      if (error instanceof QdnUnavailableError) return { row, unread: 'missing' };
      return { row, error: true };
    }
  });
}

/** What is known of a record whose text wasn't read: its nominee, from the identifier. */
function unreadRecord(identifier: string, prefix: string): { v: 1; nomineeAddress: string } | null {
  const nominee = identifier.startsWith(prefix) ? nomineeFromIdentifier(identifier) : null;
  return nominee ? { v: 1, nomineeAddress: nominee } : null;
}

type MembershipOf = (address: string) => Promise<{ isMember: boolean; isAdmin: boolean }>;

/** A level only matters at 5 (and levels change over weeks): a publisher's is kept 30 minutes. */
const PUBLISHER_LEVEL_TTL_MS = 30 * 60_000;

/**
 * The publisher's address, membership, admin role and level, checked now.
 * `primaryToAddress` (from the member list) saves a name lookup for members.
 * Admins may nominate at any level, so theirs isn't read.
 */
async function resolvePublishers(
  names: string[],
  membershipOf: MembershipOf,
  primaryToAddress: Map<string, string> = new Map()
): Promise<Map<string, Publisher | null>> {
  const result = new Map<string, Publisher | null>();
  await mapLimit([...new Set(names)], 6, async (name) => {
    try {
      const address = primaryToAddress.get(name) ?? (await getNameOwner(name));
      if (!address) {
        result.set(name, null);
        return;
      }
      const { isMember, isAdmin } = await membershipOf(address);
      if (!isMember && !isAdmin) {
        result.set(name, null);
        return;
      }
      const level = isAdmin
        ? (peekQuery<AccountInfo>(`account:${address}`)?.level ?? 0)
        : (await getAccount(address, { ttlMs: PUBLISHER_LEVEL_TTL_MS })).level;
      result.set(
        name,
        isEligibleNominator({ isAdmin, isMember, level }) ? { name, address, isAdmin, level } : null
      );
    } catch {
      result.set(name, null);
    }
  });
  return result;
}

interface AssembleInput {
  nominationRows: QdnRow[];
  supportRows: QdnRow[];
  publishers: Map<string, Publisher | null>;
  decisions: DecisionsData;
  invites: TxRow[];
  nomineeFacts: (nominee: string) => {
    isMember: boolean;
    hasJoinRequest: boolean;
    hasStoredInvite: boolean;
    activeBan: boolean;
  };
  nameOf: (nominee: string) => string | null;
  /** Only these nominees (a Minter Profile); all when omitted. */
  only?: string;
}

/**
 * When the round before `first`'s stopped counting: back from `first`, a record
 * less than a window before the next is still `first`'s round (one still
 * waiting when the next came, as lapsedRounds groups them); the first one
 * further back ended its round a window on. Null when there is none.
 */
function earlierEnd(
  records: readonly NominationEntry[],
  first: NominationEntry | null,
  windowMs: number
): number | null {
  if (!first) return null;
  const before = records
    .filter((record) => record.publishedAt < first.publishedAt)
    .sort((a, b) => b.publishedAt - a.publishedAt);
  let start = first.publishedAt;
  for (const record of before) {
    if (start - record.publishedAt > windowMs) return record.publishedAt + windowMs;
    start = record.publishedAt;
  }
  return null;
}

/** How a decided MINTER invite ended, by Core's approval status. */
const INVITE_OUTCOME: Record<string, DecidedInvite['outcome'] | undefined> = {
  APPROVED: 'approved',
  NOT_REQUIRED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

/**
 * Whether a record's first publish (`created`) was a nomination of its own,
 * which its nominator published again for a new one (Simon, 2026-11-24:
 * igorcoin nominated Stone Golem again, and the earlier nomination's
 * comments came with it). The app refuses a second nomination while one is
 * open, so a record published again after the first one's wait ran out, or
 * after an invite decided it, is a new nomination. One identifier per
 * nominee means the new one replaced the first, whose time stays in the
 * row's `created`.
 */
function publishedAgain(
  created: number,
  latest: number,
  windowMs: number,
  decided: readonly DecidedInvite[]
): boolean {
  if (!(created < latest - RECORD_CLOCK_SLACK_MS)) return false;
  if (latest - created > windowMs) return true;
  return decided.some(
    (invite) => invite.at >= created - RECORD_CLOCK_SLACK_MS && invite.at < latest
  );
}

async function assemble(
  input: AssembleInput
): Promise<{ all: Nomination[]; ignored: IgnoredRecord[] }> {
  const { decisions } = input;
  const now = decisions.now;
  const windowBlocks = waitingWindowBlocks(decisions.group);
  const ignored: IgnoredRecord[] = [];
  const [nominationBodies, supportBodies] = await Promise.all([
    readBodies(input.nominationRows),
    readBodies(input.supportRows),
  ]);

  const windowMs = windowBlocks * now.msPerBlock;
  const decidedBy = new Map<string, DecidedInvite[]>();
  const pendingBy = new Map<string, InviteSpan[]>();
  for (const tx of input.invites) {
    if (tx.type !== 'GROUP_INVITE') continue;
    const subject = decisionSubject(tx);
    if (!subject) continue;
    if (tx.approvalStatus === 'PENDING') {
      pendingBy.set(subject, [
        ...(pendingBy.get(subject) ?? []),
        { at: tx.timestamp, decidedAt: null },
      ]);
      continue;
    }
    const outcome = INVITE_OUTCOME[tx.approvalStatus ?? ''];
    if (!outcome) continue;
    decidedBy.set(subject, [
      ...(decidedBy.get(subject) ?? []),
      {
        signature: tx.signature,
        at: tx.timestamp,
        decidedAt: decidedAt(tx, now.msPerBlock, decisions.group.maximumBlockDelay),
        outcome,
      },
    ]);
  }

  const nominationsBy = new Map<string, NominationEntry[]>();
  for (const item of nominationBodies) {
    const { row } = item;
    if ('error' in item) {
      ignored.push({ name: row.name, identifier: row.identifier, why: 'unreadable' });
      continue;
    }
    // A record the node didn't give still counts, without its text: one
    // re-published longer goes off chain, and a node that blocks its
    // nominator never fetches it (seen 2026-11-25).
    const unread = 'unread' in item ? item.unread : undefined;
    const known = unread ? unreadRecord(row.identifier, NOMINATION_PREFIX) : null;
    const record: NominationRecord | null = known
      ? { ...known, reason: '', links: [] }
      : 'body' in item
        ? parseNomination(item.body, row.identifier)
        : null;
    if (!record) {
      ignored.push({ name: row.name, identifier: row.identifier, why: 'invalid' });
      continue;
    }
    const publisher = input.publishers.get(row.name);
    if (!publisher) {
      ignored.push({ name: row.name, identifier: row.identifier, why: 'publisher' });
      continue;
    }
    if (publisher.address === record.nomineeAddress) {
      ignored.push({ name: row.name, identifier: row.identifier, why: 'self' });
      continue;
    }
    const list = nominationsBy.get(record.nomineeAddress) ?? [];
    const publishedAt = rowTime(row);
    const text = unread ? { unread } : {};
    list.push({ publisher, record, publishedAt, identifier: row.identifier, ...text });
    if (
      publishedAgain(row.created, publishedAt, windowMs, decidedBy.get(record.nomineeAddress) ?? [])
    )
      list.push({
        publisher,
        record,
        publishedAt: row.created,
        identifier: row.identifier,
        replaced: true,
        ...text,
      });
    nominationsBy.set(record.nomineeAddress, list);
  }

  const supportsBy = new Map<string, SupportEntry[]>();
  for (const item of supportBodies) {
    if ('error' in item) continue;
    // A support the node didn't give still counts; only its note is missing.
    const record =
      'body' in item
        ? parseSupport(item.body, item.row.identifier)
        : unreadRecord(item.row.identifier, SUPPORT_PREFIX);
    const publisher = input.publishers.get(item.row.name);
    if (!record || !publisher || publisher.address === record.nomineeAddress) continue;
    const list = supportsBy.get(record.nomineeAddress) ?? [];
    list.push({ publisher, record, publishedAt: rowTime(item.row) });
    supportsBy.set(record.nomineeAddress, list);
  }

  const pendingInvites = new Map<string, Decision>();
  for (const d of decisions.decisions) {
    if (d.kind === 'invite' && d.subject && d.phase !== 'expired') pendingInvites.set(d.subject, d);
  }
  const latestDecided = new Map<string, TxRow>();
  for (const tx of input.invites) {
    if (tx.type !== 'GROUP_INVITE') continue;
    const subject = decisionSubject(tx);
    if (!subject || tx.approvalStatus === 'PENDING') continue;
    const current = latestDecided.get(subject);
    if (!current || tx.timestamp > current.timestamp) latestDecided.set(subject, tx);
  }

  let nominees = [...new Set<string>([...nominationsBy.keys(), ...pendingInvites.keys()])];
  if (input.only) nominees = nominees.filter((n) => n === input.only);
  const all: Nomination[] = [];
  for (const nominee of nominees) {
    const facts = input.nomineeFacts(nominee);
    const decision = pendingInvites.get(nominee) ?? null;
    const decided = latestDecided.get(nominee) ?? null;
    const decidedEnd = decided
      ? decidedAt(decided, now.msPerBlock, decisions.group.maximumBlockDelay)
      : null;
    const round = pickRound(nominationsBy.get(nominee) ?? [], {
      decidedEnd,
      decidedAt: decided?.timestamp ?? null,
      pendingAt: decision?.createdAt ?? null,
      nowMs: now.timestamp,
      windowMs,
    });
    const entries = round.entries;
    const first = entries[0] ?? null;
    // A round's supports came after its first record: older ones were for an earlier round.
    const roundStart = first ? first.publishedAt - RECORD_CLOCK_SLACK_MS : Number.NEGATIVE_INFINITY;
    const supports = (supportsBy.get(nominee) ?? []).filter(
      (s) =>
        s.publishedAt >= roundStart &&
        (decidedEnd === null
          ? true
          : round.fresh
            ? s.publishedAt > decidedEnd
            : s.publishedAt <= decidedEnd)
    );
    const publishedAt = first?.publishedAt ?? decision?.createdAt ?? 0;
    const state = nominationState({
      publishedAt,
      nowMs: now.timestamp,
      msPerBlock: now.msPerBlock,
      waitingWindowBlocks: windowBlocks,
      isMember: facts.isMember,
      activeBan: facts.activeBan,
      pendingInvite: decision?.tx ?? null,
      latestInvite: decided,
      storedInvite: facts.hasStoredInvite,
    });
    all.push({
      nominee,
      nomineeName: input.nameOf(nominee) ?? first?.record.nomineeName ?? null,
      source: first ? 'qdn' : 'chain',
      nomination: first,
      supporters: [...entries.slice(1), ...supports].sort((a, b) => a.publishedAt - b.publishedAt),
      state,
      publishedAt,
      waitingEndsAt:
        state === 'waiting' ? waitingEndsAt(publishedAt, now.msPerBlock, windowBlocks) : null,
      decision,
      latestInvite: decided,
      records: [...(nominationsBy.get(nominee) ?? [])].sort(
        (a, b) => a.publishedAt - b.publishedAt
      ),
      supportRecords: [...(supportsBy.get(nominee) ?? [])].sort(
        (a, b) => a.publishedAt - b.publishedAt
      ),
      earlierRoundEnd: earlierEnd(nominationsBy.get(nominee) ?? [], first, windowMs),
      earlierRounds: earlierRounds(
        nominationsBy.get(nominee) ?? [],
        decidedBy.get(nominee) ?? [],
        [
          ...(pendingBy.get(nominee) ?? []),
          ...(decision ? [{ at: decision.createdAt, decidedAt: null }] : []),
        ],
        {
          current: {
            start: publishedAt,
            invite: first && !round.fresh ? (decided?.signature ?? null) : null,
          },
          windowMs,
          nowMs: now.timestamp,
        }
      ),
      hasJoinRequest: facts.hasJoinRequest,
      hasStoredInvite: facts.hasStoredInvite,
    });
  }
  all.sort((a, b) => b.publishedAt - a.publishedAt);
  return { all, ignored };
}

/** Every nomination (the Nominations page, admins' queue, level 5+ homes). */
export function loadNominations(options: { force?: boolean } = {}): Promise<NominationsData> {
  return fetchQuery(
    'nominations:all',
    async () => {
      const force = options.force;
      const [nominationRows, supportRows, members, decisions, joinRequests, storedInvites, bans] =
        await Promise.all([
          searchQdn({ service: RECORD_SERVICE, identifier: NOMINATION_PREFIX }, { force }),
          searchQdn({ service: RECORD_SERVICE, identifier: SUPPORT_PREFIX }, { force }),
          getMembers(),
          loadDecisions({ force }),
          getJoinRequests({ force }),
          getStoredInvites({ force }),
          getBans(),
        ]);
      primeNames(members.members.map((m) => ({ address: m.member, name: m.primaryName })));
      const now = decisions.now;
      const adminSet = new Set(decisions.admins.admins.map((a) => a.member));
      const memberSet = new Set(members.members.map((m) => m.member));
      const primary = new Map<string, string>();
      const nameOf = new Map<string, string>();
      for (const m of members.members) {
        if (!m.primaryName) continue;
        primary.set(m.primaryName, m.member);
        nameOf.set(m.member, m.primaryName);
      }
      // Invites decided since the oldest nomination record, the last two windows at least, so
      // a round an invite answered long ago reads as decided, not lapsed, and a re-nomination
      // knows where the earlier round ended (Simon, 2026-11-17: QQQ Test's October round read
      // as lapsed). One typed search of MINTER's invites: a year is about 85, in 23 ms.
      const oldest = nominationRows.rows.reduce(
        (min, row) => Math.min(min, row.created ?? rowTime(row)),
        now.timestamp
      );
      const recordBlocks = Math.ceil((now.timestamp - oldest) / now.msPerBlock);
      const since = Math.max(
        1,
        now.height -
          Math.max(
            2 * decisions.group.maximumBlockDelay,
            recordBlocks + decisions.group.maximumBlockDelay
          ) -
          10
      );
      const recent = await getDecisionsInRange(['GROUP_INVITE'], since, now.height, {
        force,
        slot: 'nominations',
      }).catch(() => ({
        rows: [] as TxRow[],
        truncated: false,
        pages: 0,
      }));
      const publishers = await resolvePublishers(
        [...nominationRows.rows, ...supportRows.rows].map((r) => r.name),
        async (address) => ({ isMember: memberSet.has(address), isAdmin: adminSet.has(address) }),
        primary
      );
      const joinSet = new Set(joinRequests.map((r) => r.joiner));
      const storedSet = new Set(storedInvites.map((r) => r.invitee));
      const { all, ignored } = await assemble({
        nominationRows: nominationRows.rows,
        supportRows: supportRows.rows,
        publishers,
        decisions,
        invites: recent.rows,
        nomineeFacts: (n) => ({
          isMember: memberSet.has(n),
          hasJoinRequest: joinSet.has(n),
          hasStoredInvite: storedSet.has(n),
          activeBan: Boolean(activeBanFor(bans, n, now.timestamp)),
        }),
        nameOf: (n) => nameOf.get(n) ?? null,
      });
      return {
        all,
        open: all.filter((n) => isOpenState(n.state)),
        ignored,
        truncated:
          nominationRows.truncated ||
          supportRows.truncated ||
          members.truncated ||
          recent.truncated ||
          decisions.truncated,
        decisions,
        loadedAt: Date.now(),
      };
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/**
 * One person's nominations, without reading the whole group: the records
 * whose identifier names them, their pending invite, their own history.
 * Used by the status engine and Minter Profiles.
 */
export function loadNominationsFor(
  address: string,
  options: { force?: boolean } = {}
): Promise<Nomination[]> {
  return fetchQuery(
    `nominations:for:${address}`,
    async () => {
      const force = options.force;
      const [
        nominationRows,
        supportRows,
        decisions,
        membership,
        joinRequest,
        storedInvite,
        bans,
        history,
        name,
      ] = await Promise.all([
        searchQdn(
          { service: RECORD_SERVICE, identifier: nominationIdentifier(address), maxPages: 2 },
          { force }
        ),
        searchQdn(
          { service: RECORD_SERVICE, identifier: supportIdentifier(address), maxPages: 2 },
          { force }
        ),
        // The queue has its own pollers and a 45 s TTL: a status refresh doesn't force it.
        loadDecisions(),
        getMembership(address, { force }),
        getJoinRequestFor(address, { force }),
        getStoredInviteFor(address, { force }),
        getBans(),
        getAddressHistory(address, { force }),
        getPrimaryName(address).catch(() => null),
      ]);
      const adminSet = new Set(decisions.admins.admins.map((a) => a.member));
      const publishers = await resolvePublishers(
        [...nominationRows.rows, ...supportRows.rows].map((r) => r.name),
        async (a) => {
          if (adminSet.has(a)) return { isMember: true, isAdmin: true };
          return getMembership(a);
        }
      );
      const { all } = await assemble({
        nominationRows: nominationRows.rows,
        supportRows: supportRows.rows,
        publishers,
        decisions,
        invites: history.rows.filter((tx) => tx.type === 'GROUP_INVITE' && tx.invitee === address),
        nomineeFacts: () => ({
          isMember: membership.isMember,
          hasJoinRequest: Boolean(joinRequest),
          hasStoredInvite: Boolean(storedInvite),
          activeBan: Boolean(activeBanFor(bans, address, decisions.now.timestamp)),
        }),
        nameOf: () => name,
        only: address,
      });
      return all;
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/**
 * The nomination a MINTER invite of `invitee` made at `invitedAt` answered
 * (rules/nomination.ts nominationAnswered), from a nominations read; null
 * when it answered none, or the read hasn't come in.
 */
export function nominationBehind(
  nominations: ReadonlyArray<Pick<Nomination, 'nominee' | 'records'>> | undefined,
  invitee: string | null,
  invitedAt: number,
  windowMs: number
): NominationEntry | null {
  if (!invitee || !nominations) return null;
  const nomination = nominations.find((n) => n.nominee === invitee);
  return nomination ? nominationAnswered(nomination.records, invitedAt, windowMs) : null;
}

/**
 * For a timeline: who proposed each MINTER invite, its nominator when it
 * answered a nomination (nominationBehind); null leaves the invite's creator.
 */
export function inviteProposers(
  nominations: ReadonlyArray<Pick<Nomination, 'nominee' | 'records'>> | undefined,
  windowMs: number
): (event: { kind: string; subject: string | null; proposedAt: number }) => string | null {
  return (event) =>
    event.kind === 'invite'
      ? (nominationBehind(nominations, event.subject, event.proposedAt, windowMs)?.publisher
          .address ?? null)
      : null;
}

/** The open nomination for `address`, if any. */
export function openNominationFor(
  data: Pick<NominationsData, 'open'>,
  address: string
): Nomination | null {
  return data.open.find((n) => n.nominee === address) ?? null;
}

/** Records whose identifier names an address, for quick per-person lookups. */
export function recordsAbout(rows: QdnRow[], address: string): QdnRow[] {
  return rows.filter((row) => nomineeFromIdentifier(row.identifier) === address);
}
