/**
 * What the cart page needs for every shop in the cart: the shop (title,
 * logo, coins and payout addresses) and the products, from the catalogues
 * the lines were added from.
 *
 * - A shop already in `hashMapStores` from its JSON (a shop page or the home
 *   list loaded it) is used as is; otherwise its STORE JSON is read through
 *   the session cache (fetchQdnJson), by owner and identifier.
 * - A catalogue already in `catalogueHashMap` (for this owner) is used as is;
 *   otherwise it is fetched with the app's catalogue reader and kept here by
 *   owner + identifier. That map is keyed by identifier only, and another
 *   name can publish a catalogue under the same identifier (docs/QORTAL.md →
 *   pitfall 15): a copy loaded for one cart must never evict the copy another
 *   cart needs, or each load would send the other cart to fetch again, for
 *   as long as the page is open. A copy is added to the shared map only when
 *   the map has none of another name's under that identifier.
 * - At most five loads at once; each is tried again at 2, 4 and 8 s
 *   ("Fetching from peers…"), then waits for Retry. No polling.
 */
import { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import type { RootState } from "../../state/store";
import type { Cart } from "../../state/features/cartSlice";
import { setCatalogueHashMap, type Catalogue } from "../../state/features/globalSlice";
import { addToHashMapStores, type Store } from "../../state/features/storeSlice";
import { QdnDeletedError, fetchQdnJson } from "../../qdn/search";
import { isRecentlyDeletedShop } from "../../qdn/deleted";
import { fetchAndEvaluateCatalogues } from "../../utils/fetchCatalogues";
import { checkStructureStore } from "../../utils/checkStructure";
import { useRetryingLoads, type LoadJob, type LoadPhase } from "./useRetryingLoads";
import { cartShopFrom, cartViewLines, catalogueFor, type CartShop, type CartViewLine } from "./cartLines";

export interface ShopCartView {
  /** The cart's key in Redux: unique per owner + shop id (React key; never parse it). */
  key: string;
  storeId: string;
  owner: string | null;
  cart: Cart;
  /** Null until the shop's JSON is in. */
  shop: CartShop | null;
  /** Where loading the shop stands while `shop` is null. */
  shopPhase: LoadPhase;
  /** A title to show before the shop is in (from the home list's search row), else "". */
  knownTitle: string;
  lines: CartViewLine[];
}

interface ShopJob {
  storeId: string;
  owner: string;
}

interface CatalogueJob {
  catalogueId: string;
  owner: string;
}

const shopKey = (owner: string, storeId: string) => `${owner}\n${storeId}`;

/** A store Redux holds from its JSON (not just a search row), for this owner. */
function knownShop(store: Store | undefined, owner: string): CartShop | null {
  if (!store || !store.isValid || store.owner !== owner || !Array.isArray(store.supportedCoins)) return null;
  return cartShopFrom(store.id, owner, store);
}

export function useCartData(carts: Record<string, Cart>): {
  views: ShopCartView[];
  retryShop: (view: ShopCartView) => void;
  retryLines: (view: ShopCartView) => void;
} {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const hashMapStores = useSelector((state: RootState) => state.store.hashMapStores);
  const catalogueHashMap = useSelector((state: RootState) => state.global.catalogueHashMap);
  /** Shops read here whose JSON Redux doesn't keep (it lacks a field the store map requires). */
  const [readShops, setReadShops] = useState<Record<string, CartShop>>({});
  /** Catalogues read here, by owner + identifier. */
  const [readCatalogues, setReadCatalogues] = useState<Record<string, Catalogue>>({});

  // Newest cart first: Object key order is the order the carts were started in.
  const cartEntries = useMemo(() => Object.entries(carts).reverse(), [carts]);
  const cartList = useMemo(() => cartEntries.map(([, cart]) => cart), [cartEntries]);

  const shopOf = useCallback(
    (cart: Cart): CartShop | null => {
      const storeId = cart.storeId ?? "";
      if (!cart.storeOwner || !storeId) return null;
      const read = readShops[shopKey(cart.storeOwner, storeId)];
      return read ?? knownShop(hashMapStores[storeId], cart.storeOwner);
    },
    [hashMapStores, readShops]
  );

  const shopJobs = useMemo(() => {
    const jobs: LoadJob<ShopJob>[] = [];
    for (const cart of cartList) {
      if (!cart.storeOwner || !cart.storeId || shopOf(cart)) continue;
      jobs.push({ key: shopKey(cart.storeOwner, cart.storeId), item: { storeId: cart.storeId, owner: cart.storeOwner } });
    }
    return jobs;
  }, [cartList, shopOf]);

  const loadShop = useCallback(
    async ({ storeId, owner }: ShopJob): Promise<boolean | "gone"> => {
      if (isRecentlyDeletedShop(owner, storeId)) return "gone";
      let json: unknown;
      try {
        json = await fetchQdnJson("STORE", owner, storeId);
      } catch (error) {
        // Its owner deleted the shop: its items can't be bought, and asking again won't change that.
        if (error instanceof QdnDeletedError) return "gone";
        throw error;
      }
      if (!json || typeof json !== "object" || Array.isArray(json)) return false;
      const shop = cartShopFrom(storeId, owner, json);
      setReadShops((current) => ({ ...current, [shopKey(owner, storeId)]: shop }));
      if (checkStructureStore(json)) {
        // Shared with the other pages, as loadOwnShop and the shop page keep it.
        const known = store.getState().store.hashMapStores[storeId];
        const base = known && known.owner === owner ? known : {};
        dispatch(addToHashMapStores({ ...base, ...json, owner, id: storeId, isValid: true }));
      }
      return true;
    },
    [dispatch, store]
  );

  /** This owner's copy of a catalogue: the shared map's when it is theirs, else the one read here. */
  const catalogueOf = useCallback(
    (owner: string | null, catalogueId: string): Catalogue | null => {
      if (!owner) return null;
      return catalogueFor(catalogueHashMap, catalogueId, owner) ?? readCatalogues[shopKey(owner, catalogueId)] ?? null;
    },
    [catalogueHashMap, readCatalogues]
  );

  const { phaseOf: shopPhaseOf, retry: retryShopLoad } = useRetryingLoads(shopJobs, loadShop);

  const catalogueJobs = useMemo(() => {
    const jobs: LoadJob<CatalogueJob>[] = [];
    const seen = new Set<string>();
    for (const cart of cartList) {
      const owner = cart.storeOwner;
      if (!owner) continue;
      // A deleted shop's products are gone with it: nothing to read.
      if (cart.storeId && shopPhaseOf(shopKey(owner, cart.storeId)) === "gone") continue;
      for (const order of Object.values(cart.orders)) {
        const key = shopKey(owner, order.catalogueId);
        if (seen.has(key) || catalogueOf(owner, order.catalogueId)) continue;
        seen.add(key);
        jobs.push({ key, item: { catalogueId: order.catalogueId, owner } });
      }
    }
    return jobs;
  }, [cartList, catalogueOf, shopPhaseOf]);

  const loadCatalogue = useCallback(
    async ({ catalogueId, owner }: CatalogueJob): Promise<boolean> => {
      const catalogue = await fetchAndEvaluateCatalogues({ user: owner, catalogueId });
      if (!catalogue?.isValid || !catalogue.products || typeof catalogue.products !== "object") return false;
      setReadCatalogues((current) => ({ ...current, [shopKey(owner, catalogueId)]: catalogue }));
      // Shared with the other pages, unless that would replace another name's copy.
      const shared = store.getState().global.catalogueHashMap[catalogueId];
      if (!shared || shared.user === owner) dispatch(setCatalogueHashMap(catalogue));
      return true;
    },
    [dispatch, store]
  );

  const { phaseOf: cataloguePhaseOf, retry: retryCatalogueLoad } = useRetryingLoads(catalogueJobs, loadCatalogue);

  const views = useMemo(
    () =>
      cartEntries.map(([key, cart]): ShopCartView => {
        const storeId = cart.storeId ?? "";
        const owner = cart.storeOwner;
        const shop = shopOf(cart);
        const shopPhase = owner ? shopPhaseOf(shopKey(owner, storeId)) : "failed";
        return {
          key,
          storeId,
          owner,
          cart,
          shop,
          shopPhase,
          knownTitle: hashMapStores[storeId]?.owner === owner ? (hashMapStores[storeId]?.title ?? "") : "",
          lines: cartViewLines(
            cart,
            (catalogueId) => catalogueOf(owner, catalogueId),
            // A deleted shop's products went with it.
            (catalogueId) => (shopPhase === "gone" ? "gone" : cataloguePhaseOf(shopKey(owner ?? "", catalogueId)))
          ),
        };
      }),
    [cartEntries, shopOf, shopPhaseOf, cataloguePhaseOf, catalogueOf, hashMapStores]
  );

  const retryShop = useCallback(
    (view: ShopCartView) => {
      if (view.owner) retryShopLoad(shopKey(view.owner, view.storeId));
    },
    [retryShopLoad]
  );
  const retryLines = useCallback(
    (view: ShopCartView) => {
      if (!view.owner) return;
      for (const line of view.lines) {
        if (line.state === "failed") retryCatalogueLoad(shopKey(view.owner, line.catalogueId));
      }
    },
    [retryCatalogueLoad]
  );

  return { views, retryShop, retryLines };
}
