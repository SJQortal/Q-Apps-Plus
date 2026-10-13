/**
 * "Since your last visit" (data/lastVisit.ts, rules/sinceLastVisit.ts):
 *
 * - useRecordVisit (the shell, on every screen) saves what the app shows now
 *   for the signed-in account, from data it already loads;
 * - useSinceLastVisit (Home) compares that with the session's baseline.
 *
 * Neither polls. They read the keys other views already keep fresh
 * (`decisions:queue`, `nominations:all`, `nominations:for:<address>`); the
 * only extra reads are the decided decisions' outcomes, once each.
 */
import { useCallback, useEffect, useReducer, useState } from 'react';
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
import { loadNominationsFor, type Nomination } from '../data/nominations';
import { peekQuery } from '../data/query';
import { getAddressHistory } from '../data/txs';
import {
  adminChanges,
  buildSnapshot,
  hasChanges,
  newestNomination,
  nomineeEvents,
  sinceSummary,
  vanishedDecisions,
  type SinceChanges,
} from '../rules/sinceLastVisit';
import type { MyStatus } from '../rules/status';
import { useSession } from '../state/session';
import { useDecisions, useMyStatus, useNominations } from './useData';
import { useQuery } from './useQuery';

/** Signed in and known: the account the snapshots are about. */
function accountOf(status: MyStatus | undefined): string | null {
  if (!status || status.kind === 'outsideHub' || status.kind === 'signedOut') return null;
  return status.address || null;
}

/** The newest nomination about `address` the status already loaded, if it did. */
function loadedNomination(address: string): Nomination | null | undefined {
  const list = peekQuery<Nomination[]>(`nominations:for:${address}`);
  return list ? newestNomination(list) : undefined;
}

/**
 * Save the signed-in account's snapshot whenever its data changes: the
 * Decisions queue for Minter Admins, the newest nomination for accounts not
 * in MINTER. Waits until that data is there, so a half-loaded screen never
 * overwrites a full snapshot.
 */
export function useRecordVisit(): void {
  const session = useSession();
  const { status } = useMyStatus();
  const address =
    session.status === 'ready' && accountOf(status) === session.address ? session.address : null;
  const isAdmin = Boolean(address && status?.isAdmin);
  const decisions = useDecisions(isAdmin);
  const data = decisions.data;

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
      })
    );
  }, [address, status, isAdmin, data]);
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

  // The same keys (and polls) as the admin's Home sections: no new reads.
  const decisions = useDecisions(isAdmin && baseline !== null);
  const nominations = useNominations(isAdmin && baseline !== null);
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
  const joined = Boolean(welcome && address && !isJoinedSeen(address));
  const changes: SinceChanges = { joined, admin, nominee };

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
        (!lastInvite || history.data !== undefined || history.isError)));

  const seen = useCallback(() => {
    if (!address) return;
    markSeen(
      address,
      buildSnapshot({
        at: Date.now(),
        height: decisions.data?.now.height ?? peekQuery<ChainNow>('chain:now')?.height ?? null,
        decisions: isAdmin ? decisions.data?.decisions : undefined,
        nomination: isNominee ? current : undefined,
      })
    );
    bump();
  }, [address, current, decisions.data, isAdmin, isNominee]);

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
