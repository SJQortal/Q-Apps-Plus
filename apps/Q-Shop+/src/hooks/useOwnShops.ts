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
 *
 * Which shop is current follows `global.recentlyVisitedStoreId`, as in the
 * original: the shop page, the account menu, Sell, the seller page and a new
 * shop set it, and this hook makes that shop current when it is one of the
 * name's. It reacts only when that id changes (the last one handled is
 * kept), never merely because the current shop changed, so creating a second
 * shop or going back and forth between two never flips back to an older one.
 * Only the shop asked for last may land, and a shop lands whole (its JSON and
 * index together), so a load overtaken by another leaves nothing behind.
 */
import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import {
  setCurrentStore,
  setDataContainer,
  setOwnShopStatus,
  type CurrentStore,
  type OwnShopStatus,
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

/**
 * Loads one of the user's shops as the current one: its JSON and its product
 * index. Both are read first and land together, and only while `isCurrent`
 * holds, so a load overtaken by another (or by a name switch) changes nothing.
 */
export async function loadOwnShop(
  dispatch: AppDispatch,
  shop: Store,
  options: { fresh?: boolean; isCurrent?: () => boolean } = {}
) {
  const current = options.isCurrent ?? (() => true);
  dispatch(setOwnShopStatus("loading"));
  let json: any;
  try {
    json = await fetchQdnJson("STORE", shop.owner, shop.id, options);
  } catch {
    if (current()) dispatch(setOwnShopStatus("unavailable"));
    return;
  }
  const containerId = dataContainerIdentifier(shop.id);
  let container: object | null = null;
  let status: OwnShopStatus = "ready";
  try {
    const body = await fetchQdnJson("DOCUMENT", shop.owner, containerId, options);
    if (!body || typeof body !== "object" || !(body as { products?: unknown }).products) throw new Error("Not a product index");
    container = body as object;
  } catch {
    const exists = await resourceExists("DOCUMENT", shop.owner, containerId, { fresh: true }).catch(() => true);
    status = exists ? "unavailable" : "container-missing";
  }
  if (!current()) return;
  if (checkStructureStore(json)) {
    dispatch(addToHashMapStores({ ...shop, ...json, owner: shop.owner, id: shop.id, isValid: true }));
  }
  dispatch(setCurrentStore(currentStoreFrom(shop.id, shop.owner, json, shop)));
  if (container) dispatch(setDataContainer({ ...container, id: containerId }));
  dispatch(setOwnShopStatus(status));
}

/** Mount once (GlobalWrapper): loads the signed-in name's shops and its current shop. */
export function useOwnShops(): { reload: () => void } {
  const dispatch = useDispatch<AppDispatch>();
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const recentlyVisitedStoreId = useSelector((state: RootState) => state.global.recentlyVisitedStoreId);
  const currentStoreId = useSelector((state: RootState) => state.global.currentStore?.id);
  const myStores = useSelector((state: RootState) => state.store.myStores);

  const activeName = useRef(name);
  const visited = useRef(recentlyVisitedStoreId);
  const current = useRef(currentStoreId);
  // The last recently visited id acted on; the shop asked for last; the shop being loaded.
  const handled = useRef("");
  const wanted = useRef<string | null>(null);
  const loading = useRef<string | null>(null);
  useEffect(() => {
    activeName.current = name;
    visited.current = recentlyVisitedStoreId;
    current.current = currentStoreId;
  }, [name, recentlyVisitedStoreId, currentStoreId]);

  /** Makes one of the name's shops current, unless another is asked for before it lands. */
  const loadShop = useCallback(
    async (shop: Store, fresh = false) => {
      wanted.current = shop.id;
      loading.current = shop.id;
      const isCurrent = () => activeName.current === shop.owner && wanted.current === shop.id;
      try {
        await loadOwnShop(dispatch, shop, { fresh, isCurrent });
      } finally {
        if (loading.current === shop.id) loading.current = null;
      }
    },
    [dispatch]
  );

  const load = useCallback(
    async (fresh = false) => {
      if (!name) return;
      const isCurrent = () => activeName.current === name;
      dispatch(setOwnShopStatus("loading"));
      try {
        const shops = await findOwnShops(name, fresh);
        if (!isCurrent()) return;
        // The shop the seller is on (a link, the seller page) or works on; else the oldest, as the original.
        const shop =
          shops.find((s) => s.id === visited.current) ?? shops.find((s) => s.id === current.current) ?? shops[0];
        if (shop && shop.id === visited.current) handled.current = shop.id;
        dispatch(setAllMyStores(shops));
        if (!shop) {
          dispatch(setOwnShopStatus("none"));
          return;
        }
        await loadShop(shop, fresh);
      } catch {
        if (isCurrent()) dispatch(setOwnShopStatus("error"));
      }
    },
    [dispatch, name, loadShop]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Visiting another of your own shops makes it the current one (as the original did).
  // Only a new id counts: the current shop changing is never a reason to load another.
  useEffect(() => {
    const id = recentlyVisitedStoreId;
    if (!id) {
      handled.current = "";
      return;
    }
    if (id === handled.current) return;
    // Someone else's shop, or the name's shops aren't known yet (this runs again when they are).
    const shop = myStores.find((s) => s.id === id);
    if (!shop) return;
    handled.current = id;
    // Already current, unless a load of another shop is still out: that one must not land.
    if (id !== current.current || (loading.current !== null && loading.current !== id)) void loadShop(shop);
  }, [recentlyVisitedStoreId, myStores, loadShop]);

  return { reload: () => load(true) };
}

export { shortStoreIdOf };
