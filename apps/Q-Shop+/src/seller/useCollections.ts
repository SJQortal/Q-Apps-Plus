/**
 * The seller's collections (qdn/collections.ts) on the seller page: read
 * fresh by the document's exact id (also when the product list doesn't
 * point at it, say after "Recreate shop data"), edited as a working copy
 * (new, edit, move, remove), then published together: the document, and the
 * product list with its pointer when it doesn't point at it yet. That list
 * publish follows the rules of every product-list publish
 * (seller/freshIndex.ts): a change from another device is shown first and
 * nothing goes out; right after this tab's own publish it waits a minute.
 * Products the shop no longer lists are left out when publishing.
 *
 * Collections made on another device must never be overwritten unseen: a
 * document that exists but can't be read yet is "unavailable" (no editing),
 * and the document is read again before publishing; if it changed since the
 * page loaded, the page shows it as it is now and nothing is published.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import { setDataContainer } from "../state/features/globalSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { collectionsIdentifier, dataContainerIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import {
  buildCollectionsPublish,
  collectionsPointer,
  normalizeCollections,
  pruneCollections,
  type ShopCollection,
} from "../qdn/collections";
import type { DataContainerDoc, PublishResource } from "../qdn/payloads";
import { QdnDeletedError, QdnFetchError, fetchQdnJson, invalidateQdnJson, resourceExists } from "../qdn/search";
import { errorMessage } from "../qdn/hubErrors";
import { indexKey, notePublishedIndex } from "./productIndex";
import { INDEX_CHANGED_TEXT, PrepareError, indexOnQdn, useShowNewerIndex } from "./freshIndex";
import { DELETE_NODE_BEHIND_TEXT } from "./useDeleteProducts";

export type CollectionsLoad = "loading" | "ready" | "unavailable";

export interface CollectionsJob {
  resources: PublishResource[];
  labels: Record<string, string>;
  collections: ShopCollection[];
  /** The product list with its pointer, when this publish adds it. */
  dataContainer: DataContainerDoc | null;
  storeId: string;
  name: string;
  baseKey: string;
}

const NODE_BEHIND_TEXT = DELETE_NODE_BEHIND_TEXT.replace("nothing was deleted", "nothing was published");
export const COLLECTIONS_CHANGED_TEXT =
  "Your collections changed on QDN since this page loaded, perhaps from another device. They're shown as they are now: make your changes again.";
export const COLLECTIONS_UNREADABLE_TEXT =
  "Couldn't read your collections from your node, so nothing was published. Try again in a minute.";

/**
 * The collections as QDN serves them now: [] when there is no document (or
 * it was deleted); null when one exists but can't be read, or the node can't
 * be asked.
 */
async function readPublished(name: string, docId: string): Promise<ShopCollection[] | null> {
  try {
    return normalizeCollections(await fetchQdnJson<unknown>("DOCUMENT", name, docId, { fresh: true }));
  } catch (e) {
    if (e instanceof QdnDeletedError) return [];
    if (!(e instanceof QdnFetchError)) return null;
    const exists = await resourceExists("DOCUMENT", name, docId, { fresh: true }).catch(() => true);
    return exists ? null : [];
  }
}

