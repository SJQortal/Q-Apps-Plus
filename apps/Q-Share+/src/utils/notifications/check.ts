/**
 * One notification check: new comments on your shares and replies to your
 * comments, and your shares added to someone's collection. Reads only.
 *
 * Comments: one search for Q-Share comments first published since the last
 * check (Core's `after`), matched against your shares and comments by the
 * keys in their identifiers. That covers comments written in the original
 * Q-Share too. Collections: one search for collections whose QDN description
 * carries your account's recipient marker (utils/recipientMarker.ts); only a
 * collection with a version not read before is fetched.
 *
 * The first check looks back a week and files what it finds as read, so a new
 * install starts with a history but no pile of unread items.
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

async function run(account: CheckAccount, options: CheckOptions): Promise<number> {
  const now = options.now ?? Date.now();
  const before = readNotifications(account.address);
  const first = before.lastCheck === 0;
  const mine = new Set(account.names.map(lower));
  const hidden = new Set(options.hiddenNames.map(lower));
  const seen = new Set(before.seen);
  const versions = { ...before.collectionVersions };
  const found: AppNotification[] = [];
  let commentsCheckedTo = before.commentsCheckedTo;

  if (options.comments || options.collections) {
    const activity = await loadActivity(account.names, now);

    if (options.comments) {
      const after = first ? now - FIRST_LOOK_BACK_MS : Math.max(0, before.commentsCheckedTo - COMMENT_SLACK_MS);
      for (let page = 0; page < COMMENT_MAX_PAGES; page++) {
        const rows = await searchQdn(
          {
            service: "BLOG_COMMENT",
            identifier: QSHARE_COMMENT_BASE,
            prefix: true,
            after,
            limit: COMMENT_PAGE,
            offset: page * COMMENT_PAGE,
          },
          { fresh: true }
        );
        for (const row of rows) {
          const id = `c:${row.name}/${row.identifier}`;
          if (seen.has(id) || mine.has(lower(row.name)) || hidden.has(lower(row.name))) continue;
          const item = commentNotification(row, activity, first, now);
          if (!item) continue;
          seen.add(id);
          found.push(item);
        }
        if (rows.length < COMMENT_PAGE) break;
      }
      commentsCheckedTo = now;
    }

    if (options.collections) {
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
            read: first,
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
    }
  }

  // Merge with the state as it is now: the list may have been marked read meanwhile.
  const current = readNotifications(account.address);
  const known = new Set(current.items.map((i) => i.id));
  writeNotifications(account.address, {
    items: [...found.filter((i) => !known.has(i.id)), ...current.items],
    commentsCheckedTo: Math.max(commentsCheckedTo, current.commentsCheckedTo),
    seen: [...new Set([...current.seen, ...seen])],
    collectionVersions: { ...current.collectionVersions, ...versions },
    lastCheck: now,
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
  const request = run(account, options);
  inflight.set(account.address, request);
  const forget = () => {
    if (inflight.get(account.address) === request) inflight.delete(account.address);
  };
  request.then(forget, forget);
  return request;
}
