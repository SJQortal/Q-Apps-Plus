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
  isEligibleNominator,
  isOpenState,
  nominationState,
  pickRound,
  waitingEndsAt,
  type NominationState,
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
import { fetchQdnJson, mapLimit, rowTime, searchQdn } from './qdn';
import { fetchQuery } from './query';
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
import type { QdnRow, TxRow } from './types';

export interface Publisher {
  name: string;
  address: string;
  isAdmin: boolean;
  level: number;
}

export interface NominationEntry {
  publisher: Publisher;
  record: NominationRecord;
  /** The QDN row's newest timestamp (trusted over the body). */
  publishedAt: number;
  identifier: string;
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

async function readBodies(
  rows: QdnRow[]
): Promise<Array<RawRecord | { row: QdnRow; error: true }>> {
  return mapLimit(rows, 6, async (row) => {
    try {
      const body = await fetchQdnJson(
        RECORD_SERVICE,
        row.name,
        row.identifier,
        row.latestSignature ?? rowTime(row)
      );
      return { row, body };
    } catch {
      return { row, error: true as const };
    }
  });
}

type MembershipOf = (address: string) => Promise<{ isMember: boolean; isAdmin: boolean }>;

/**
 * The publisher's address, membership, admin role and level, checked now.
 * `primaryToAddress` (from the member list) saves a name lookup for members.
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
      const level = (await getAccount(address)).level;
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
  /** Only these nominees (a person page); all when omitted. */
  only?: string;
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

  const nominationsBy = new Map<string, NominationEntry[]>();
  for (const item of nominationBodies) {
    const { row } = item;
    if ('error' in item) {
      ignored.push({ name: row.name, identifier: row.identifier, why: 'unreadable' });
      continue;
    }
    const record = parseNomination(item.body, row.identifier);
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
    list.push({ publisher, record, publishedAt: rowTime(row), identifier: row.identifier });
    nominationsBy.set(record.nomineeAddress, list);
  }

  const supportsBy = new Map<string, SupportEntry[]>();
  for (const item of supportBodies) {
    if ('error' in item) continue;
    const record = parseSupport(item.body, item.row.identifier);
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
  const windowMs = windowBlocks * now.msPerBlock;
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
      hasPendingInvite: Boolean(decision),
      nowMs: now.timestamp,
      windowMs,
    });
    const entries = round.entries;
    const supports = (supportsBy.get(nominee) ?? []).filter((s) =>
      decidedEnd === null
        ? true
        : round.fresh
          ? s.publishedAt > decidedEnd
          : s.publishedAt <= decidedEnd
    );
    const first = entries[0] ?? null;
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
      // Invites decided in the last two windows: enough to cover any open round.
      const since = Math.max(1, now.height - 2 * decisions.group.maximumBlockDelay - 10);
      const recent = await getDecisionsInRange(['GROUP_INVITE'], since, now.height, {
        force,
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
 * Used by the status engine and person pages.
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
        loadDecisions({ force }),
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
