/**
 * Comment threads, pure (data/comments.ts reads, components/comments shows):
 *
 * - which keys belong to a decision or a nomination (a nomination's comments
 *   from before its first signature stay with it once Minter Admins sign);
 * - which QDN search rows are its comments;
 * - which Minter Admin hides count (the newest valid one per comment);
 * - the threads a viewer sees: newest first, replies one level deep (oldest
 *   first), deleted comments as "Deleted" in their place, hidden and muted
 *   ones collapsed, and the viewer's own just-published ones straight away.
 */
import type { Decision } from '../rules/decision';
import type { NominationState } from '../rules/nomination';
import {
  commentRef,
  decisionCommentKey,
  nominationCommentKey,
  parseCommentIdentifier,
  type CommentKeyKind,
  type CommentRecord,
  type HideRecord,
} from './commentRecords';
import type { QdnRow, TxRow } from './types';

/** Allowance for clock differences between a transaction and a QDN row. */
export const ROUND_SLACK_MS = 10 * 60_000;
/**
 * Comments under a nominee's address count for a nomination from this long
 * before it was last published (a republish restarts its waiting window), and
 * never from before an earlier round's invite.
 */
export const ADDRESS_LOOKBACK_MS = 30 * 86_400_000;

export interface CommentKeySpan {
  key: string;
  /** Comments under this key posted before this time (ms) belong to something earlier. */
  since: number | null;
}

export interface CommentTarget {
  /** Where new comments go. */
  postKey: string;
  /** Every key whose comments belong here. */
  keys: CommentKeySpan[];
}

/** A target from a key kind and a decision's signature or a nominee's address. */
export function commentTarget(
  kind: CommentKeyKind,
  value: string,
  since: number | null = null
): CommentTarget {
  const key = kind === 'decision' ? decisionCommentKey(value) : nominationCommentKey(value);
  return { postKey: key, keys: [{ key, since }] };
}

/** One stable string per target (store keys). */
export function targetId(target: CommentTarget): string {
  return target.keys.map((k) => `${k.key}@${k.since ?? ''}`).join('+');
}

/** What a nomination needs here (data/nominations.ts → Nomination). */
export interface NominationForComments {
  nominee: string;
  state: NominationState;
  publishedAt: number;
  nomination: { publishedAt: number } | null;
  decision: Pick<Decision, 'signature' | 'createdAt'> | null;
  latestInvite: Pick<TxRow, 'signature' | 'timestamp'> | null;
}

const DECIDED: ReadonlySet<NominationState> = new Set([
  'approved',
  'joined',
  'expired',
  'rejected',
]);

/** The nominee's address span: this round's comments from before its first signature. */
function addressSpan(
  n: NominationForComments,
  invite: { timestamp: number } | null
): CommentKeySpan {
  const published = n.nomination?.publishedAt ?? n.publishedAt;
  const earlierInvite =
    n.latestInvite && (!invite || n.latestInvite.timestamp < invite.timestamp - ROUND_SLACK_MS)
      ? n.latestInvite.timestamp
      : null;
  return {
    key: nominationCommentKey(n.nominee),
    since: Math.max(published - ADDRESS_LOOKBACK_MS, earlierInvite ?? Number.NEGATIVE_INFINITY),
  };
}

/**
 * A nomination's comments: under its decision once a Minter Admin signed
 * (or under the invite that decided it), with the ones from before.
 */
export function nominationCommentTarget(n: NominationForComments): CommentTarget {
  const hasRecord = Boolean(n.nomination);
  const invite = n.decision
    ? { signature: n.decision.signature, timestamp: n.decision.createdAt }
    : n.latestInvite && DECIDED.has(n.state)
      ? n.latestInvite
      : null;
  if (!invite) {
    const span = addressSpan(n, null);
    return { postKey: span.key, keys: [span] };
  }
  const key = decisionCommentKey(invite.signature);
  const keys: CommentKeySpan[] = [{ key, since: invite.timestamp - ROUND_SLACK_MS }];
  if (hasRecord) keys.push(addressSpan(n, invite));
  return { postKey: key, keys };
}

/** A decision's comments; an invite's include its nomination's from before the first signature. */
export function decisionCommentTarget(
  d: Pick<Decision, 'signature' | 'kind' | 'subject' | 'createdAt'>,
  nomination?: NominationForComments | null
): CommentTarget {
  const key = decisionCommentKey(d.signature);
  const keys: CommentKeySpan[] = [{ key, since: d.createdAt - ROUND_SLACK_MS }];
  if (d.kind === 'invite' && nomination?.nomination && nomination.nominee === d.subject) {
    keys.push(addressSpan(nomination, { timestamp: d.createdAt }));
  }
  return { postKey: key, keys };
}

