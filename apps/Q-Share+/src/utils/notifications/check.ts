/**
 * One notification check: new comments on your shares and replies to your
 * comments, and your shares added to someone's collection. Reads only.
 *
 * Comments: Q-Share comments first published since the last check (Core's
 * `after`), oldest first, matched against your shares and comments by the
 * keys in their identifiers. That covers comments written in the original
 * Q-Share too. The window only moves up to the node's last block, so comments
 * a syncing or offline node hasn't indexed yet are read once it has; when a
 * check stops at its page limit, the next one carries on from there.
 * Collections: one search for collections whose QDN description carries your
 * account's recipient marker (utils/recipientMarker.ts); only a collection
 * with a version not read before is fetched.
 *
 * The first check of each kind looks back a week (comments) or at what is
 * there (collections) and files it as read, so the list starts with a history
 * but no pile of unread items.
 */
import { QSHARE_COLLECTION_BASE, QSHARE_COMMENT_BASE } from "../../constants/Identifiers";
import { fetchCollection } from "../collections";
import { searchQdn, searchQdnAll, type QdnResourceSummary } from "../qdnSearch";
import { recipientMarker } from "../recipientMarker";
import { loadActivity, parseCommentIdentifier, shareCommentKey, type Activity } from "./activity";
import { readNotifications, writeNotifications, type AppNotification } from "./store";

export const COMMENT_PAGE = 50;
export const COMMENT_MAX_PAGES = 4;
/** A comment can reach this node a while after it was published: look back this much further each time. */
export const COMMENT_SLACK_MS = 30 * 60_000;
/** The first check looks back this far. */
export const FIRST_LOOK_BACK_MS = 7 * 24 * 60 * 60_000;
export const COLLECTION_PAGE = 50;
/** Core orders by first publish, so a re-published old collection can be on a later page. */
export const COLLECTION_MAX_PAGES = 2;
/** Collection bodies read per check at most; the rest wait for the next one. */
export const COLLECTION_FETCHES_PER_CHECK = 5;

export interface CheckAccount {
  address: string;
  /** Every name the account owns. */
  names: string[];
}

export interface CheckOptions {
  comments: boolean;
  collections: boolean;
  /** Settings → hidden names: nothing from them. */
  hiddenNames: string[];
  now?: number;
}

const lower = (name: string) => name.toLowerCase();

function commentNotification(
  row: QdnResourceSummary,
  activity: Activity,
  read: boolean,
  now: number
): AppNotification | null {
  const parsed = parseCommentIdentifier(row.identifier);
  if (!parsed) return null;
  const share = activity.shares.get(parsed.key);
  const toMyComment = parsed.parent ? activity.comments.get(parsed.parent) : undefined;
  if (!share && !toMyComment) return null;
  return {
    id: `c:${row.name}/${row.identifier}`,
    kind: toMyComment ? "reply" : "comment",
    actor: row.name,
    time: row.created ?? now,
    read,
    share: share ? { name: share.name, identifier: share.identifier, title: share.title || undefined } : undefined,
    comment: { name: row.name, identifier: row.identifier },
  };
}

/** The node's newest block time: comments up to it are indexed. Null when the node doesn't say. */
async function indexedUpTo(): Promise<number | null> {
  try {
    const response = await fetch("/blocks/last", { method: "GET" });
    if (!response.ok) return null;
    const block = (await response.json()) as { timestamp?: unknown };
    return typeof block?.timestamp === "number" ? block.timestamp : null;
  } catch {
    return null;
  }
}

