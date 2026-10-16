/**
 * A Minter Admin's answers (approvals and rejections), read only when asked:
 * key `xanswers:<address>`, `{ approvals, answers, nextOffset, done, … }`.
 *
 * - Their GROUP_APPROVAL transactions, newest first, 100 a page, 5 pages a
 *   step ("Load more" reads 5 more), through the Explorer's heavy-read slot
 *   (an address search costs about the same whatever the page size). Stop
 *   ends a step after the page being read.
 * - Each is joined to the decision it answers: MINTER's own decisions (one
 *   search over MINTER's decision types, 100 a page, newest first, key
 *   `xminterdecisions:<page>`; older pages never change, so they are kept
 *   for the session, and the newest is read again after a minute), plus the
 *   waiting ones in the Decisions queue the app already caches. Pages are
 *   read until they reach a decision window before the oldest answer read.
 * - An answer on anything else is left out and counted; one older than the
 *   decisions read (their ceiling) is counted apart.
 *
 * Read-only.
 */
import { decisionKind, decisionSubject, type DecisionKind } from '../../rules/decision';
import { decisionOutcome, type DecisionOutcome } from '../../rules/outcome';
import { MINTER_GROUP_ID } from '../constants';
import { getJson, query } from '../core';
import { loadDecisions } from '../decisions';
import { getGroupInfo } from '../group';
import { fetchQuery, peekQuery } from '../query';
import { isMinterTx } from '../txs';
import { APPROVAL_GATED_TYPES, type TxRow } from '../types';
import { heavyQuery } from './heavy';

/** Rows per page, and pages per step ("Load more"). */
export const ANSWER_PAGE_SIZE = 100;
export const ANSWER_STEP_PAGES = 5;
/** MINTER decisions read at most to match answers: the newest 3,000. */
export const DECISION_PAGE_SIZE = 100;
export const DECISION_PAGES_MAX = 30;

/** A MINTER decision, as an answer needs it. */
export interface DecisionRef {
  signature: string;
  kind: DecisionKind;
  /** Who it is about (null when Core's answer leaves it out). */
  subject: string | null;
  creatorAddress: string | null;
  height: number | null;
  outcome: DecisionOutcome;
  /** A kick the queue marked as declining a join request. */
  decline: boolean;
}

export function decisionRef(tx: TxRow, decline = false): DecisionRef {
  return {
    signature: tx.signature,
    kind: decisionKind(tx),
    subject: decisionSubject(tx),
    creatorAddress: tx.creatorAddress ?? null,
    height: typeof tx.blockHeight === 'number' ? tx.blockHeight : null,
    outcome: decisionOutcome(tx),
    decline,
  };
}

// ---- MINTER's decisions --------------------------------------------------------------

export interface DecisionPage {
  rows: DecisionRef[];
  /** Core answered a full page: there may be more. */
  full: boolean;
}

export function minterDecisionsPath(page: number): string {
  return `/transactions/search?${query({
    txGroupId: MINTER_GROUP_ID,
    txType: APPROVAL_GATED_TYPES,
    confirmationStatus: 'CONFIRMED',
    limit: DECISION_PAGE_SIZE,
    offset: page * DECISION_PAGE_SIZE,
    reverse: true,
  })}`;
}

/**
 * One page of MINTER's decisions, newest first (key `xminterdecisions:<page>`).
 * The newest page is read again after a minute and keeps the rows it had
 * (new decisions push them onto page 1, which may have been read already),
 * so the pages together never miss a decision; older pages are kept.
 */
export function loadMinterDecisionPage(
  page: number,
  options: { force?: boolean } = {}
): Promise<DecisionPage> {
  const key = `xminterdecisions:${page}`;
  return fetchQuery(
    key,
    async () => {
      const body = await getJson<unknown>(minterDecisionsPath(page));
      const raw = (Array.isArray(body) ? body : []) as TxRow[];
      const rows = raw.filter((tx) => tx && isMinterTx(tx)).map((tx) => decisionRef(tx));
      if (page === 0) {
        const fresh = new Set(rows.map((row) => row.signature));
        for (const row of peekQuery<DecisionPage>(key)?.rows ?? [])
          if (!fresh.has(row.signature)) rows.push(row);
      }
      return { rows, full: raw.length >= DECISION_PAGE_SIZE };
    },
    { ttlMs: page === 0 ? 60_000 : Number.POSITIVE_INFINITY, force: options.force }
  );
}