/** The earliest time any of the target's comments can have (null: any time). */
export function targetSince(target: CommentTarget): number | null {
  let earliest = Number.POSITIVE_INFINITY;
  for (const span of target.keys) {
    if (span.since === null) return null;
    earliest = Math.min(earliest, span.since);
  }
  return Number.isFinite(earliest) ? earliest : null;
}

export interface CommentRow {
  ref: string;
  name: string;
  identifier: string;
  key: string;
  /** When it was first published (the QDN row's `created`, ms). */
  postedAt: number;
  /** Its newest version (ms). */
  updatedAt: number;
  /** What the body cache is keyed by: the latest signature, or the newest time. */
  version: string | number;
}

/** The search rows that are this target's comments, each once, newest first. */
export function commentRowsFor(target: CommentTarget, rows: readonly QdnRow[]): CommentRow[] {
  const spans = new Map(target.keys.map((span) => [span.key, span]));
  const byRef = new Map<string, CommentRow>();
  for (const row of rows) {
    const parsed = parseCommentIdentifier(row.identifier);
    const span = parsed ? spans.get(parsed.key) : undefined;
    if (!parsed || !span || typeof row.name !== 'string' || !row.name) continue;
    if (span.since !== null && row.created < span.since) continue;
    const updatedAt = row.updated ?? row.created;
    const ref = commentRef(row.name, row.identifier);
    const existing = byRef.get(ref);
    if (existing && existing.updatedAt >= updatedAt) continue;
    byRef.set(ref, {
      ref,
      name: row.name,
      identifier: row.identifier,
      key: parsed.key,
      postedAt: row.created,
      updatedAt,
      version: row.latestSignature ?? updatedAt,
    });
  }
  return [...byRef.values()].sort(
    (a, b) => b.postedAt - a.postedAt || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)
  );
}

export type CommentBody =
  /** `from`: shown from that Minter Admin's copy (a poll's share), not read directly. */
  | { status: 'ok'; record: CommentRecord; from?: string }
  /** Couldn't be read from QDN; `fetching` while the node still asks its peers. */
  | { status: 'unavailable'; fetching?: boolean }
  /** Not a valid comment: never shown. */
  | { status: 'invalid' };

/**
 * The rows to read next for replies whose comment isn't read yet: for each
 * missing identifier, the first one published with it.
 */
export function missingParents(
  rows: readonly CommentRow[],
  bodies: ReadonlyMap<string, CommentBody>
): CommentRow[] {
  const wanted = new Set<string>();
  for (const body of bodies.values()) {
    if (body.status === 'ok' && body.record.replyTo) wanted.add(body.record.replyTo);
  }
  const first = new Map<string, CommentRow>();
  for (const row of rows) {
    if (!wanted.has(row.identifier)) continue;
    const current = first.get(row.identifier);
    if (!current || row.postedAt < current.postedAt) first.set(row.identifier, row);
  }
  return [...first.values()].filter((row) => !bodies.has(row.ref));
}

export interface HideRow {
  /** Who published the hide record. */
  name: string;
  updatedAt: number;
  record: HideRecord;
}

/**
 * Which comments are hidden: per comment, the newest hide record whose
 * publisher `isAdminName` accepts. Ties go to hidden.
 */
export function resolveHides(
  rows: readonly HideRow[],
  isAdminName: (name: string) => boolean
): Map<string, boolean> {
  const newest = new Map<string, { at: number; hidden: boolean }>();
  for (const row of rows) {
    if (!isAdminName(row.name)) continue;
    const ref = commentRef(row.record.commentName, row.record.commentIdentifier);
    const current = newest.get(ref);
    if (
      !current ||
      row.updatedAt > current.at ||
      (row.updatedAt === current.at && row.record.hidden)
    ) {
      newest.set(ref, { at: row.updatedAt, hidden: row.record.hidden });
    }
  }
  return new Map([...newest].map(([ref, v]) => [ref, v.hidden]));
}

/** A comment the viewer just published (or edited, or deleted), until QDN shows it. */
export interface OptimisticComment {
  ref: string;
  name: string;
  identifier: string;
  key: string;
  record: CommentRecord;
  at: number;
}

export interface CommentView {
  ref: string;
  name: string;
  identifier: string;
  key: string;
  postedAt: number;
  /** When it was last edited (ms), or null. */
  editedAt: number | null;
  /** 'unavailable': its row is listed but its body couldn't be read. */
  status: 'shown' | 'unavailable';
  /** Unavailable for now: the node is still fetching it from peers. */
  fetching: boolean;
  text: string;
  deleted: boolean;
  edited: boolean;
  replyTo: string | null;
  /** For a reply to a reply: whose comment it answers (threads are one level deep). */
  replyToName: string | null;
  hidden: boolean;
  muted: boolean;
  /** Published from here, not on QDN yet (or this version isn't). */
  pending: boolean;
  /** Shown from this Minter Admin's copy (a poll's share): the viewer can't read it directly. */
  from?: string;
}