async function run(account: CheckAccount, options: CheckOptions): Promise<number> {
  const now = options.now ?? Date.now();
  const before = readNotifications(account.address);
  const mine = new Set(account.names.map(lower));
  const hidden = new Set(options.hiddenNames.map(lower));
  const seen = new Set(before.seen);
  const versions = { ...before.collectionVersions };
  const found: AppNotification[] = [];
  let commentsCheckedTo = before.commentsCheckedTo;
  let collectionsCheckedAt = before.collectionsCheckedAt;

  if (options.comments || options.collections) {
    const activity = await loadActivity(account.names, now);

    if (options.comments) {
      const firstLook = before.commentsCheckedTo === 0;
      // At least 1: Core reads after=0 as no filter at all.
      const after = Math.max(1, firstLook ? now - FIRST_LOOK_BACK_MS : before.commentsCheckedTo - COMMENT_SLACK_MS);
      const indexedTo = await indexedUpTo();
      let lastRead = 0;
      let full = false;
      for (let page = 0; page < COMMENT_MAX_PAGES; page++) {
        const rows = await searchQdn(
          {
            service: "BLOG_COMMENT",
            identifier: QSHARE_COMMENT_BASE,
            prefix: true,
            after,
            reverse: false,
            limit: COMMENT_PAGE,
            offset: page * COMMENT_PAGE,
          },
          { fresh: true }
        );
        for (const row of rows) {
          lastRead = Math.max(lastRead, row.created ?? 0);
          const id = `c:${row.name}/${row.identifier}`;
          if (seen.has(id) || mine.has(lower(row.name)) || hidden.has(lower(row.name))) continue;
          const item = commentNotification(row, activity, firstLook, now);
          if (!item) continue;
          seen.add(id);
          found.push(item);
        }
        full = rows.length === COMMENT_PAGE;
        if (!full) break;
      }
      // The next check starts where this one could vouch for: after the last
      // comment read when the pages ran out, else up to the node's last block
      // (or the same window again when the node didn't say).
      const reached = full ? lastRead : Math.min(now, indexedTo ?? after + COMMENT_SLACK_MS);
      commentsCheckedTo = Math.max(reached + (full ? COMMENT_SLACK_MS : 0), before.commentsCheckedTo, 1);
    }

    if (options.collections) {
      const firstLook = before.collectionsCheckedAt === 0;
      // No `prefix`: Core applies it to every field, and the marker sits at the end of the description.
      const { rows } = await searchQdnAll(
        {
          service: "DOCUMENT",
          identifier: QSHARE_COLLECTION_BASE,
          description: recipientMarker(account.address),
          includemetadata: true,
        },
        { pageSize: COLLECTION_PAGE, maxPages: COLLECTION_MAX_PAGES, fresh: true }
      );
      let fetches = 0;
      for (const row of rows) {
        if (!row.identifier.startsWith(QSHARE_COLLECTION_BASE)) continue;
        if (mine.has(lower(row.name)) || hidden.has(lower(row.name))) continue;
        const key = `${row.name}/${row.identifier}`;
        const version = row.updated ?? row.created ?? 0;
        if ((versions[key] ?? -1) >= version) continue;
        if (fetches >= COLLECTION_FETCHES_PER_CHECK) break;
        fetches++;
        let collection;
        try {
          collection = await fetchCollection(row.name, row.identifier, { fresh: true });
        } catch {
          continue; // the node couldn't serve it: try again next time
        }
        versions[key] = version;
        for (const item of collection?.items ?? []) {
          if (!mine.has(lower(item.name))) continue;
          const id = `k:${key}/${item.name}/${item.identifier}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const own = activity.shares.get(shareCommentKey(item.identifier));
          found.push({
            id,
            kind: "collection",
            actor: row.name,
            time: version || now,
            read: firstLook,
            share: {
              name: item.name,
              identifier: item.identifier,
              title: own?.identifier === item.identifier ? own.title || undefined : undefined,
            },
            collection: {
              name: row.name,
              identifier: row.identifier,
              title: row.metadata?.title || collection?.title || undefined,
            },
          });
        }
      }
      collectionsCheckedAt = now;
    }
  }

  // Merge with the state as it is now: the list may have been marked read meanwhile.
  const current = readNotifications(account.address);
  const known = new Set(current.items.map((i) => i.id));
  writeNotifications(account.address, {
    items: [...found.filter((i) => !known.has(i.id)), ...current.items],
    commentsCheckedTo: Math.max(commentsCheckedTo, current.commentsCheckedTo),
    collectionsCheckedAt: Math.max(collectionsCheckedAt, current.collectionsCheckedAt),
    seen: [...new Set([...current.seen, ...seen])],
    collectionVersions: { ...current.collectionVersions, ...versions },
    lastCheck: now,
    lastError: 0,
  });
  return found.filter((i) => !i.read).length;
}

const inflight = new Map<string, Promise<number>>();

/**
 * Run a check for the account, or join the one already running. Resolves to
 * the number of new unread notifications; rejects when Core doesn't answer
 * (nothing is written then, so the next check covers the same time).
 */
export function checkNotifications(account: CheckAccount, options: CheckOptions): Promise<number> {
  const pending = inflight.get(account.address);
  if (pending) return pending;
  const request = run(account, options).catch((error: unknown) => {
    // Kept so the list can say the check failed instead of waiting forever.
    writeNotifications(account.address, {
      ...readNotifications(account.address),
      lastError: options.now ?? Date.now(),
    });
    throw error;
  });
  inflight.set(account.address, request);
  const forget = () => {
    if (inflight.get(account.address) === request) inflight.delete(account.address);
  };
  request.then(forget, forget);
  return request;
}
