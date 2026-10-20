/**
 * Hooks for the comments section: whether it is near the screen, and its
 * count ("Comments (3)") from the shared count search, or from its own
 * keys' search when that list can't tell (only once it is near the screen).
 * A Minter Admin's count adds the comments for the Minter Admins only, the
 * same way (their own shared list, data/adminNotes.ts); nobody else reads it.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ADMIN_COMMENTS_INDEX_KEY,
  adminIndexCovers,
  loadAdminCommentIndex,
  loadAdminCommentRows,
} from '../../data/adminNotes';
import {
  indexCovers,
  loadCommentIndex,
  loadCommentRows,
  type CommentIndex,
} from '../../data/comments';
import {
  commentRowsFor,
  targetId,
  targetSince,
  type CommentRow,
  type CommentTarget,
} from '../../data/commentThread';
import { useQuery } from '../../hooks/useQuery';
import { useViewerIsAdmin } from '../../hooks/useViewerIsAdmin';
import { useOptimisticComments } from '../../state/comments';

/** True once `node` comes within 200 px of the screen (and stays true). */
export function useInView(node: Element | null): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!node || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, seen]);
  return seen;
}

/**
 * The same target object for as long as it names the same keys, so callers
 * can build one on every render (React's adjust-while-rendering pattern).
 */
export function useStableTarget(target: CommentTarget): CommentTarget {
  const [stable, setStable] = useState(target);
  const same = stable.postKey === target.postKey && targetId(stable) === targetId(target);
  if (!same) setStable(target);
  return same ? stable : target;
}

/** The shared count list is read again this often while a count shows (paused while hidden). */
const INDEX_REFRESH_MS = 3 * 60_000;

export function useCommentIndex() {
  return useQuery<CommentIndex>('comments:index', (force) => loadCommentIndex({ force }), {
    refreshMs: INDEX_REFRESH_MS,
  });
}

/**
 * A Minter Admin's comments for the Minter Admins on `target`: from their
 * shared list when it covers the target, else its own keys' search (near the
 * screen, or open). Null while unknown; undefined when not read (`enabled`
 * false, or the list failed: the count then leaves them out).
 */
function useAdminCommentRows(
  target: CommentTarget,
  { nearScreen, open, enabled }: { nearScreen: boolean; open: boolean; enabled: boolean }
): CommentRow[] | null | undefined {
  const index = useQuery(
    enabled ? ADMIN_COMMENTS_INDEX_KEY : null,
    (force) => loadAdminCommentIndex({ force }),
    { refreshMs: INDEX_REFRESH_MS }
  );
  const covered = index.data ? adminIndexCovers(index.data, targetSince(target)) : false;
  const settled = Boolean(index.data) || index.isError;
  const useOwn = enabled && (open || (nearScreen && settled && !covered));
  const own = useQuery(useOwn ? `macomments:rows:${targetId(target)}` : null, (force) =>
    loadAdminCommentRows(target, { force })
  );
  return useMemo(() => {
    if (!enabled) return undefined;
    if (useOwn && own.data) return own.data.rows;
    if (covered && index.data) return commentRowsFor(target, index.data.rows, { adminOnly: true });
    if (useOwn ? own.isError : index.isError) return undefined;
    return null;
  }, [enabled, useOwn, own.data, own.isError, covered, index.data, index.isError, target]);
}

/**
 * The number of comments on `target`, or null while unknown. `nearScreen`
 * allows the target's own search; `open` prefers it (the thread reads it anyway).
 * For a Minter Admin it counts the comments for the Minter Admins too.
 */
export function useCommentCount(
  target: CommentTarget,
  { nearScreen, open }: { nearScreen: boolean; open: boolean }
): number | null {
  const index = useCommentIndex();
  const covered = index.data ? indexCovers(index.data, target) : false;
  const indexSettled = Boolean(index.data) || index.isError;
  const useOwn = open || (nearScreen && indexSettled && !covered);
  const own = useQuery(useOwn ? `comments:rows:${targetId(target)}` : null, (force) =>
    loadCommentRows(target, { force })
  );
  const isAdmin = useViewerIsAdmin();
  const adminRows = useAdminCommentRows(target, { nearScreen, open, enabled: isAdmin });
  const keys = useMemo(() => target.keys.map((k) => k.key), [target]);
  const optimistic = useOptimisticComments(keys);
  return useMemo(() => {
    const rows =
      useOwn && own.data
        ? own.data.rows
        : covered && index.data
          ? commentRowsFor(target, index.data.rows)
          : null;
    // A Minter Admin's count waits for both, so it doesn't jump.
    if (!rows || adminRows === null) return null;
    const all = adminRows ? [...rows, ...adminRows] : rows;
    const listed = new Set(all.map((r) => r.ref));
    return (
      all.length +
      optimistic.comments.filter((o) => !listed.has(o.ref) && (isAdmin || !o.adminOnly)).length
    );
  }, [useOwn, own.data, covered, index.data, target, adminRows, isAdmin, optimistic.comments]);
}
