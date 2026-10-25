/**
 * The seller's collections (qdn/collections.ts) on the seller page: read
 * fresh by the document's exact id (also when the product list doesn't
 * point at it, say after "Recreate shop data"), edited as a working copy
 * (new, edit, move, remove), then published together: the document, and the
 * product list with its pointer when it doesn't point at it yet.
 *
 * - The working copy lives for the session per name and document
 *   (switching tabs or leaving the seller page keeps it), and can't change
 *   while a publish is being prepared or sent.
 * - Before publishing, the product list is read fresh like before every
 *   list write (seller/freshIndex.ts): a change from another device is shown
 *   first and nothing goes out. Only then are products the shop no longer
 *   lists left out of the collections, so a product another device just
 *   added (and put in a collection) is never dropped.
 * - Collections made on another device are never overwritten unseen: a
 *   document that exists but can't be read yet is "unavailable" (no
 *   editing), and the document is read again before publishing; if it
 *   changed since the page loaded (and isn't one of this session's own
 *   versions the node hasn't caught up with), the page shows it as it is
 *   now and nothing is published.
 * - A publish that adds the pointer writes the product list, so it takes
 *   the list lock (seller/listWrite.ts) like every list write.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createDeviceDraftStore } from "./deviceDrafts";
import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import { setDataContainer } from "../state/features/globalSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { collectionsIdentifier, dataContainerIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import {
  buildCollectionsPublish,
  collectionsPointer,
  normalizeCollections,
  pruneCollections,
  type CollectionsDoc,
  type ShopCollection,
} from "../qdn/collections";
import type { DataContainerDoc, PublishResource } from "../qdn/payloads";
import { QdnDeletedError, QdnFetchError, fetchQdnJson, invalidateQdnJson, primeQdnJson, resourceExists } from "../qdn/search";
import { errorMessage } from "../qdn/hubErrors";
import { indexKey, notePublishedIndex } from "./productIndex";
import { INDEX_CHANGED_TEXT, INDEX_UNREADABLE_TEXT, PrepareError, indexOnQdn, useShowNewerIndex } from "./freshIndex";
import { LIST_BUSY_TEXT, LIST_CHANGED_TEXT, releaseListWrite, takeListWrite, useListWriteOwner } from "./listWrite";

export type CollectionsLoad = "loading" | "ready" | "unavailable";

export interface CollectionsJob {
  resources: PublishResource[];
  labels: Record<string, string>;
  doc: CollectionsDoc;
  /** What goes out: the working copy without products the shop no longer lists. */
  collections: ShopCollection[];
  /** The working copy it was built from. */
  working: ShopCollection[];
  /** The product list with its pointer, when this publish adds it. */
  dataContainer: DataContainerDoc | null;
  storeId: string;
  name: string;
  baseKey: string;
}

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

const json = (list: ShopCollection[]) => JSON.stringify(list);
const same = (a: ShopCollection[], b: ShopCollection[]) => json(a) === json(b);

/**
 * What this session published per collections document: every version its
 * publishes replaced, and the one it sent last. Right after a publish the
 * node may still serve a version from before it (even several publishes
 * back); that isn't a change from another device.
 */
const sentChain = new Map<string, { replaced: Set<string>; latest: string }>();

function noteSent(docId: string, before: ShopCollection[], sent: ShopCollection[]): void {
  const previous = sentChain.get(docId);
  const entry = previous ?? { replaced: new Set<string>(), latest: json(sent) };
  if (previous) entry.replaced.add(previous.latest);
  entry.replaced.add(json(before));
  entry.replaced.delete(json(sent));
  entry.latest = json(sent);
  sentChain.set(docId, entry);
}

function isOwnPublishNotServedYet(docId: string, now: ShopCollection[], published: ShopCollection[]): boolean {
  const entry = sentChain.get(docId);
  return !!entry && entry.latest === json(published) && entry.replaced.has(json(now));
}

/** The working copies, per name and document, kept on this device until published or discarded (seller/deviceDrafts.ts). */
export const collectionDrafts = createDeviceDraftStore<ShopCollection[]>("collections");

function setDraftFor(draftKey: string, list: ShopCollection[] | null): void {
  collectionDrafts.set(draftKey, list);
}

/** For tests (the drafts themselves: resetDeviceDrafts). */
export function resetSentCollections(): void {
  sentChain.clear();
}

