/**
 * "Since your last visit" (data/lastVisit.ts, rules/sinceLastVisit.ts):
 *
 * - useRecordVisit (the shell, on every screen) saves what the app shows now
 *   for the signed-in account, from data it already loads;
 * - useSinceLastVisit (Home) compares that with the session's baseline.
 *
 * Neither polls. They read the keys other views already keep fresh
 * (`decisions:queue`, `nominations:all`, `nominations:for:<address>`); the
 * only extra reads are the decided decisions' outcomes, once each, and the
 * replies to the account's comments since the last visit (one search, two
 * for a Minter Admin; data/replies.ts). A
 * nominator's own nominations come from `nominations:all`, saved whenever
 * a screen has read it (Home does for every nominator).
 */
import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import type { ChainNow } from '../data/chain';
import {
  claimAnnouncement,
  isJoinedSeen,
  knownOutcomes,
  loadOutcomes,
  markSeen,
  outcomesKey,
  recordVisit,
  visitBaseline,
} from '../data/lastVisit';
import { loadNominationsFor, type Nomination, type NominationsData } from '../data/nominations';
import { loadRepliesTo } from '../data/replies';
import { peekQuery, subscribeQuery } from '../data/query';
import { getAddressHistory } from '../data/txs';
import {
  adminChanges,
  buildSnapshot,
  hasChanges,
  madeEvents,
  newestNomination,
  nomineeEvents,
  sinceSummary,
  vanishedDecisions,
  type SinceChanges,
} from '../rules/sinceLastVisit';
import { isEligibleNominator } from '../rules/nomination';
import type { MyStatus } from '../rules/status';
import { useSession } from '../state/session';
import { useDecisions, useMyStatus, useNominations } from './useData';
import { useQuery } from './useQuery';

/** Signed in and known: the account the snapshots are about. */
function accountOf(status: MyStatus | undefined): string | null {
  if (!status || status.kind === 'outsideHub' || status.kind === 'signedOut') return null;
  return status.address || null;
}

/** A level 5+ member or a Minter Admin: someone who can have made nominations. */
function isNominator(status: MyStatus | undefined): boolean {
  return Boolean(status && isEligibleNominator(status));
}

/** A key's value as other views load it: follows it, never loads it. */
function useLoaded<T>(key: string | null): T | undefined {
  const subscribe = useCallback(
    (listener: () => void) => subscribeQuery(key ?? '__idle__', listener),
    [key]
  );
  const read = useCallback(() => (key ? peekQuery<T>(key) : undefined), [key]);
  return useSyncExternalStore(subscribe, read, read);
}

/** The newest nomination about `address` the status already loaded, if it did. */
function loadedNomination(address: string): Nomination | null | undefined {
  const list = peekQuery<Nomination[]>(`nominations:for:${address}`);
  return list ? newestNomination(list) : undefined;
}

/**
 * Save the signed-in account's snapshot whenever its data changes: the
 * Decisions queue for Minter Admins, the newest nomination for accounts not
 * in MINTER, and the nominations a nominator made once a screen has read
 * them. Waits until the queue or the nomination is there, so a half-loaded
 * screen never overwrites a full snapshot.
 */
export function useRecordVisit(): void {
  const session = useSession();
  const { status } = useMyStatus();
  const address =
    session.status === 'ready' && accountOf(status) === session.address ? session.address : null;
  const isAdmin = Boolean(address && status?.isAdmin);
  const decisions = useDecisions(isAdmin);
  const data = decisions.data;
  const nominator = Boolean(address && isNominator(status));
  const all = useLoaded<NominationsData>(nominator ? 'nominations:all' : null);

  useEffect(() => {
    if (!address || !status) return;
    if (isAdmin && !data) return;
    let nomination: Nomination | null | undefined;
    if (!status.isMember) {
      nomination = loadedNomination(address);
      if (nomination === undefined) return;
    }
    const height = data?.now.height ?? peekQuery<ChainNow>('chain:now')?.height ?? null;
    recordVisit(
      address,
      buildSnapshot({
        at: Date.now(),
        height,
        decisions: isAdmin ? data?.decisions : undefined,
        nomination,
        made: nominator && all ? { all: all.all, me: address } : undefined,
      })
    );
  }, [address, status, isAdmin, data, nominator, all]);
}

export interface SinceLastVisitResult {
  changes: SinceChanges;
  /** When the last visit was (ms), null when this device has none. */
  since: number | null;
  /** Something to show. */
  visible: boolean;
  /** Everything it depends on has loaded (or failed): the summary won't grow. */
  settled: boolean;
  /** The one sentence read out once, when settled. */
  summary: string | null;
  /** "Mark as seen": compare with now from here on. */
  markSeen: () => void;
  /** True once per account and session: read the summary out now. */
  claimAnnouncement: () => boolean;
}

/**
 * What changed since the last visit for `status`'s account. `welcome` is
 * Home's once-only welcome (pages/home/welcome.ts): it becomes "You're in".
 * Pass `status` undefined to switch it off (Settings).
 */
