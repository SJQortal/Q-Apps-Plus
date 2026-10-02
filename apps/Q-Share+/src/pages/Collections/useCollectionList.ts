import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { QDN_PAGE } from "../../utils/qdnSearch";
import { type CollectionSummary, collectionKey, fetchCollection, searchCollections } from "../../utils/collections";
import { upsertCollection } from "../../state/features/collectionsSlice";
import { queue } from "../../wrappers/GlobalWrapper";
import type { RootState } from "../../state/store";

function mergeRows(prev: CollectionSummary[], page: CollectionSummary[]): CollectionSummary[] {
  const seen = new Set(prev.map((row) => collectionKey(row.name, row.identifier)));
  return [...prev, ...page.filter((row) => !seen.has(collectionKey(row.name, row.identifier)))];
}

/**
 * One paged collection search (a name's, or everyone's), plus the bodies of
 * the rows it returned, fetched through the app's request queue and kept in
 * the collections slice. No search is made per row.
 */
export function useCollectionList(name: string | undefined) {
  const dispatch = useDispatch();
  const byKey = useSelector((state: RootState) => state.collections.byKey);
  const [rows, setRows] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [complete, setComplete] = useState(false);
  const [listName, setListName] = useState(name);
  const requestRef = useRef(0);

  // A different name is a different list: reset while rendering, then the effect fetches.
  if (listName !== name) {
    setListName(name);
    setRows([]);
    setLoading(true);
    setError(false);
    setComplete(false);
  }

  // State changes happen in the promise callbacks, so the effect only starts the search.
  const fetchPage = useCallback(
    (offset: number, fresh: boolean): Promise<void> => {
      const id = ++requestRef.current;
      return searchCollections({ name, offset, limit: QDN_PAGE, fresh }).then(
        (page) => {
          if (id !== requestRef.current) return;
          setRows((prev) => (offset === 0 ? page : mergeRows(prev, page)));
          setComplete(page.length < QDN_PAGE);
          if (offset === 0) setLoading(false);
        },
        () => {
          if (id !== requestRef.current) return;
          if (offset === 0) {
            setError(true);
            setLoading(false);
          }
        }
      );
    },
    [name]
  );

  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  // Fetch each row's body once, and again when the search says it was republished.
  const requested = useRef(new Map<string, number>());
  useEffect(() => {
    for (const row of rows) {
      const key = collectionKey(row.name, row.identifier);
      const stamp = row.updated ?? 0;
      const known = byKey[key];
      const stale = Boolean(known && stamp > known.fetchedAt);
      if (known && !stale) continue;
      if (requested.current.get(key) === stamp) continue;
      requested.current.set(key, stamp);
      queue
        .push(() => fetchCollection(row.name, row.identifier, { fresh: stale }))
        .then((collection) => {
          if (collection) dispatch(upsertCollection(collection));
        })
        .catch(() => {
          /* the card shows without a count */
        });
    }
  }, [rows, byKey, dispatch]);

  const loadMore = useCallback(async () => {
    if (loading || complete || error) return;
    await fetchPage(rows.length, false);
  }, [loading, complete, error, fetchPage, rows.length]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    return fetchPage(0, true);
  }, [fetchPage]);

  return { rows, loading, error, complete, loadMore, reload };
}
