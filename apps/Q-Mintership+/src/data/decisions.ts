/**
 * The Decisions queue's data: every transaction waiting for MINTER's
 * approval, with its signatures and its clock, from a fixed set of reads:
 *
 *   /groups/694, /groups/members/694?onlyAdmins=true, /blocks/last (+ one
 *   block for the block time), /transactions/pending?txGroupId=694, one
 *   GROUP_APPROVAL search over the blocks the pending ones can have
 *   signatures in, /transactions/unconfirmed?txType=GROUP_APPROVAL, and
 *   /transactions/pending (all groups) for the unusual approval route check.
 *
 * About 8 GETs, each paged at 100, whatever the number of decisions.
 */
import {
  buildDecision,
  isUnusualApprovalRoute,
  sortDecisions,
  toApprovalRow,
  type Decision,
} from '../rules/decision';
import type { ApprovalRow } from '../rules/tally';
import { getChainNow, type ChainNow } from './chain';
import { getAdmins, getGroupInfo, type AdminList } from './group';
import { fetchQuery } from './query';
import {
  getApprovalsInRange,
  getPending,
  getPendingAllGroups,
  getUnconfirmedApprovals,
} from './txs';
import type { GroupInfo } from './types';

export interface DecisionsData {
  decisions: Decision[];
  /** MINTER transactions on an unusual approval route: groupId 694, txGroupId neither 694 nor 0 (admins only). */
  unusual: Decision[];
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

      const heights = pending.rows
        .map((tx) => tx.blockHeight)
        .filter((h): h is number => typeof h === 'number');
      const oldest = heights.length ? Math.min(...heights) : now.height;
      const start = Math.max(1, oldest - APPROVAL_SLACK_BLOCKS);
      const confirmed = pending.rows.length
        ? await getApprovalsInRange(start, now.height, { force })
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
      const decisions = sortDecisions(pending.rows.map((tx) => buildDecision(tx, ctx)));
      const unusual = allPending.rows
        .filter(isUnusualApprovalRoute)
        .map((tx) => buildDecision(tx, ctx));

      return {
        decisions,
        unusual,
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
