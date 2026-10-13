/**
 * "Since your last visit": what changed for the signed-in account between
 * the snapshot this device kept from its last visit and what the app shows
 * now. Pure; data/lastVisit.ts keeps the snapshots (localStorage, one per
 * account and group) and pages/home/SinceLastVisit.tsx shows the result.
 *
 * - Minter Admins: decisions that are new since then (not their own
 *   proposals), decisions open then that have been decided since
 *   (approved, rejected or expired), and nominations published since that
 *   wait for a first signature.
 * - Nominees: their nomination's progress (nominated, first signature, new
 *   signatures, new support, approved, expired, rejected, or closed without
 *   a first signature).
 * - Nominators (level 5+ members and Minter Admins): how the nominations
 *   they made ended (approved, the nominee joined, expired, rejected, or
 *   closed without a first signature), from the nominations Home already
 *   reads. Snapshots from before this was added have no `made`: nothing to
 *   compare until the next one.
 * - "You're in" is Home's welcome (pages/home/welcome.ts), not worked out
 *   here a second time.
 */
import type { Nomination } from '../data/nominations';
import type { TxRow } from '../data/types';
import { KIND_BY_TYPE, type Decision, type DecisionKind } from './decision';
import { isOpenState, type NominationState } from './nomination';

export const SNAPSHOT_VERSION = 1;
/** Decisions kept in a snapshot (MINTER rarely has more than a handful open). */
export const MAX_SNAPSHOT_DECISIONS = 100;
/** Decisions decided since the last visit that are looked up (one read each, kept for the session). */
export const MAX_OUTCOME_LOOKUPS = 12;
/** Nominations a nominator made that a snapshot keeps (open ones first, then the newest). */
export const MAX_SNAPSHOT_MADE = 20;

/** A decision as the snapshot keeps it. */
export interface SnapDecision {
  signature: string;
  kind: DecisionKind;
  /** Who it is about (null when Core's answer leaves it out). */
  subject: string | null;
  /** The block it was confirmed in (null while unconfirmed). */
  height: number | null;
}

/** The account's newest nomination as the snapshot keeps it. */
export interface SnapNomination {
  /** The invite of this round (pending or decided); null before a first signature. */
  decision: string | null;
  state: NominationState;
  /** Confirmed signatures then. */
  signed: number;
  /** Signatures needed then (null before a first signature). */
  needed: number | null;
  supporters: number;
  publishedAt: number;
}

/** A nomination the account made, as the snapshot keeps it. */
export interface SnapMade {
  nominee: string;
  /** The invite of this round (pending or decided); null before a first signature. */
  decision: string | null;
  state: NominationState;
  publishedAt: number;
}

export interface VisitSnapshot {
  v: typeof SNAPSHOT_VERSION;
  /** When it was saved (ms, this device's clock). */
  at: number;
  /** The chain tip then, when known. */
  height: number | null;
  /** Minter Admins: the Decisions queue then. Absent when the account wasn't an admin. */
  decisions?: SnapDecision[];
  /** Accounts not in MINTER: their newest nomination then (null: none). Absent for members. */
  nomination?: SnapNomination | null;
  /**
   * Nominators: the nominations they made then (at most MAX_SNAPSHOT_MADE).
   * Absent when not known (not a nominator, or no screen had read them).
   */
  made?: SnapMade[];
}

const KINDS = new Set<string>([...Object.values(KIND_BY_TYPE), 'other']);
const STATES = new Set<string>([
  'waiting',
  'signing',
  'approved',
  'joined',
  'expired',
  'rejected',
  'lapsed',
  'blocked',
]);

/** The invite a nomination's current round is about, if it has one. */
export function roundDecision(n: Nomination): string | null {
  if (n.decision) return n.decision.signature;
  if (n.state === 'expired' || n.state === 'rejected' || n.state === 'approved') {
    return n.latestInvite?.signature ?? null;
  }
  return null;
}

/** The newest of an account's nominations (any state), as data/nominations.ts lists them. */
export function newestNomination(list: readonly Nomination[]): Nomination | null {
  let newest: Nomination | null = null;
  for (const n of list) if (!newest || n.publishedAt > newest.publishedAt) newest = n;
  return newest;
}

export function snapDecision(d: Decision): SnapDecision {
  return { signature: d.signature, kind: d.kind, subject: d.subject, height: d.blockHeight };
}