export function useCollections() {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const lock = useListWriteOwner();
  const user = useSelector((state: RootState) => state.auth.user);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const showNewerIndex = useShowNewerIndex();
  const name = user?.name ?? "";
  const storeId = currentStore?.id ?? "";
  const docId = storeId ? collectionsIdentifier(shortStoreIdOf(storeId)) : "";
  const draftKey = `${name}\n${docId}`;

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; status: CollectionsLoad; published: ShopCollection[] } | null>(null);
  const draft = collectionDrafts.useDraft(draftKey);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<CollectionsJob | null>(null);
  const key = `${draftKey}\n${attempt}`;

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
  const collections = draft ?? published;
  const dirty = !!draft && !same(draft, published);
  // A publish is being prepared or sent: the working copy stays as it is until it ends.
  const busy = preparing || !!job;
  // The product list doesn't point at the document: publishing adds the pointer, even with nothing changed.
  const pointerMissing =
    status === "ready" && published.length > 0 && !!dataContainer && dataContainer.storeId === storeId && !collectionsPointer(dataContainer, storeId);

  const edit = useCallback(
    (next: (list: ShopCollection[]) => ShopCollection[]) => {
      if (busy) return;
      setDraftFor(draftKey, next(collections));
      setError(null);
      setNotice(null);
    },
    [busy, collections, draftKey]
  );

  const save = useCallback(
    (c: ShopCollection) => edit((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c])),
    [edit]
  );
  const remove = useCallback((id: string) => edit((list) => list.filter((x) => x.id !== id)), [edit]);
  /** Puts back a collection Remove took out, where it was. */
  const restore = useCallback(
    (c: ShopCollection, at: number) =>
      edit((list) => (list.some((x) => x.id === c.id) ? list : [...list.slice(0, at), c, ...list.slice(at)])),
    [edit]
  );
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
    if (busy) return;
    setDraftFor(draftKey, null);
    setError(null);
    setNotice(null);
  }, [busy, draftKey]);
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
    const working = collections;
    const needsPointer = working.length > 0 && !collectionsPointer(seen, storeId);
    if (needsPointer && !takeListWrite(lock)) {
      setError(LIST_BUSY_TEXT);
      return false;
    }
    let handedOver = false;
    setPreparing(true);
    try {
      // Never over another device's changes: the document must be what this page loaded.
      const now = await readPublished(name, docId);
      if (!now) throw new PrepareError(COLLECTIONS_UNREADABLE_TEXT);
      if (!same(now, published) && !isOwnPublishNotServedYet(docId, now, published)) {
        setLoaded({ key, status: "ready", published: now });
        setDraftFor(draftKey, null);
        setNotice(COLLECTIONS_CHANGED_TEXT);
        return false;
      }
      // The product list as QDN has it now, before anything is left out against it.
      const onQdn = await indexOnQdn(name, storeId, seen);
      if (onQdn.kind === "newer") {
        await showNewerIndex(seen, onQdn.merged, storeId, name);
        setNotice(INDEX_CHANGED_TEXT);
        return false;
      }
      if (onQdn.kind === "unknown") throw new PrepareError(INDEX_UNREADABLE_TEXT);
      // Same, or behind this tab's own last publish: the page's copy is the newest.
      if (store.getState().global.dataContainer !== dataContainer) throw new PrepareError(LIST_CHANGED_TEXT);
      const toPublish = pruneCollections(working, (id) => !!seen.products[id]);
      const built = buildCollectionsPublish({ name, storeId, collections: toPublish, dataContainer: needsPointer ? seen : null });
      const labels: Record<string, string> = {
        [built.identifier]: toPublish.length === 1 ? "Collections · 1 collection" : `Collections · ${toPublish.length} collections`,
        [dataContainerIdentifier(storeId)]: "Product list (points at your collections)",
      };
      setJob({
        resources: built.resources,
        labels,
        doc: built.doc,
        collections: toPublish,
        working,
        dataContainer: built.dataContainer,
        storeId,
        name,
        baseKey: indexKey(seen),
      });
      handedOver = true;
      return true;
    } catch (e) {
      setError(e instanceof PrepareError ? e.message : errorMessage(e, "Couldn't prepare the publish. Try again."));
      return false;
    } finally {
      setPreparing(false);
      if (needsPointer && !handedOver) releaseListWrite(lock);
    }
  }, [name, storeId, docId, key, draftKey, dataContainer, collections, published, showNewerIndex, lock, store]);

  /** The parts of `current` in `sent` landed: the page follows them. */
  const apply = useCallback(
    (current: CollectionsJob, sent: Set<string>) => {
      const id = collectionsIdentifier(shortStoreIdOf(current.storeId));
      if (sent.has(id)) {
        noteSent(id, published, current.collections);
        // Shop pages read it from here, not from a node that may still serve the version before.
        primeQdnJson("DOCUMENT", current.name, id, current.doc);
        setLoaded({ key, status: "ready", published: current.collections });
        // The working copy that went out is done; one changed since (it can't be, while busy) would stay.
        const left = collectionDrafts.get(draftKey);
        if (!left || same(left, current.working)) setDraftFor(draftKey, null);
      }
      const listId = dataContainerIdentifier(current.storeId);
      if (current.dataContainer && sent.has(listId)) {
        notePublishedIndex(current.storeId, current.baseKey, indexKey(current.dataContainer));
        dispatch(setDataContainer({ ...current.dataContainer, id: listId }));
        invalidateQdnJson("DOCUMENT", current.name, listId);
      }
    },
    [dispatch, draftKey, key, published]
  );

  /** Everything landed. */
  const done = useCallback(() => {
    if (!job) return;
    apply(job, new Set(job.resources.map((r) => r.identifier)));
    dispatch(setNotification({ msg: "Collections published", alertType: "success" }));
    setJob(null);
    releaseListWrite(lock);
  }, [job, apply, dispatch, lock]);

  /** Closed before everything landed: what did is applied, the rest stays to publish again. */
  const closed = useCallback(
    (sent: string[]) => {
      if (job && sent.length > 0) {
        apply(job, new Set(sent));
        dispatch(setNotification({ msg: "Not everything was published. Publish again to finish.", alertType: "info" }));
      }
      setJob(null);
      releaseListWrite(lock);
    },
    [job, apply, dispatch, lock]
  );

  return {
    status,
    collections,
    dirty,
    pointerMissing,
    busy,
    save,
    remove,
    restore,
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
