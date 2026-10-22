/**
 * The signed-in name's shops, and the one it is working on (its store and
 * product index in `global.currentStore` / `global.dataContainer`).
 *
 * The original did this in GlobalWrapper with two searches (one by
 * `identifier` prefix, one by `query`), fetched the first shop's JSON twice,
 * and — when the product index (data container) couldn't be fetched for any
 * reason, a node hiccup included — published an empty one at start-up,
 * which hides every product of the shop if the seller accepts Hub's dialog
 * (docs/apps/Q-Shop+.md → Bugs 2). Here:
 * - one search, by name and identifier prefix, with metadata (titles show at
 *   once), oldest first like the original's choice of "current" shop;
 * - the current shop's JSON and index read once, through the session cache;
 * - nothing is ever published here: a missing index is reported as
 *   `container-missing` (confirmed by a search), and the seller page offers
 *   to create it; an index that exists but can't be read is `unavailable`.
 */
import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import {
  setCurrentStore,
  setDataContainer,
  setOwnShopStatus,
  type CurrentStore,
} from "../state/features/globalSlice";
import { addToHashMapStores, setAllMyStores, type Store } from "../state/features/storeSlice";
import { dataContainerIdentifier, isStoreIdentifier, STORE_BASE, shortStoreIdOf } from "../qdn/identifiers";
import { fetchQdnJson, resourceExists, searchQdn, type QdnResourceSummary } from "../qdn/search";
import { checkStructureStore } from "../utils/checkStructure";

/** The shop's QDN description without the original's `**coins:…**` marker. */
export function plainStoreDescription(description: string | undefined): string {
  return (description ?? "").replace(/^\*\*coins:[^*]*\*\*/, "");
}

export function storeFromRow(row: QdnResourceSummary): Store {
  return {
    title: row.metadata?.title ?? "",
    category: row.metadata?.category,
    categoryName: row.metadata?.categoryName,
    tags: row.metadata?.tags || [],
    description: plainStoreDescription(row.metadata?.description),
    created: row.created ?? 0,
    updated: row.updated,
    owner: row.name,
    id: row.identifier,
  };
}

/** Shapes a store JSON the way the original keeps it in Redux (Store.tsx / GlobalWrapper). */
export function currentStoreFrom(storeId: string, owner: string, json: any, row?: Partial<Store>): CurrentStore {
  return {
    created: json?.created || "",
    id: storeId,
    title: json?.title || "",
    location: json?.location,
    shipsTo: json?.shipsTo,
    description: json?.description || "",
    category: row?.category,
    tags: row?.tags || [],
    logo: json?.logo || "",
    shortStoreId: json?.shortStoreId,
    supportedCoins: json?.supportedCoins || [],
    foreignCoins: json?.foreignCoins || {},
    acceptedAssets: Array.isArray(json?.acceptedAssets) ? json.acceptedAssets : undefined,
    owner,
  } as unknown as CurrentStore;
}

export async function findOwnShops(name: string, fresh = false): Promise<Store[]> {
  const rows = await searchQdn(
    {
      service: "STORE",
      identifier: `${STORE_BASE}-`,
      prefix: true,
      name,
      exactmatchnames: true,
      includemetadata: true,
      reverse: false,
      limit: 20,
    },
    { fresh }
  );
  return rows.filter((row) => isStoreIdentifier(row.identifier) && row.name === name).map(storeFromRow);
}

/** Loads one of the user's shops as the current one: its JSON and its product index. */
export async function loadOwnShop(
  dispatch: AppDispatch,
  shop: Store,
  options: { fresh?: boolean; isCurrent?: () => boolean } = {}
) {
  // A name switch while this loads must not let the old name's shop land.
  const current = options.isCurrent ?? (() => true);
  dispatch(setOwnShopStatus("loading"));
  try {
    const json = await fetchQdnJson("STORE", shop.owner, shop.id, options);
    if (!current()) return;
    if (checkStructureStore(json)) {
      dispatch(addToHashMapStores({ ...shop, ...json, owner: shop.owner, id: shop.id, isValid: true }));
    }
    dispatch(setCurrentStore(currentStoreFrom(shop.id, shop.owner, json, shop)));
  } catch {
    if (current()) dispatch(setOwnShopStatus("unavailable"));
    return;
  }
  const containerId = dataContainerIdentifier(shop.id);
  try {
    const container = await fetchQdnJson("DOCUMENT", shop.owner, containerId, options);
    if (!current()) return;
    if (container && typeof container === "object" && (container as { products?: unknown }).products) {
      dispatch(setDataContainer({ ...(container as object), id: containerId }));
      dispatch(setOwnShopStatus("ready"));
      return;
    }
    throw new Error("Not a product index");
  } catch {
    const exists = await resourceExists("DOCUMENT", shop.owner, containerId, { fresh: true }).catch(() => true);
    if (current()) dispatch(setOwnShopStatus(exists ? "unavailable" : "container-missing"));
  }
}

/** Mount once (GlobalWrapper): loads the signed-in name's shops and its current shop. */
export function useOwnShops(): { reload: () => void } {
  const dispatch = useDispatch<AppDispatch>();
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const recentlyVisitedStoreId = useSelector((state: RootState) => state.global.recentlyVisitedStoreId);
  const currentStoreId = useSelector((state: RootState) => state.global.currentStore?.id);
  const myStores = useSelector((state: RootState) => state.store.myStores);

  const activeName = useRef(name);
  useEffect(() => {
    activeName.current = name;
  }, [name]);

  const load = useCallback(
    async (fresh = false) => {
      if (!name) return;
      const isCurrent = () => activeName.current === name;
      dispatch(setOwnShopStatus("loading"));
      try {
        const shops = await findOwnShops(name, fresh);
        if (!isCurrent()) return;
        dispatch(setAllMyStores(shops));
        if (shops.length === 0) {
          dispatch(setOwnShopStatus("none"));
          return;
        }
        await loadOwnShop(dispatch, shops[0], { fresh, isCurrent });
      } catch {
        if (isCurrent()) dispatch(setOwnShopStatus("error"));
      }
    },
    [dispatch, name]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Visiting another of your own shops makes it the current one (as the original did).
  useEffect(() => {
    if (!recentlyVisitedStoreId || recentlyVisitedStoreId === currentStoreId) return;
    const shop = myStores.find((s) => s.id === recentlyVisitedStoreId);
    if (shop) loadOwnShop(dispatch, shop, { isCurrent: () => activeName.current === shop.owner });
  }, [recentlyVisitedStoreId, currentStoreId, myStores, dispatch]);

  return { reload: () => load(true) };
}

export { shortStoreIdOf };
