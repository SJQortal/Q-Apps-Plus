/**
 * The Decisions queue's data: every MINTER group change waiting for MINTER's
 * approval, with its signatures and its clock, from a fixed set of reads:
 *
 *   /groups/694, /groups/members/694?onlyAdmins=true, /blocks/last (+ one
 *   block for the block time), /transactions/pending?txGroupId=694, one
 *   GROUP_APPROVAL search over the blocks the pending ones can have
 *   signatures in, /transactions/unconfirmed?txType=GROUP_APPROVAL, and
 *   /transactions/pending (all groups) for the unusual approval route check.
 *   Each pending CANCEL_GROUP_INVITE's raw bytes are read once (kept for the
 *   session) for its group, which Core's JSON leaves out.
 *
 * About 8 GETs, each paged at 100, whatever the number of decisions.
 *
 * The queue lists MINTER group changes (groupId 694) as decisions. Other
 * pending transactions that wait for MINTER's admins are listed apart in
 * `others`, without Sign.
 *
 * Admin changes that would change nothing are marked as doubles
 * (rules/double.ts) from the admin rows read here. The approved addition
 * that made someone a Minter Admin is named only when their history is
 * already in this session's cache: no read is made for it.
 *
 * A waiting kick of someone with a join request is marked as a decline
 * (rules/decline.ts), from the join requests the nominations read already
 * (cached, and read only while a kick waits).
 */
import { PUBLIC_VOTE_KINDS } from '../rules/communityVotes';
import {
  buildDecision,
  decisionKind,
  decisionSubject,
  isMinterGroupChange,
  isUnusualApprovalRoute,
  sortDecisions,
  toApprovalRow,
  toOtherPending,
  type Decision,
  type OtherPending,
} from '../rules/decision';
import { markDeclines } from '../rules/decline';
import { approvedAddFor, markDoubles } from '../rules/double';
import type { ApprovalRow } from '../rules/tally';
import { decisionWindow, windowPhase } from '../rules/timing';
import { getChainNow, type ChainNow } from './chain';
import { getAdmins, getGroupInfo, getJoinRequests, type AdminList } from './group';
import type { PagedResult } from './core';
import { fetchQuery, peekQuery } from './query';
import {
  getApprovalsInRange,
  getPending,
  getPendingAllGroups,
  getUnconfirmedApprovals,
  withCancelInviteTargets,
} from './txs';
import type { GroupInfo, TxRow } from './types';

export interface DecisionsData {
  decisions: Decision[];
  /** MINTER transactions on an unusual approval route: groupId 694, txGroupId neither 694 nor 0 (admins only). */
  unusual: Decision[];
  /** Other transactions waiting for Minter Admins: not MINTER group changes, never signed here. */
  others: OtherPending[];
  group: GroupInfo;
  admins: AdminList;
  now: ChainNow;
  /** Every approval row read, for "who signed what" elsewhere. */
  approvals: ApprovalRow[];
  /** True when a paged read hit its ceiling (shown, never silent). */
  truncated: boolean;
  loadedAt: number;
}

/** Slack below the oldest pending block, for approvals sent while it was unconfirmed. */
const APPROVAL_SLACK_BLOCKS = 10;

export function loadDecisions(options: { force?: boolean } = {}): Promise<DecisionsData> {
  return fetchQuery(
    'decisions:queue',
    async () => {
      const force = options.force;
      const [group, admins, now, pending, unconfirmed, allPending] = await Promise.all([
        getGroupInfo(),
        getAdmins({ force }),
        getChainNow({ force }),
        getPending({ force }),
        getUnconfirmedApprovals({ force }),
        getPendingAllGroups({ force }).catch(() => ({ rows: [], truncated: false, pages: 0 })),
      ]);

      const rows = await withCancelInviteTargets(pending.rows);
      const minterRows = rows.filter(isMinterGroupChange);
      const others = rows.filter((tx) => !isMinterGroupChange(tx)).map(toOtherPending);

      const heights = minterRows
        .map((tx) => tx.blockHeight)
        .filter((h): h is number => typeof h === 'number');
      const oldest = heights.length ? Math.min(...heights) : now.height;
      const start = Math.max(1, oldest - APPROVAL_SLACK_BLOCKS);
      const confirmed = minterRows.length
        ? await getApprovalsInRange(start, now.height, { force, slot: 'queue' })
        : { rows: [], truncated: false, pages: 0 };

      const approvals = [...confirmed.rows, ...unconfirmed.rows]
        .map(toApprovalRow)
        .filter((row): row is ApprovalRow => row !== null);

      const ctx = {
        threshold: group.approvalThreshold,
        totalAdmins: admins.adminCount,
        delays: group,
        tipHeight: now.height,
        approvals,
      };
      const built = minterRows.map((tx) => buildDecision(tx, ctx));
      const adminSet = new Set(admins.admins.map((a) => a.member));
      const asking = await askingToJoin(built);
      const decisions = sortDecisions(
        markDeclines(
          markDoubles(built, {
            admins: adminSet,
            approvedAdds: knownApprovedAdds(built, adminSet),
          }),
          asking,
          adminSet
        )
      );
      const unusual = allPending.rows
        .filter(isUnusualApprovalRoute)
        .map((tx) => buildDecision(tx, ctx));

      return {
        decisions,
        unusual,
        others,
        group,
        admins,
        now,
        approvals,
        truncated: pending.truncated || confirmed.truncated || unconfirmed.truncated,
        loadedAt: Date.now(),
      };
    },
    { ttlMs: 45_000, force: options.force }
  );
}

