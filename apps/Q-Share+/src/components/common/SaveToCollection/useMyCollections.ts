import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCollection, searchCollections } from "../../../utils/collections";
import { QDN_PAGE } from "../../../utils/qdnSearch";
import {
  setLoadingMine,
  setMine,
  setMineError,
  upsertCollection,
} from "../../../state/features/collectionsSlice";
import { queue } from "../../../wrappers/GlobalWrapper";
import type { RootState } from "../../../state/store";

let inflight: { name: string; promise: Promise<void> } | null = null;

/** Delay before the automatic first load, so it never competes with a list's first page. */
export const AUTO_LOAD_DELAY_MS = 1500;

/** Pages of 20 fetched for one name's collections; 100 collections is plenty for a picker. */
export const MY_COLLECTIONS_MAX_PAGES = 5;

async function searchAllMine(name: string, fresh: boolean) {
  const all: Awaited<ReturnType<typeof searchCollections>> = [];
  for (let page = 0; page < MY_COLLECTIONS_MAX_PAGES; page += 1) {
    const rows = await searchCollections({ name, fresh, offset: page * QDN_PAGE, limit: QDN_PAGE });
    all.push(...rows);
    if (rows.length < QDN_PAGE) break;
  }
  return all;
}

/**
 * The signed-in name's collections, loaded once per session into the slice
 * (one paged search, then each body through the request queue). Every
 * SaveToCollection button reads from here, so the list is shared.
 */
export function useMyCollections(autoLoad = true) {
  const dispatch = useDispatch();
  const myName = useSelector((state: RootState) => state.auth.user?.name);
  const { mine, mineName, loadingMine, mineError, byKey } = useSelector((state: RootState) => state.collections);

  const load = useCallback(
    (fresh = false): Promise<void> => {
      if (!myName) return Promise.resolve();
      if (inflight && inflight.name === myName && !fresh) return inflight.promise;
      const name = myName;
      const promise = (async () => {
        dispatch(setLoadingMine(name));
        try {
          const rows = await searchAllMine(name, fresh);
          dispatch(setMine({ name, rows }));
          await Promise.all(
            rows.map(async (row) => {
              try {
                const collection = await queue.push(() => fetchCollection(row.name, row.identifier, { fresh }));
                if (collection) dispatch(upsertCollection(collection));
              } catch {
                /* listed without a body until it can be read */
              }
            })
          );
        } catch {
          dispatch(setMineError(name));
        } finally {
          if (inflight && inflight.promise === promise) inflight = null;
        }
      })();
      inflight = { name, promise };
      return promise;
    },
    [dispatch, myName]
  );

  // The first load waits a moment so the page's own search and body fetches
  // go first; the bookmark buttons only need the list once someone looks.
  useEffect(() => {
    if (!autoLoad || !myName || loadingMine) return;
    if (mineName === myName && (mine !== null || mineError)) return;
    const timer = window.setTimeout(() => void load(), AUTO_LOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoLoad, myName, loadingMine, mineName, mine, mineError, load]);

  const current = mineName === myName;
  return {
    myName,
    mine: current ? mine : null,
    loading: loadingMine,
    error: current && mineError,
    byKey,
    reload: () => load(true),
  };
}

/** For tests. */
export function resetMyCollectionsLoader(): void {
  inflight = null;
}
