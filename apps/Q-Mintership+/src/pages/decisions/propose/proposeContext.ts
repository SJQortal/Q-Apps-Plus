/**
 * What a proposal's page needs from the Decisions queue (Simon, 2026-10-18:
 * every + Propose choice a page of its own, as Propose nomination is), from
 * the reads Decisions already shares, with no reads of its own: the
 * approvals needed and the approval window, the Minter Admins who can sign,
 * what an admin change would do to the target of every waiting decision
 * (and those decisions' labels), and who already has a proposal of each kind
 * waiting, so their row says so instead of offering it again.
 */
import { useCallback, useMemo } from 'react';
import { loadPrimaryNames, primaryNamesKey } from '../../../data/accountRows';
import type { DecisionsData } from '../../../data/decisions';
import type { MemberList } from '../../../data/group';
import type { Nomination } from '../../../data/nominations';
import { peekQuery } from '../../../data/query';
import type { GroupMemberRow } from '../../../data/types';
import { decisionTitle, type Decision } from '../../../rules/decision';
import { projectShift, type ShiftScenario } from '../../../rules/targetShift';
import { approvalsNeeded } from '../../../rules/threshold';
import { useQuery } from '../../../hooks/useQuery';
import { displayName } from '../../../utils/format';
import type { ProposalFacts } from '../ProposeSignDialog';
import type { ProposeKind } from '../proposeKinds';
import type { LabelOf } from '../targetShiftUi';
import { useShift } from '../useShift';

export interface ProposeContext extends ProposalFacts {
  totalAdmins: number;
  /** Admins who can sign (the null owner left out). */
  signers: GroupMemberRow[];
  /** What an admin change about `subject` would do to the target (null for other kinds). */
  projectImpact?: (kind: ProposeKind, subject: string) => ShiftScenario | null;
  /** Decisions' labels by signature, for that impact. */
  labelOf?: LabelOf;
}

/** The kinds a waiting proposal is on chain: a decline is a kick. */
export type WaitingKind =
  'kick' | 'ban' | 'addAdmin' | 'removeAdmin' | 'cancelBan' | 'cancelInvite';

/** Waiting proposals by kind, then by the account each is about: the decision's signature. */
export type WaitingProposals = ReadonlyMap<WaitingKind, ReadonlyMap<string, string>>;

const WAITING_KINDS: ReadonlySet<string> = new Set<WaitingKind>([
  'kick',
  'ban',
  'addAdmin',
  'removeAdmin',
  'cancelBan',
  'cancelInvite',
]);

/** Every proposal still waiting (not past its window), by kind and subject; the first one counts. */
export function waitingProposals(decisions: readonly Decision[]): WaitingProposals {
  const out = new Map<WaitingKind, Map<string, string>>();
  for (const d of decisions) {
    if (!WAITING_KINDS.has(d.kind) || !d.subject || d.phase === 'expired') continue;
    const kind = d.kind as WaitingKind;
    const bySubject = out.get(kind) ?? new Map<string, string>();
    if (!bySubject.has(d.subject)) bySubject.set(d.subject, d.signature);
    out.set(kind, bySubject);
  }
  return out;
}

/** The waiting kind a proposal of `kind` would be. */
export function waitingKindOf(kind: ProposeKind): WaitingKind {
  return kind === 'decline' ? 'kick' : kind;
}

/**
 * The numbers and lists a proposal's page needs, once the queue is in (null
 * before). `labels`: an admin change lists the waiting decisions it would tip
 * over, so the names of their accounts that no list here carries are read
 * (a few cached reads), as Decisions has them from its cards.
 */
export function useProposeContext(
  data: DecisionsData | undefined,
  members: MemberList | undefined,
  nominations: readonly Nomination[] | undefined,
  labels = false
): { ctx: ProposeContext | null; waiting: WaitingProposals } {
  const shift = useShift(data, members);
  const unnamed = useMemo(() => {
    if (!labels || !data) return [];
    const known = new Set([
      ...data.admins.admins.map((a) => a.member),
      ...(members?.members ?? []).filter((m) => m.primaryName).map((m) => m.member),
    ]);
    const subjects = data.decisions
      .map((d) => d.subject)
      .filter((a): a is string => Boolean(a) && !known.has(a as string));
    return [...new Set(subjects)].sort();
  }, [labels, data, members]);
  const subjectNames = useQuery(unnamed.length ? primaryNamesKey(unnamed) : null, (force) =>
    loadPrimaryNames(unnamed, { force })
  ).data;
  const projectImpact = useCallback(
    (kind: ProposeKind, subject: string) =>
      shift && (kind === 'addAdmin' || kind === 'removeAdmin')
        ? projectShift(shift.state, shift.list, [{ kind, subject }])
        : null,
    [shift]
  );
  return useMemo(() => {
    if (!data) return { ctx: null, waiting: new Map() };
    const names = new Map<string, string | null>();
    for (const a of data.admins.admins) names.set(a.member, a.primaryName ?? null);
    for (const m of members?.members ?? [])
      if (!names.has(m.member)) names.set(m.member, m.primaryName ?? null);
    const bySignature = new Map(data.decisions.map((d) => [d.signature, d]));
    // As Decisions labels its decisions: the nominee's name for an invite, else a member's.
    const labelOf: LabelOf = (signature) => {
      const d = bySignature.get(signature);
      if (!d) return 'A waiting decision';
      if (!d.subject) return `${decisionTitle(d)} (Core doesn’t say for whom)`;
      // An invite's nominee, named as their nomination names them (any round: it is a label).
      const nominee =
        d.kind === 'invite'
          ? (
              nominations?.find((n) => n.decision?.signature === d.signature) ??
              nominations?.find((n) => n.nominee === d.subject)
            )?.nomineeName
          : undefined;
      const name =
        nominee ??
        names.get(d.subject) ??
        subjectNames?.[d.subject] ??
        peekQuery<string | null>(`name:${d.subject}`) ??
        null;
      return `${decisionTitle(d)}: ${displayName(name, d.subject)}`;
    };
    return {
      ctx: {
        needed: approvalsNeeded(data.group.approvalThreshold, data.admins.adminCount),
        totalAdmins: data.admins.adminCount,
        maximumBlockDelay: data.group.maximumBlockDelay,
        msPerBlock: data.now.msPerBlock,
        signers: data.admins.signers,
        projectImpact,
        labelOf,
      },
      waiting: waitingProposals(data.decisions),
    };
  }, [data, members, nominations, projectImpact, subjectNames]);
}