/**
 * Who has a join request, read only while a kick waits (the cached list the
 * nominations read). Empty when it can't be read: the kicks keep their title.
 */
async function askingToJoin(decisions: readonly { kind: string }[]): Promise<Set<string>> {
  if (!decisions.some((d) => d.kind === 'kick')) return new Set();
  const rows = await getJoinRequests().catch(() => []);
  return new Set(rows.map((r) => r.joiner));
}

/**
 * For each waiting addition of someone who is a Minter Admin already: the
 * approved addition that made them one, from their history when this
 * session has already read it (key `history:<address>`). Never reads.
 */
function knownApprovedAdds(
  decisions: readonly Decision[],
  admins: ReadonlySet<string>
): Map<string, string> {
  const found = new Map<string, string>();
  for (const d of decisions) {
    if (d.kind !== 'addAdmin' || !d.subject || !admins.has(d.subject) || found.has(d.subject))
      continue;
    const rows = peekQuery<PagedResult<TxRow>>(`history:${d.subject}`)?.rows;
    const signature = rows ? approvedAddFor(rows, d.subject) : null;
    if (signature) found.set(d.subject, signature);
  }
  return found;
}

/** The open decision about `subject` of the given kind, if any (duplicate guard). */
export function findOpenDecision(
  data: Pick<DecisionsData, 'decisions'>,
  subject: string,
  kind: Decision['kind']
): Decision | null {
  return (
    data.decisions.find((d) => d.subject === subject && d.kind === kind && d.phase !== 'expired') ??
    null
  );
}

/**
 * How many proposals everyone may vote on (a removal that isn't a declined
 * join request, a ban, a new Minter Admin: rules/communityVotes.ts) are
 * waiting with approvals that can still count. It is what shows Decisions
 * to anyone who isn't a Minter Admin. Lighter than the queue: the pending
 * list, the group and the tip (the queue's own cached reads), plus the join
 * requests and the admins only while a kick waits. Key `decisions:public`.
 */
export function loadPublicProposalCount(options: { force?: boolean } = {}): Promise<number> {
  return fetchQuery(
    'decisions:public',
    async () => {
      const force = options.force;
      const [group, now, pending] = await Promise.all([
        getGroupInfo(),
        getChainNow({ force }),
        getPending({ force }),
      ]);
      const waiting = pending.rows.filter(isMinterGroupChange).flatMap((tx) => {
        const kind = decisionKind(tx);
        const subject = decisionSubject(tx);
        if (!subject || !PUBLIC_VOTE_KINDS.has(kind)) return [];
        if (typeof tx.blockHeight === 'number') {
          const phase = windowPhase(decisionWindow(tx.blockHeight, group), now.height);
          if (phase === 'tooLate' || phase === 'expired') return [];
        }
        return [{ kind, subject }];
      });
      if (!waiting.some((d) => d.kind === 'kick')) return waiting.length;
      const [asking, admins] = await Promise.all([askingToJoin(waiting), getAdmins()]);
      const adminSet = new Set(admins.admins.map((a) => a.member));
      return markDeclines(waiting, asking, adminSet).filter((d) => !d.decline).length;
    },
    { ttlMs: 60_000, force: options.force }
  );
}