export function snapNomination(n: Nomination | null): SnapNomination | null {
  if (!n) return null;
  return {
    decision: roundDecision(n),
    state: n.state,
    signed: n.decision?.tally?.approvalCount ?? 0,
    needed: n.decision?.tally?.needed ?? null,
    supporters: n.supporters.length,
    publishedAt: n.publishedAt,
  };
}

/** True when `address` published a nomination record in this round (the first or a later one). */
export function madeBy(n: Nomination, address: string): boolean {
  if (n.nomination?.publisher.address === address) return true;
  return n.supporters.some((s) => 'identifier' in s && s.publisher.address === address);
}

/** The nominations `address` made: open ones first, then the newest. */
export function nominationsMade(all: readonly Nomination[], address: string): Nomination[] {
  return all
    .filter((n) => madeBy(n, address))
    .sort(
      (a, b) =>
        Number(isOpenState(b.state)) - Number(isOpenState(a.state)) || b.publishedAt - a.publishedAt
    );
}

export function snapMade(all: readonly Nomination[], address: string): SnapMade[] {
  return nominationsMade(all, address)
    .slice(0, MAX_SNAPSHOT_MADE)
    .map((n) => ({
      nominee: n.nominee,
      decision: roundDecision(n),
      state: n.state,
      publishedAt: n.publishedAt,
    }));
}

/**
 * What this device saves for the account now. `decisions` only for Minter
 * Admins, `nomination` (the newest, any state) only for accounts not in
 * MINTER, `made` (from every nomination; the account's own are kept) only
 * for nominators; leave any out when it doesn't apply or isn't loaded.
 */
export function buildSnapshot(input: {
  at: number;
  height: number | null;
  decisions?: Decision[];
  nomination?: Nomination | null;
  made?: { all: readonly Nomination[]; me: string };
}): VisitSnapshot {
  const snapshot: VisitSnapshot = { v: SNAPSHOT_VERSION, at: input.at, height: input.height };
  if (input.decisions) {
    snapshot.decisions = input.decisions.slice(0, MAX_SNAPSHOT_DECISIONS).map(snapDecision);
  }
  if (input.nomination !== undefined) snapshot.nomination = snapNomination(input.nomination);
  if (input.made) snapshot.made = snapMade(input.made.all, input.made.me);
  return snapshot;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isHeight = (value: unknown): value is number | null => value === null || isCount(value);

function parseSnapDecision(raw: unknown): SnapDecision | null {
  const d = raw as Partial<SnapDecision> | null;
  if (!d || typeof d !== 'object') return null;
  if (typeof d.signature !== 'string' || !d.signature) return null;
  if (typeof d.kind !== 'string' || !KINDS.has(d.kind)) return null;
  if (!(d.subject === null || typeof d.subject === 'string')) return null;
  if (!isHeight(d.height)) return null;
  return { signature: d.signature, kind: d.kind, subject: d.subject, height: d.height };
}

function parseSnapNomination(raw: unknown): SnapNomination | null | undefined {
  if (raw === null) return null;
  const n = raw as Partial<SnapNomination> | null;
  if (!n || typeof n !== 'object') return undefined;
  if (!(n.decision === null || (typeof n.decision === 'string' && n.decision))) return undefined;
  if (typeof n.state !== 'string' || !STATES.has(n.state)) return undefined;
  if (!isCount(n.signed) || !isHeight(n.needed) || !isCount(n.supporters)) return undefined;
  if (!isCount(n.publishedAt)) return undefined;
  return {
    decision: n.decision,
    state: n.state,
    signed: n.signed,
    needed: n.needed,
    supporters: n.supporters,
    publishedAt: n.publishedAt,
  };
}

function parseSnapMade(raw: unknown): SnapMade | null {
  const m = raw as Partial<SnapMade> | null;
  if (!m || typeof m !== 'object') return null;
  if (typeof m.nominee !== 'string' || !m.nominee) return null;
  if (!(m.decision === null || (typeof m.decision === 'string' && m.decision))) return null;
  if (typeof m.state !== 'string' || !STATES.has(m.state)) return null;
  if (!isCount(m.publishedAt)) return null;
  return { nominee: m.nominee, decision: m.decision, state: m.state, publishedAt: m.publishedAt };
}

/** A stored snapshot, checked field by field (storage can hold anything); null when it can't be read. */
export function parseSnapshot(raw: unknown): VisitSnapshot | null {
  const s = raw as Partial<VisitSnapshot> | null;
  if (!s || typeof s !== 'object' || s.v !== SNAPSHOT_VERSION) return null;
  if (!isCount(s.at) || !isHeight(s.height ?? null)) return null;
  const snapshot: VisitSnapshot = { v: SNAPSHOT_VERSION, at: s.at, height: s.height ?? null };
  if ('decisions' in s) {
    if (!Array.isArray(s.decisions)) return null;
    snapshot.decisions = s.decisions
      .slice(0, MAX_SNAPSHOT_DECISIONS)
      .map(parseSnapDecision)
      .filter((d): d is SnapDecision => d !== null);
  }
  if ('nomination' in s) {
    const nomination = parseSnapNomination(s.nomination);
    if (nomination !== undefined) snapshot.nomination = nomination;
  }
  // Added later in v1: anything but a list is left out, as if it weren't known.
  if (Array.isArray(s.made)) {
    snapshot.made = s.made
      .slice(0, MAX_SNAPSHOT_MADE)
      .map(parseSnapMade)
      .filter((m): m is SnapMade => m !== null);
  }
  return snapshot;
}

// ---- Minter Admins ---------------------------------------------------------

export type Outcome = 'approved' | 'rejected' | 'expired';

export interface DecidedEntry {
  signature: string;
  kind: DecisionKind;
  subject: string | null;
  /** Who proposed it, when known: an admin change about oneself has its own title. */
  creatorAddress: string | null;
  outcome: Outcome;
  /** The block Core decided it in, when known. */
  height: number | null;
}

/** Core's approvalStatus as an outcome; null while it isn't decided (or unknown). */
export function outcomeOf(tx: Pick<TxRow, 'approvalStatus'> | null | undefined): Outcome | null {
  switch (tx?.approvalStatus) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'EXPIRED':
      return 'expired';
    default:
      return null;
  }
}