export interface DecisionIndex {
  bySignature: Map<string, DecisionRef>;
  /** The oldest decision's block among the pages read (null before any). */
  oldestHeight: number | null;
  /** Every MINTER decision was read. */
  done: boolean;
  /** Pages read. */
  pages: number;
  /** The ceiling stopped the read before it reached far enough back. */
  capped: boolean;
}

function indexOf(pages: readonly DecisionPage[]): DecisionIndex {
  const bySignature = new Map<string, DecisionRef>();
  let oldest: number | null = null;
  for (const page of pages)
    for (const row of page.rows) {
      bySignature.set(row.signature, row);
      if (row.height !== null && (oldest === null || row.height < oldest)) oldest = row.height;
    }
  const last = pages[pages.length - 1];
  return {
    bySignature,
    oldestHeight: oldest,
    done: Boolean(last && !last.full),
    pages: pages.length,
    capped: false,
  };
}

/**
 * MINTER's decisions back to block `height` (or all of them), page by page,
 * at most 30 pages. Null `height`: the newest page, plus any older pages
 * this session read already.
 */
export async function minterDecisionsTo(height: number | null): Promise<DecisionIndex> {
  const pages: DecisionPage[] = [];
  for (let page = 0; page < DECISION_PAGES_MAX; page++) {
    const cached = page > 0 ? peekQuery<DecisionPage>(`xminterdecisions:${page}`) : undefined;
    const index = indexOf(pages);
    const reached =
      pages.length > 0 &&
      (index.done ||
        height === null ||
        (index.oldestHeight !== null && index.oldestHeight <= height));
    if (reached && !cached) return index;
    pages.push(cached ?? (await loadMinterDecisionPage(page)));
    if (!pages[pages.length - 1].full) return indexOf(pages);
  }
  return { ...indexOf(pages), capped: true };
}

/** The decisions waiting for approvals, from the queue the app caches (none when it can't be read). */
async function waitingDecisions(): Promise<DecisionRef[]> {
  try {
    const queue = await loadDecisions();
    return queue.decisions.map((d) => decisionRef(d.tx, Boolean(d.decline)));
  } catch {
    return [];
  }
}

// ---- answers ---------------------------------------------------------------------------

export interface ApprovalRow {
  signature: string;
  pendingSignature: string;
  /** True: approved; false: rejected. */
  approval: boolean;
  height: number | null;
  timestamp: number;
}

export interface Answer extends ApprovalRow {
  decision: DecisionRef;
}

export interface AnswersRead {
  /** Every GROUP_APPROVAL read, newest first. */
  approvals: ApprovalRow[];
  /** Those on MINTER decisions, newest first. */
  answers: Answer[];
  /** Answers on something other than a MINTER decision: left out. */
  leftOut: number;
  /** Answers older than the MINTER decisions read: not matched. */
  unmatched: number;
  /** Where the next step starts. */
  nextOffset: number;
  /** Core has no older answers. */
  done: boolean;
  /** The last step was stopped before its 5 pages. */
  stopped: boolean;
  /** MINTER decisions read to match them, and whether the ceiling stopped that read. */
  decisionsRead: number;
  decisionsCapped: boolean;
}

export function answersPath(address: string, offset: number): string {
  return `/transactions/search?${query({
    address,
    txType: 'GROUP_APPROVAL',
    confirmationStatus: 'CONFIRMED',
    limit: ANSWER_PAGE_SIZE,
    offset,
    reverse: true,
  })}`;
}

function toApprovalRow(tx: TxRow): ApprovalRow | null {
  if (!tx || tx.type !== 'GROUP_APPROVAL' || typeof tx.pendingSignature !== 'string') return null;
  if (typeof tx.approval !== 'boolean') return null;
  return {
    signature: tx.signature,
    pendingSignature: tx.pendingSignature,
    approval: tx.approval,
    height: typeof tx.blockHeight === 'number' ? tx.blockHeight : null,
    timestamp: tx.timestamp,
  };
}

