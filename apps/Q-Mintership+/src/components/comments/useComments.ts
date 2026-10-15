/**
 * Hooks for the comments section: whether it is near the screen, and its
 * count ("Comments (3)") from the shared count search, or from its own
 * keys' search when that list can't tell (only once it is near the screen).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  indexCovers,
  loadCommentIndex,
  loadCommentRows,
  type CommentIndex,
} from '../../data/comments';
import { commentRowsFor, targetId, type CommentTarget } from '../../data/commentThread';
import { useQuery } from '../../hooks/useQuery';
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
 * The number of comments on `target`, or null while unknown. `nearScreen`
 * allows the target's own search; `open` prefers it (the thread reads it anyway).
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
  const keys = useMemo(() => target.keys.map((k) => k.key), [target]);
  const optimistic = useOptimisticComments(keys);
  return useMemo(() => {
    const rows =
      useOwn && own.data
        ? own.data.rows
        : covered && index.data
          ? commentRowsFor(target, index.data.rows)
          : null;
    if (!rows) return null;
    const listed = new Set(rows.map((r) => r.ref));
    return rows.length + optimistic.comments.filter((o) => !listed.has(o.ref)).length;
  }, [useOwn, own.data, covered, index.data, target, optimistic.comments]);
}