/**
 * The decisions of the snapshot that are no longer in the queue, newest
 * first, at most MAX_OUTCOME_LOOKUPS: the ones to look up.
 */
export function vanishedDecisions(
  previous: VisitSnapshot,
  current: ReadonlyArray<Pick<Decision, 'signature'>>
): SnapDecision[] {
  if (!previous.decisions) return [];
  const now = new Set(current.map((d) => d.signature));
  return previous.decisions
    .filter((d) => !now.has(d.signature))
    .sort((a, b) => (b.height ?? Number.MAX_SAFE_INTEGER) - (a.height ?? Number.MAX_SAFE_INTEGER))
    .slice(0, MAX_OUTCOME_LOOKUPS);
}

export interface AdminChanges {
  /** In the queue now, not at the last visit, and not proposed by this admin. */
  newDecisions: Decision[];
  /** Open at the last visit, decided since. */
  decided: DecidedEntry[];
  /** Published since the last visit, still waiting for a first signature. */
  newNominations: Nomination[];
}

/**
 * What changed for a Minter Admin. `outcomes` holds the looked-up
 * transactions of vanishedDecisions() (null when Core didn't know one);
 * decisions without a known outcome are left out rather than guessed.
 */
export function adminChanges(
  previous: VisitSnapshot,
  input: {
    decisions: Decision[];
    nominations: Nomination[] | null;
    me: string;
    outcomes: ReadonlyMap<
      string,
      Pick<TxRow, 'approvalStatus' | 'approvalHeight' | 'creatorAddress'> | null
    >;
  }
): AdminChanges {
  const before = previous.decisions ? new Set(previous.decisions.map((d) => d.signature)) : null;
  const newDecisions = before
    ? input.decisions.filter(
        (d) =>
          !before.has(d.signature) &&
          d.creatorAddress !== input.me &&
          d.phase !== 'expired' &&
          d.kind !== 'other'
      )
    : [];

  const decided: DecidedEntry[] = [];
  if (previous.decisions && before) {
    for (const d of input.decisions) {
      if (d.phase !== 'expired' || !before.has(d.signature)) continue;
      decided.push({
        signature: d.signature,
        kind: d.kind,
        subject: d.subject,
        creatorAddress: d.creatorAddress ?? null,
        outcome: 'expired',
        height: d.window?.expiresAtHeight ?? null,
      });
    }
    for (const d of vanishedDecisions(previous, input.decisions)) {
      const tx = input.outcomes.get(d.signature);
      const outcome = outcomeOf(tx);
      if (!outcome) continue;
      decided.push({
        signature: d.signature,
        kind: d.kind,
        subject: d.subject,
        creatorAddress: tx?.creatorAddress ?? null,
        outcome,
        height: typeof tx?.approvalHeight === 'number' ? tx.approvalHeight : null,
      });
    }
  }
  decided.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

  const newNominations = (input.nominations ?? []).filter(
    (n) =>
      n.state === 'waiting' &&
      n.publishedAt > previous.at &&
      n.nominee !== input.me &&
      n.nomination?.publisher.address !== input.me
  );

  return { newDecisions, decided, newNominations };
}