/**
 * Each answer joined to the decision it answers. One not found is left out
 * when the decisions read reach a window before it (or are complete), and
 * counted as unmatched otherwise. Pure.
 */
export function joinAnswers(
  approvals: readonly ApprovalRow[],
  index: Pick<DecisionIndex, 'bySignature' | 'oldestHeight' | 'done'>,
  waiting: readonly DecisionRef[],
  maximumBlockDelay: number
): Pick<AnswersRead, 'answers' | 'leftOut' | 'unmatched'> {
  const queue = new Map(waiting.map((d) => [d.signature, d]));
  const answers: Answer[] = [];
  let leftOut = 0;
  let unmatched = 0;
  for (const row of approvals) {
    const decision = index.bySignature.get(row.pendingSignature) ?? queue.get(row.pendingSignature);
    if (decision) {
      answers.push({ ...row, decision });
      continue;
    }
    const covered =
      index.done ||
      (row.height !== null &&
        index.oldestHeight !== null &&
        index.oldestHeight <= row.height - maximumBlockDelay - 1);
    if (covered) leftOut += 1;
    else unmatched += 1;
  }
  return { answers, leftOut, unmatched };
}

// Stop requests and progress, per account (a step can outlive the view that started it).
const stops = new Set<string>();
export interface AnswersProgress {
  /** The page being read in this step (1–5). */
  page: number;
  of: number;
}
const progress = new Map<string, AnswersProgress>();
const listeners = new Set<() => void>();

function setProgress(address: string, value: AnswersProgress | null): void {
  if (value) progress.set(address, value);
  else progress.delete(address);
  for (const listener of [...listeners]) listener();
}

/** Ask a running step to stop after the page it is reading. */
export function stopAnswers(address: string): void {
  stops.add(address);
}

export function answersProgress(address: string): AnswersProgress | null {
  return progress.get(address) ?? null;
}

export function subscribeAnswersProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function readStep(address: string, previous: AnswersRead | undefined): Promise<AnswersRead> {
  const approvals = [...(previous?.approvals ?? [])];
  const seen = new Set(approvals.map((row) => row.signature));
  let offset = previous?.nextOffset ?? 0;
  let done = false;
  let stopped = false;
  try {
    for (let page = 0; page < ANSWER_STEP_PAGES; page++) {
      if (stops.has(address)) {
        stopped = true;
        break;
      }
      setProgress(address, { page: page + 1, of: ANSWER_STEP_PAGES });
      const body = await getJson<unknown>(answersPath(address, offset));
      const rows = (Array.isArray(body) ? body : []) as TxRow[];
      offset += rows.length;
      for (const tx of rows) {
        const row = toApprovalRow(tx);
        if (row && !seen.has(row.signature)) {
          seen.add(row.signature);
          approvals.push(row);
        }
      }
      if (rows.length < ANSWER_PAGE_SIZE) {
        done = true;
        break;
      }
    }
  } finally {
    stops.delete(address);
    setProgress(address, null);
  }
  const [group, waiting] = await Promise.all([getGroupInfo(), waitingDecisions()]);
  const heights = approvals.map((row) => row.height).filter((h): h is number => h !== null);
  // A decision collects answers for maximumBlockDelay blocks after its own.
  const reach = heights.length ? Math.min(...heights) - group.maximumBlockDelay - 1 : null;
  const index = await minterDecisionsTo(reach);
  return {
    approvals,
    ...joinAnswers(approvals, index, waiting, group.maximumBlockDelay),
    nextOffset: offset,
    done,
    stopped,
    decisionsRead: index.bySignature.size,
    decisionsCapped: index.capped,
  };
}

/**
 * The first step of a Minter Admin's answers (5 pages), or with `more` the
 * next 5 after what is in the store. Waits for the heavy-read slot of the
 * account (`address` is the scope the account page drops when it leaves).
 */
export function loadAnswers(
  address: string,
  options: { more?: boolean; force?: boolean } = {}
): Promise<AnswersRead> {
  const key = `xanswers:${address}`;
  const previous = options.more ? peekQuery<AnswersRead>(key) : undefined;
  return heavyQuery(address, key, () => readStep(address, previous), {
    ttlMs: 5 * 60_000,
    force: options.force || options.more,
  });
}
