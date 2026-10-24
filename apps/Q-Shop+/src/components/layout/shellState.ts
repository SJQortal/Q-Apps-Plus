/**
 * What the header and the phone's bottom bar share: the sign-in action, the
 * cart's item count, the paid-but-unfinished orders, the Sell destination
 * and which navigation item the current page belongs to.
 */
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../state/store";
import { allCartsItemCount } from "../../state/features/cartSlice";
import { toggleCreateStoreModal, updateRecentlyVisitedStoreId } from "../../state/features/globalSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import { listPendingOrders, subscribePendingOrders } from "../../money/pendingOrders";
import { isEmbeddedFrame } from "../../utils/hubFrame";

export interface ShellActions {
  /** Sign in with Hub, or explain how to get Qortal on a web gateway. */
  signIn: () => void;
  /** Ask for the signed-in name's shops again (after a failed load). */
  reloadOwnShops: () => void;
  /** The account request is out (on start-up, or after Sign in). */
  authenticating: boolean;
}

export const ShellContext = createContext<ShellActions>({
  signIn: () => {},
  reloadOwnShops: () => {},
  authenticating: false,
});

export function useShellActions(): ShellActions {
  return useContext(ShellContext);
}

/**
 * A web gateway, where there is no Hub to sign in with (the original's
 * Authenticate button opened the "Download Qortal" dialog there). The
 * original tested for https only; Hub and GO can reach a node over https
 * too, but they always show the app in a frame, and a gateway shows it as
 * the page itself. So: https, and not in a frame.
 */
export function isWebGateway(win: Window = window): boolean {
  return win.location.protocol === "https:" && !isEmbeddedFrame(win);
}

/** Items in every shop's cart. */
export function useCartItemCount(): number {
  return useSelector((state: RootState) => allCartsItemCount(state.cart.carts));
}

/**
 * How many orders the signed-in name has paid for but not yet recorded on
 * QDN (money/pendingOrders.ts): the cart shows a dot until they are finished.
 */
export function usePendingOrderCount(): number {
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const snapshot = useCallback(() => listPendingOrders(name).length, [name]);
  return useSyncExternalStore(subscribePendingOrders, snapshot, () => 0);
}

/** The cart's accessible name: what the badge and the dot say. */
export function cartLabel(items: number, pending: number): string {
  const parts = ["Cart"];
  if (items) parts.push(items === 1 ? "1 item" : `${items} items`);
  if (pending) parts.push(pending === 1 ? "1 paid order to finish" : `${pending} paid orders to finish`);
  return parts.join(", ");
}

/** The seller's page for one of their shops. */
export function sellerPath(storeId: string): string {
  return `/product-manager/${encodeURIComponent(storeId)}`;
}

/** Which navigation item a path belongs to. Shop and product pages count as Shops. */
export type NavSection = "shops" | "products" | "cart" | "orders" | "sell" | "settings" | "favorites";

export function navSection(pathname: string): NavSection {
  if (pathname === "/products" || pathname.startsWith("/products/")) return "products";
  if (pathname.startsWith("/cart")) return "cart";
  if (pathname.startsWith("/my-orders")) return "orders";
  if (pathname.startsWith("/product-manager")) return "sell";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/favorites")) return "favorites";
  return "shops";
}

/**
 * Sell: the seller page of the shop the name is working on; Create shop when
 * the name has none; Sign in when signed out. While the name's shops are
 * still loading it says so (and asks again after a failed load) rather than
 * offering Create shop, which could start a second shop by mistake.
 */
export function useSell(): () => void {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { signIn, reloadOwnShops } = useShellActions();
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const address = useSelector((state: RootState) => state.auth.user?.address);
  const currentStoreId = useSelector((state: RootState) => state.global.currentStore?.id);
  const myStores = useSelector((state: RootState) => state.store.myStores);
  const status = useSelector((state: RootState) => state.global.ownShopStatus);

  return useCallback(() => {
    if (!name) {
      // Signed in without a name: a shop is published under a Qortal name.
      if (address) dispatch(setNotification({ msg: "Register a Qortal name in Hub to open a shop.", alertType: "info" }));
      else signIn();
      return;
    }
    const shopId = currentStoreId || myStores[0]?.id;
    if (shopId) {
      if (shopId !== currentStoreId) dispatch(updateRecentlyVisitedStoreId(shopId));
      navigate(sellerPath(shopId));
      return;
    }
    if (status === "none") {
      dispatch(toggleCreateStoreModal(true));
      return;
    }
    if (status === "error") reloadOwnShops();
    dispatch(setNotification({ msg: "Loading your shops… try again in a moment.", alertType: "info" }));
  }, [name, address, currentStoreId, myStores, status, signIn, reloadOwnShops, navigate, dispatch]);
}

/**
 * What the Sell item is called (Simon, 2026-10-23): Create Shop for a
 * signed-in account that has no shop yet (its name has none, or it has no
 * name to open one under, which Sell then says), Manage Shop otherwise, and
 * while the name's shops are still loading, so the label never flickers.
 */
export function useSellLabel(): "Manage Shop" | "Create Shop" {
  const signedIn = useSelector((state: RootState) => !!state.auth.user?.address);
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const hasShop = useSelector((state: RootState) => !!state.global.currentStore?.id || state.store.myStores.length > 0);
  const status = useSelector((state: RootState) => state.global.ownShopStatus);
  if (!signedIn || hasShop) return "Manage Shop";
  return !name || status === "none" ? "Create Shop" : "Manage Shop";
}