// ---- Nominees --------------------------------------------------------------

export type NomineeEvent =
  | { kind: 'nominated'; nomination: Nomination }
  | { kind: 'firstSignature'; signed: number; needed: number | null }
  | { kind: 'signatures'; added: number; signed: number; needed: number | null }
  | { kind: 'support'; added: number }
  | { kind: 'approved' }
  | { kind: 'expired'; signed: number; needed: number | null }
  | { kind: 'rejected' }
  | { kind: 'lapsed' };

/** The same nomination round as at the last visit (the same invite, or the same record). */
export function sameRound(
  previous: Pick<SnapNomination, 'decision' | 'publishedAt'>,
  current: Nomination
): boolean {
  const decision = roundDecision(current);
  if (previous.decision && decision) return previous.decision === decision;
  return Math.abs(previous.publishedAt - current.publishedAt) < 1000;
}

/** The outcome event for a round that was still open at the last visit, if it ended. */
function endedEvent(previous: SnapNomination, outcome: Outcome | null): NomineeEvent | null {
  if (!outcome || previous.state === outcome) return null;
  if (outcome === 'expired') {
    return { kind: 'expired', signed: previous.signed, needed: previous.needed };
  }
  return { kind: outcome };
}

/**
 * What happened to the account's nomination since the last visit, outcome
 * first. `previous` undefined means the snapshot didn't cover it (the
 * account was a member then, or there was no snapshot): nothing to compare.
 *
 * `decided` is the account's MINTER history row for the last visit's invite
 * (previous.decision), when it has one: it tells how that round ended when
 * the round no longer shows as a nomination (an invite without a
 * nomination record, or a newer nomination in its place).
 */
export function nomineeEvents(
  previous: SnapNomination | null | undefined,
  current: Nomination | null,
  decided?: Pick<TxRow, 'signature' | 'approvalStatus'> | null
): NomineeEvent[] {
  if (previous === undefined) return [];
  const open = current ? isOpenState(current.state) && current.state !== 'blocked' : false;
  if (!current || !previous || !sameRound(previous, current)) {
    const events: NomineeEvent[] = [];
    if (previous?.decision && decided?.signature === previous.decision) {
      const ended = endedEvent(previous, outcomeOf(decided));
      if (ended) events.push(ended);
    }
    if (current && open) events.push({ kind: 'nominated', nomination: current });
    return events;
  }

  const events: NomineeEvent[] = [];
  const changed = previous.state !== current.state;
  if (
    changed &&
    (current.state === 'approved' || current.state === 'expired' || current.state === 'rejected')
  ) {
    const ended = endedEvent(previous, current.state);
    if (ended) events.push(ended);
  }
  if (changed && current.state === 'lapsed' && previous.state === 'waiting') {
    events.push({ kind: 'lapsed' });
  }

  const tally = current.decision?.tally ?? null;
  if (current.state === 'signing' && current.decision && tally) {
    if (!previous.decision) {
      events.push({ kind: 'firstSignature', signed: tally.approvalCount, needed: tally.needed });
    } else if (tally.approvalCount > previous.signed) {
      events.push({
        kind: 'signatures',
        added: tally.approvalCount - previous.signed,
        signed: tally.approvalCount,
        needed: tally.needed,
      });
    }
  }

  if (open && current.supporters.length > previous.supporters) {
    events.push({ kind: 'support', added: current.supporters.length - previous.supporters });
  }
  return events;
}

// ---- Nominators -------------------------------------------------------------

/** How a nomination the account made ended: `joined` when the nominee is in MINTER now. */
export type MadeOutcome = 'approved' | 'joined' | 'expired' | 'rejected' | 'lapsed';

export interface MadeEvent {
  kind: MadeOutcome;
  nominee: string;
  /** A hint for the name (the member list's or the record's), never trusted for identity. */
  nomineeName: string | null;
  /** The round's invite, when it had one. */
  decision: string | null;
}

/** The states a nomination can have been in at the last visit for each outcome to be news. */
const MADE_FROM: Record<MadeOutcome, readonly NominationState[]> = {
  approved: ['waiting', 'signing'],
  joined: ['waiting', 'signing', 'approved'],
  expired: ['waiting', 'signing'],
  rejected: ['waiting', 'signing'],
  lapsed: ['waiting'],
};