export interface CommentThread {
  comment: CommentView;
  replies: CommentView[];
}

export function sameComment(a: CommentRecord, b: CommentRecord): boolean {
  return (
    a.text === b.text &&
    Boolean(a.deleted) === Boolean(b.deleted) &&
    (a.replyTo ?? null) === (b.replyTo ?? null)
  );
}

export interface BuildThreadsInput {
  /** The rows whose bodies were read (a page of them, plus the comments their replies answer). */
  rows: readonly CommentRow[];
  bodies: ReadonlyMap<string, CommentBody>;
  hides: ReadonlyMap<string, boolean>;
  muted: ReadonlySet<string>;
  /** Only those whose key belongs to the target. */
  optimistic?: readonly OptimisticComment[];
  optimisticHides?: ReadonlyMap<string, boolean>;
}

const MAX_DEPTH = 20;

export function buildThreads(input: BuildThreadsInput): CommentThread[] {
  const pending = new Map((input.optimistic ?? []).map((o) => [o.ref, o]));
  const views: CommentView[] = [];
  const view = (
    base: Pick<CommentView, 'ref' | 'name' | 'identifier' | 'key' | 'postedAt'>,
    record: CommentRecord | null,
    extra: { editedAt: number | null; pending: boolean; fetching?: boolean; from?: string }
  ): CommentView => ({
    ...base,
    editedAt: extra.editedAt,
    status: record ? 'shown' : 'unavailable',
    fetching: !record && Boolean(extra.fetching),
    text: record?.deleted ? '' : (record?.text ?? ''),
    deleted: Boolean(record?.deleted),
    edited: Boolean(record?.edited) && !record?.deleted,
    replyTo: record?.replyTo ?? null,
    replyToName: null,
    hidden: input.optimisticHides?.get(base.ref) ?? input.hides.get(base.ref) ?? false,
    muted: input.muted.has(base.name),
    pending: extra.pending,
    ...(extra.from && !extra.pending ? { from: extra.from } : {}),
  });

  const listed = new Set<string>();
  for (const row of input.rows) {
    const body = input.bodies.get(row.ref);
    if (!body || body.status === 'invalid' || listed.has(row.ref)) continue;
    listed.add(row.ref);
    const loaded = body.status === 'ok' ? body.record : null;
    const mine = pending.get(row.ref);
    const newer = mine && (!loaded || !sameComment(mine.record, loaded)) ? mine : null;
    const record = newer?.record ?? loaded;
    views.push(
      view(row, record, {
        editedAt: newer ? newer.at : row.updatedAt > row.postedAt + 60_000 ? row.updatedAt : null,
        pending: Boolean(newer),
        fetching: body.status === 'unavailable' && body.fetching,
        from: body.status === 'ok' ? body.from : undefined,
      })
    );
  }
  for (const mine of pending.values()) {
    if (listed.has(mine.ref)) continue;
    views.push(
      view({ ...mine, postedAt: mine.at }, mine.record, { editedAt: null, pending: true })
    );
  }

  // A reply goes under the first comment published with the identifier it answers.
  const byIdentifier = new Map<string, CommentView>();
  for (const v of views) {
    const current = byIdentifier.get(v.identifier);
    if (!current || v.postedAt < current.postedAt) byIdentifier.set(v.identifier, v);
  }
  const rootOf = (v: CommentView): CommentView | null => {
    const first = v.replyTo ? byIdentifier.get(v.replyTo) : undefined;
    if (!first || first === v) return null;
    let parent: CommentView = first;
    const seen = new Set<CommentView>([v]);
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      seen.add(parent);
      const next: CommentView | undefined = parent.replyTo
        ? byIdentifier.get(parent.replyTo)
        : undefined;
      if (!next || seen.has(next)) return parent;
      parent = next;
    }
    return parent;
  };

  const threads = new Map<CommentView, CommentView[]>();
  const replies: Array<[CommentView, CommentView]> = [];
  for (const v of views) {
    const root = rootOf(v);
    if (root) replies.push([root, v]);
    else threads.set(v, []);
  }
  for (const [root, reply] of replies) {
    const list = threads.get(root);
    if (!list) {
      // Its root is itself in a loop of replies: show it on its own.
      threads.set(reply, []);
      continue;
    }
    const direct = reply.replyTo ? byIdentifier.get(reply.replyTo) : undefined;
    list.push(direct && direct !== root ? { ...reply, replyToName: direct.name } : reply);
  }
  return [...threads]
    .map(([comment, list]) => ({
      comment,
      replies: list.sort((a, b) => a.postedAt - b.postedAt),
    }))
    .sort((a, b) => b.comment.postedAt - a.comment.postedAt);
}