const same = (a: ShopCollection[], b: ShopCollection[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What this session last published per collections document: the version it
 * replaced and the one it sent. Right after a publish the node may still
 * serve the one it replaced; that isn't a change from another device.
 */
const lastSent = new Map<string, { before: string; sent: string }>();

function isOwnPublishNotServedYet(docId: string, now: ShopCollection[], published: ShopCollection[]): boolean {
  const last = lastSent.get(docId);
  return !!last && last.before === JSON.stringify(now) && last.sent === JSON.stringify(published);
}

/** For tests. */
export function resetSentCollections(): void {
  lastSent.clear();
}

export function useCollections() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const showNewerIndex = useShowNewerIndex();
  const name = user?.name ?? "";
  const storeId = currentStore?.id ?? "";
  const docId = storeId ? collectionsIdentifier(shortStoreIdOf(storeId)) : "";

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; status: CollectionsLoad; published: ShopCollection[] } | null>(null);
  const [draft, setDraft] = useState<{ key: string; collections: ShopCollection[] } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<CollectionsJob | null>(null);
  const key = `${name}\n${docId}\n${attempt}`;

  useEffect(() => {
    if (!name || !docId) return;
    let alive = true;
    void readPublished(name, docId).then((read) => {
      if (alive) setLoaded({ key, status: read ? "ready" : "unavailable", published: read ?? [] });
    });
    return () => {
      alive = false;
    };
  }, [docId, key, name]);

  const status: CollectionsLoad = loaded?.key === key ? loaded.status : "loading";
  const published = useMemo(() => (loaded?.key === key ? loaded.published : []), [loaded, key]);
  const collections = draft?.key === key ? draft.collections : published;
  const dirty = draft?.key === key && !same(draft.collections, published);
  // The product list doesn't point at the document: publishing adds the pointer, even with nothing changed.
  const pointerMissing =
    status === "ready" && published.length > 0 && !!dataContainer && dataContainer.storeId === storeId && !collectionsPointer(dataContainer, storeId);

  const edit = useCallback(
    (next: (list: ShopCollection[]) => ShopCollection[]) => {
      setDraft({ key, collections: next(collections) });
      setError(null);
      setNotice(null);
    },
    [collections, key]
  );

  const save = useCallback((c: ShopCollection) => edit((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c])), [edit]);
  const remove = useCallback((id: string) => edit((list) => list.filter((x) => x.id !== id)), [edit]);
  const move = useCallback(
    (id: string, by: -1 | 1) =>
      edit((list) => {
        const at = list.findIndex((x) => x.id === id);
        const to = at + by;
        if (at < 0 || to < 0 || to >= list.length) return list;
        const next = [...list];
        [next[at], next[to]] = [next[to], next[at]];
        return next;
      }),
    [edit]
  );
  const discard = useCallback(() => {
    setDraft(null);
    setError(null);
    setNotice(null);
  }, []);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  /** Resolves true when the publish is ready to send (`job`). */
  const prepare = useCallback(async (): Promise<boolean> => {
    setError(null);
    setNotice(null);
    if (!name) {
      setError("Sign in with your Qortal name to publish collections.");
      return false;
    }
    if (!storeId || !dataContainer?.products || dataContainer.storeId !== storeId) {
      setError("Your shop's product list isn't loaded yet. Try again in a moment.");
      return false;
    }
    const seen = dataContainer as unknown as DataContainerDoc;
    const listed = (id: string) => !!seen.products[id];
    const toPublish = pruneCollections(collections, listed);
    const needsPointer = toPublish.length > 0 && !collectionsPointer(seen, storeId);
    setPreparing(true);
    try {
      // Never over another device's changes: the document must be what this page loaded.
      const now = await readPublished(name, docId);
      if (!now) throw new PrepareError(COLLECTIONS_UNREADABLE_TEXT);
      if (!same(now, published) && !isOwnPublishNotServedYet(docId, now, published)) {
        setLoaded({ key, status: "ready", published: now });
        setDraft(null);
        setNotice(COLLECTIONS_CHANGED_TEXT);
        return false;
      }
      if (needsPointer) {
        const state = await indexOnQdn(name, storeId, seen);
        if (state.kind === "newer") {
          await showNewerIndex(seen, state.merged, storeId, name);
          setNotice(INDEX_CHANGED_TEXT);
          return false;
        }
        if (state.kind === "behind") throw new PrepareError(NODE_BEHIND_TEXT);
      }
      const built = buildCollectionsPublish({ name, storeId, collections: toPublish, dataContainer: needsPointer ? seen : null });
      const labels: Record<string, string> = {
        [built.identifier]: toPublish.length === 1 ? "Collections · 1 collection" : `Collections · ${toPublish.length} collections`,
        [dataContainerIdentifier(storeId)]: "Product list (points at your collections)",
      };
      setJob({ resources: built.resources, labels, collections: toPublish, dataContainer: built.dataContainer, storeId, name, baseKey: indexKey(seen) });
      return true;
    } catch (e) {
      setError(e instanceof PrepareError ? e.message : errorMessage(e, "Couldn't prepare the publish. Try again."));
      return false;
    } finally {
      setPreparing(false);
    }
  }, [name, storeId, docId, key, dataContainer, collections, published, showNewerIndex]);

  /** Everything landed: the published copy is the new starting point. */
  const done = useCallback(() => {
    if (!job) return;
    const id = collectionsIdentifier(shortStoreIdOf(job.storeId));
    lastSent.set(id, { before: JSON.stringify(published), sent: JSON.stringify(job.collections) });
    invalidateQdnJson("DOCUMENT", job.name, id);
    if (job.dataContainer) {
      notePublishedIndex(job.storeId, job.baseKey, indexKey(job.dataContainer));
      dispatch(setDataContainer({ ...job.dataContainer, id: dataContainerIdentifier(job.storeId) }));
      invalidateQdnJson("DOCUMENT", job.name, dataContainerIdentifier(job.storeId));
    }
    setLoaded({ key, status: "ready", published: job.collections });
    setDraft(null);
    dispatch(setNotification({ msg: "Collections published", alertType: "success" }));
    setJob(null);
  }, [job, key, published, dispatch]);

  /** Closed before everything landed: the changes stay, so publishing again finishes it. */
  const closed = useCallback(
    (sent: string[]) => {
      if (job && sent.length > 0) {
        if (sent.includes(job.resources[0].identifier)) {
          lastSent.set(job.resources[0].identifier, { before: JSON.stringify(published), sent: JSON.stringify(job.collections) });
          setLoaded({ key, status: "ready", published: job.collections });
        }
        dispatch(setNotification({ msg: "Not everything was published. Publish again to finish.", alertType: "info" }));
      }
      setJob(null);
    },
    [job, key, published, dispatch]
  );

  return {
    status,
    collections,
    dirty,
    pointerMissing,
    save,
    remove,
    move,
    discard,
    reload,
    prepare,
    preparing,
    error,
    notice,
    job,
    done,
    closed,
  };
}