const MADE_ORDER: Record<MadeOutcome, number> = {
  joined: 0,
  approved: 1,
  rejected: 2,
  expired: 3,
  lapsed: 4,
};

function isMadeOutcome(state: NominationState): state is MadeOutcome {
  return state in MADE_FROM;
}

/**
 * How the nominations `me` made ended since the last visit, the good news
 * first. `previous` undefined (an older snapshot, or not a nominator then)
 * means nothing to compare. A round that isn't the one the snapshot kept
 * is left out rather than guessed; so is one whose invite is in `decided`
 * (a Minter Admin's "decided since" rows already say it).
 */
export function madeEvents(
  previous: readonly SnapMade[] | undefined,
  all: readonly Nomination[],
  me: string,
  decided: ReadonlyArray<Pick<DecidedEntry, 'signature'>> = []
): MadeEvent[] {
  if (!previous) return [];
  const before = new Map(previous.map((m) => [m.nominee, m]));
  const shown = new Set(decided.map((d) => d.signature));
  const events: Array<{ event: MadeEvent; at: number }> = [];
  for (const n of all) {
    const then = before.get(n.nominee);
    if (!then || !isMadeOutcome(n.state) || !madeBy(n, me) || !sameRound(then, n)) continue;
    if (!MADE_FROM[n.state].includes(then.state)) continue;
    const decision = roundDecision(n) ?? then.decision;
    if (decision && shown.has(decision)) continue;
    events.push({
      event: { kind: n.state, nominee: n.nominee, nomineeName: n.nomineeName, decision },
      at: n.publishedAt,
    });
  }
  return events
    .sort((a, b) => MADE_ORDER[a.event.kind] - MADE_ORDER[b.event.kind] || b.at - a.at)
    .map((e) => e.event);
}

// ---- Together --------------------------------------------------------------

export interface SinceChanges {
  /** Home's welcome: the account became a member since the last visit. */
  joined: boolean;
  admin: AdminChanges | null;
  nominee: NomineeEvent[];
  /** Nominators: how the nominations they made ended (absent: none). */
  made?: MadeEvent[];
}

export function hasChanges(changes: SinceChanges): boolean {
  const a = changes.admin;
  return (
    changes.joined ||
    changes.nominee.length > 0 ||
    Boolean(changes.made?.length) ||
    Boolean(a && (a.newDecisions.length || a.decided.length || a.newNominations.length))
  );
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function nomineeWords(e: NomineeEvent): string {
  switch (e.kind) {
    case 'nominated':
      return "you've been nominated";
    case 'firstSignature':
      return 'a Minter Admin signed your nomination first';
    case 'signatures':
      return `${count(e.added, 'new signature', 'new signatures')} on your nomination`;
    case 'support':
      return count(e.added, 'new supporter', 'new supporters');
    case 'approved':
      return 'your nomination was approved';
    case 'expired':
      return 'your nomination expired';
    case 'rejected':
      return 'your nomination was rejected';
    case 'lapsed':
      return 'your nomination closed without a first signature';
  }
}

/** One sentence for screen readers, read once: "Since your last visit: 3 new decisions, 1 decided." */
export function sinceSummary(changes: SinceChanges): string | null {
  const parts: string[] = [];
  if (changes.joined) parts.push("you're in");
  const a = changes.admin;
  if (a?.newDecisions.length)
    parts.push(count(a.newDecisions.length, 'new decision', 'new decisions'));
  if (a?.newNominations.length) {
    parts.push(count(a.newNominations.length, 'new nomination', 'new nominations'));
  }
  if (a?.decided.length) parts.push(`${a.decided.length} decided`);
  for (const e of changes.nominee) parts.push(nomineeWords(e));
  const made = changes.made ?? [];
  const ended = (kinds: readonly MadeOutcome[]) =>
    made.filter((e) => kinds.includes(e.kind)).length;
  const approved = ended(['approved', 'joined']);
  const rejected = ended(['rejected']);
  const ranOut = ended(['expired', 'lapsed']);
  if (approved)
    parts.push(
      count(approved, 'nomination you made was approved', 'nominations you made were approved')
    );
  if (rejected)
    parts.push(
      count(rejected, 'nomination you made was rejected', 'nominations you made were rejected')
    );
  if (ranOut)
    parts.push(count(ranOut, 'nomination you made ran out', 'nominations you made ran out'));
  return parts.length ? `Since your last visit: ${parts.join(', ')}.` : null;
}
