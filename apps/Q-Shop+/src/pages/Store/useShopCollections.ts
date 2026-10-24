/**
 * A shop's collections for its page (qdn/collections.ts): read only when the
 * product index points at the shop's collections document, through the
 * session cache, with the peer retries the rest of the page uses. A document
 * that was deleted, or isn't a collections document, shows no collections.
 */
import { useCallback, useEffect, useState } from "react";
import { collectionsPointer, normalizeCollections, type ShopCollection } from "../../qdn/collections";
import { QdnDeletedError, fetchQdnJson } from "../../qdn/search";
import { RetryCancelled, withPeerRetries } from "./peerRetry";

export type CollectionsStatus = "none" | "loading" | "fetching" | "ready" | "unavailable";

export interface ShopCollections {
  status: CollectionsStatus;
  collections: ShopCollection[];
  retry: () => void;
}

interface Loaded {
  key: string;
  status: Exclude<CollectionsStatus, "none" | "loading">;
  collections: ShopCollection[];
}

const EMPTY: ShopCollection[] = [];

export function useShopCollections(owner: string, storeId: string, index: object | null): ShopCollections {
  const pointer = collectionsPointer(index, storeId);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${owner}\n${pointer ?? ""}\n${attempt}`;

  useEffect(() => {
    if (!owner || !pointer) return;
    let alive = true;
    withPeerRetries(() => fetchQdnJson<unknown>("DOCUMENT", owner, pointer, { fresh: attempt > 0 }), {
      isAlive: () => alive,
      onRetry: () => setLoaded({ key, status: "fetching", collections: EMPTY }),
      shouldRetry: (error) => !(error instanceof QdnDeletedError),
    }).then(
      (json) => {
        if (alive) setLoaded({ key, status: "ready", collections: normalizeCollections(json) });
      },
      (error) => {
        if (!alive || error instanceof RetryCancelled) return;
        setLoaded({ key, status: error instanceof QdnDeletedError ? "ready" : "unavailable", collections: EMPTY });
      }
    );
    return () => {
      alive = false;
    };
  }, [attempt, key, owner, pointer]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  if (!pointer) return { status: "none", collections: EMPTY, retry };
  if (loaded?.key === key) return { status: loaded.status, collections: loaded.collections, retry };
  return { status: "loading", collections: EMPTY, retry };
}