export function useSinceLastVisit(
  status: MyStatus | undefined,
  welcome: boolean
): SinceLastVisitResult {
  const address = accountOf(status);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const baseline = address ? visitBaseline(address) : null;
  const isAdmin = Boolean(address && status?.isAdmin);
  const isNominee = Boolean(address && status && !status.isMember);
  const nominator = Boolean(address && isNominator(status));

  // The same keys (and polls) as the admin's and nominator's Home sections: no new reads.
  const decisions = useDecisions(isAdmin && baseline !== null);
  const nominations = useNominations((isAdmin || nominator) && baseline !== null);
  // Loaded by the status itself for accounts not in MINTER; no poll of its own.
  const mine = useQuery(
    isNominee && baseline !== null ? `nominations:for:${address}` : null,
    (force) => loadNominationsFor(address as string, { force })
  );
  // How the last visit's round ended, when it no longer shows as a nomination
  // (the same read the status makes for accounts not in MINTER).
  const lastInvite = isNominee ? (baseline?.nomination?.decision ?? null) : null;
  const history = useQuery(lastInvite ? `history:${address}` : null, (force) =>
    getAddressHistory(address as string, { force })
  );

  // Replies to its comments since the last visit: for anyone with a name to comment under.
  const name = address ? status?.name || null : null;
  const repliesSince = baseline && name ? baseline.at : null;
  const replies = useQuery(
    repliesSince !== null ? `replies:${name}:${isAdmin}:${repliesSince}` : null,
    () => loadRepliesTo(name as string, repliesSince as number, { admin: isAdmin })
  );

  const vanished =
    baseline && decisions.data ? vanishedDecisions(baseline, decisions.data.decisions) : [];
  const signatures = vanished.map((d) => d.signature);
  const outcomes = useQuery(signatures.length ? outcomesKey(signatures) : null, () =>
    loadOutcomes(signatures)
  );
  // While a grown set loads, the outcomes already read stay on screen.
  const outcomeMap = outcomes.data ?? knownOutcomes(signatures);

  const admin =
    isAdmin && baseline && decisions.data && address
      ? adminChanges(baseline, {
          decisions: decisions.data.decisions,
          nominations: nominations.data?.open ?? null,
          me: address,
          outcomes: outcomeMap,
        })
      : null;
  const current = mine.data ? newestNomination(mine.data) : null;
  const decided = lastInvite
    ? (history.data?.rows.find((tx) => tx.signature === lastInvite) ?? null)
    : null;
  const nominee = isNominee && baseline ? nomineeEvents(baseline.nomination, current, decided) : [];
  const made =
    nominator && baseline && nominations.data && address
      ? madeEvents(baseline.made, nominations.data.all, address, admin?.decided)
      : [];
  const joined = Boolean(welcome && address && !isJoinedSeen(address));
  const changes: SinceChanges = { joined, admin, nominee, made, replies: replies.data ?? [] };

  const settled =
    (!isAdmin ||
      !baseline ||
      (Boolean(decisions.data) &&
        (signatures.length === 0 ||
          outcomes.data !== undefined ||
          outcomeMap.size === new Set(signatures).size ||
          outcomes.isError) &&
        (nominations.data !== undefined || nominations.isError))) &&
    (!isNominee ||
      !baseline ||
      ((mine.data !== undefined || mine.isError) &&
        (!lastInvite || history.data !== undefined || history.isError))) &&
    (!nominator || !baseline?.made || nominations.data !== undefined || nominations.isError) &&
    (repliesSince === null || replies.data !== undefined || replies.isError);

  const seen = useCallback(() => {
    if (!address) return;
    markSeen(
      address,
      buildSnapshot({
        at: Date.now(),
        height: decisions.data?.now.height ?? peekQuery<ChainNow>('chain:now')?.height ?? null,
        decisions: isAdmin ? decisions.data?.decisions : undefined,
        nomination: isNominee ? current : undefined,
        made:
          nominator && nominations.data ? { all: nominations.data.all, me: address } : undefined,
      })
    );
    bump();
  }, [address, current, decisions.data, isAdmin, isNominee, nominator, nominations.data]);

  const claim = useCallback(() => (address ? claimAnnouncement(address) : false), [address]);

  return {
    changes,
    since: baseline?.at ?? null,
    visible: hasChanges(changes),
    settled,
    summary: sinceSummary(changes),
    markSeen: seen,
    claimAnnouncement: claim,
  };
}

/**
 * The summary for a polite live region: empty first, filled a moment after
 * the panel settles (a region that appears already filled isn't reliably
 * read), and only the first time this session.
 */
export function useAnnounceOnce(result: SinceLastVisitResult): string {
  const [text, setText] = useState('');
  const { settled, visible, summary, claimAnnouncement: claim } = result;
  useEffect(() => {
    if (!settled || !visible || !summary || text) return;
    const timer = setTimeout(() => {
      if (claim()) setText(summary);
    }, 400);
    return () => clearTimeout(timer);
  }, [settled, visible, summary, text, claim]);
  return text;
}
