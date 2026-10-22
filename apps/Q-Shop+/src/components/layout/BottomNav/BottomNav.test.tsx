import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { DESKTOP, PHONE_LANDSCAPE, PHONE_PORTRAIT, PHONE_PORTRAIT_KEYBOARD, mockViewport } from "../../../test/viewport";
import { createAppStore } from "../../../state/store";
import { addUser } from "../../../state/features/authSlice";
import { setCurrentStore, setOwnShopStatus } from "../../../state/features/globalSlice";
import { setAllMyStores } from "../../../state/features/storeSlice";
import { setProductToCart } from "../../../state/features/cartSlice";
import { savePendingOrder, type PendingOrder } from "../../../money/pendingOrders";
import { ShellContext, type ShellActions } from "../shellState";
import { BottomNav, BottomNavSpacer } from "./BottomNav";

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function renderNav(options: { path?: string; store?: ReturnType<typeof createAppStore>; actions?: Partial<ShellActions> } = {}) {
  const actions: ShellActions = { signIn: vi.fn(), reloadOwnShops: vi.fn(), authenticating: false, ...options.actions };
  const result = renderWithProviders(
    <ShellContext.Provider value={actions}>
      <BottomNav />
      <BottomNavSpacer />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </ShellContext.Provider>,
    { initialEntries: [options.path ?? "/"], store: options.store }
  );
  return { ...result, actions };
}

const where = () => screen.getByTestId("where").textContent;
const signedIn = () => {
  const store = createAppStore();
  store.dispatch(addUser({ address: "QBuyer", publicKey: "pk", name: "Buyer+One", names: [{ name: "Buyer+One", owner: "QBuyer" }] }));
  return store;
};

const pendingOrder = (orderUid: string): PendingOrder =>
  ({
    version: 1,
    orderUid,
    mailUid: `M${orderUid}`,
    state: "paid",
    created: 1,
    updated: 1,
    buyer: { name: "Buyer+One", address: "QBuyer", publicKey: "pk" },
    store: { id: "q-store-general-my-shop", shortStoreId: "my-shop", title: "Shop", owner: "Seller Name" },
    seller: { address: "QSeller", publicKey: "spk" },
    coin: "QORT",
    currencyLabel: "QORT",
    recipient: "QSeller",
    amount: "1.00000000",
    isDigital: true,
    details: { totalPrice: "1.00000000" },
    payment: null,
  }) as unknown as PendingOrder;

let restore: () => void = () => {};
beforeEach(() => {
  restore = mockViewport(PHONE_PORTRAIT);
});
afterEach(() => restore());

describe("BottomNav", () => {
  it("has the five items in order, labelled, with the current page marked", () => {
    renderNav({ path: "/settings" });
    const nav = screen.getByRole("navigation", { name: "Main" });
    const labels = Array.from(nav.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toEqual(["Shops", "Cart", "Orders", "Sell", "Settings"]);
    expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Shops" })).not.toHaveAttribute("aria-current");
  });

  it("counts shop and product pages as Shops, and the seller pages as Sell", () => {
    const { unmount } = renderNav({ path: "/Seller%20Name/q-store-general-my-shop/q-store-product-my-shop-P1/q-store-catalogue-my-shop-C1" });
    expect(screen.getByRole("button", { name: "Shops" })).toHaveAttribute("aria-current", "page");
    unmount();
    renderNav({ path: "/product-manager/q-store-general-my-shop" });
    expect(screen.getByRole("button", { name: "Sell" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates to shops, cart, orders and settings", () => {
    renderNav({ path: "/settings" });
    fireEvent.click(screen.getByRole("button", { name: "Cart" }));
    expect(where()).toBe("/cart");
    fireEvent.click(screen.getByRole("button", { name: "Orders" }));
    expect(where()).toBe("/my-orders");
    fireEvent.click(screen.getByRole("button", { name: "Shops" }));
    expect(where()).toBe("/");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(where()).toBe("/settings");
  });

  it("shows how many items wait in every shop's cart", () => {
    const store = createAppStore();
    store.dispatch(setProductToCart({ storeId: "s1", storeOwner: "A", productId: "p1", catalogueId: "c1", quantity: 2 }));
    store.dispatch(setProductToCart({ storeId: "s2", storeOwner: "B", productId: "p9", catalogueId: "c9" }));
    renderNav({ store });
    const cart = screen.getByRole("button", { name: "Cart, 3 items" });
    expect(cart).toHaveTextContent("3");
    act(() => {
      store.dispatch(setProductToCart({ storeId: "s2", storeOwner: "B", productId: "p8", catalogueId: "c9" }));
    });
    expect(screen.getByRole("button", { name: "Cart, 4 items" })).toBeInTheDocument();
  });

  it("puts a dot on the cart while a paid order waits to be finished, and follows changes", () => {
    savePendingOrder(pendingOrder("U1"));
    const { container } = renderNav({ store: signedIn() });
    expect(screen.getByRole("button", { name: "Cart, 1 paid order to finish" })).toBeInTheDocument();
    expect(container.querySelectorAll(".MuiBadge-dot:not(.MuiBadge-invisible)")).toHaveLength(1);
    act(() => savePendingOrder(pendingOrder("U2")));
    expect(screen.getByRole("button", { name: "Cart, 2 paid orders to finish" })).toBeInTheDocument();
  });

  it("has no dot for another name's paid orders", () => {
    savePendingOrder({ ...pendingOrder("U1"), buyer: { name: "Someone Else", address: "Q2", publicKey: "k" } });
    const { container } = renderNav({ store: signedIn() });
    expect(screen.getByRole("button", { name: "Cart" })).toBeInTheDocument();
    expect(container.querySelectorAll(".MuiBadge-dot:not(.MuiBadge-invisible)")).toHaveLength(0);
  });

  describe("Sell", () => {
    it("asks to sign in when signed out", () => {
      const { actions } = renderNav();
      fireEvent.click(screen.getByRole("button", { name: "Sell" }));
      expect(actions.signIn).toHaveBeenCalledTimes(1);
      expect(where()).toBe("/");
    });

    it("opens the seller page of the current shop", () => {
      const store = signedIn();
      store.dispatch(setCurrentStore({ id: "q-store-general-my-shop", owner: "Buyer+One" }));
      store.dispatch(setOwnShopStatus("ready"));
      renderNav({ store });
      fireEvent.click(screen.getByRole("button", { name: "Sell" }));
      expect(where()).toBe("/product-manager/q-store-general-my-shop");
    });

    it("falls back to the first of the name's shops when the current one couldn't be read", () => {
      const store = signedIn();
      store.dispatch(setAllMyStores([{ id: "q-store-general-other", owner: "Buyer+One", title: "Other" }]));
      store.dispatch(setOwnShopStatus("unavailable"));
      renderNav({ store });
      fireEvent.click(screen.getByRole("button", { name: "Sell" }));
      expect(where()).toBe("/product-manager/q-store-general-other");
      expect(store.getState().global.recentlyVisitedStoreId).toBe("q-store-general-other");
    });

    it("opens Create shop when the name has no shop", () => {
      const store = signedIn();
      store.dispatch(setOwnShopStatus("none"));
      renderNav({ store });
      fireEvent.click(screen.getByRole("button", { name: "Sell" }));
      expect(store.getState().global.isOpenCreateStoreModal).toBe(true);
      expect(where()).toBe("/");
    });

    it("says the shops are still loading instead of offering a second shop, and asks again after a failure", () => {
      const store = signedIn();
      store.dispatch(setOwnShopStatus("loading"));
      const { actions } = renderNav({ store });
      fireEvent.click(screen.getByRole("button", { name: "Sell" }));
      expect(store.getState().global.isOpenCreateStoreModal).toBe(false);
      expect(store.getState().notifications.alertTypes.alertInfo).toMatch(/Loading your shops/);
      expect(actions.reloadOwnShops).not.toHaveBeenCalled();

      act(() => {
        store.dispatch(setOwnShopStatus("error"));
      });
      fireEvent.click(screen.getByRole("button", { name: "Sell" }));
      expect(actions.reloadOwnShops).toHaveBeenCalledTimes(1);
      expect(store.getState().global.isOpenCreateStoreModal).toBe(false);
    });

    it("explains that selling needs a name when the account has none", () => {
      const store = createAppStore();
      store.dispatch(addUser({ address: "QNoName", publicKey: "pk", name: "", names: [{ name: "", owner: "QNoName" }] }));
      const { actions } = renderNav({ store });
      fireEvent.click(screen.getByRole("button", { name: "Sell" }));
      expect(actions.signIn).not.toHaveBeenCalled();
      expect(store.getState().notifications.alertTypes.alertInfo).toMatch(/Register a Qortal name/);
    });
  });

  it("keeps the page clear of the 64 px bar", () => {
    renderNav();
    expect(screen.getByTestId("bottom-nav-spacer").style.height).toBe("calc(64px + env(safe-area-inset-bottom, 0px))");
  });

  it("goes compact (48 px) on a phone held sideways", () => {
    restore();
    restore = mockViewport(PHONE_LANDSCAPE);
    renderNav();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav-spacer").style.height).toBe("calc(48px + env(safe-area-inset-bottom, 0px))");
  });

  it("stays as in portrait when the keyboard makes a portrait phone short", () => {
    restore();
    restore = mockViewport(PHONE_PORTRAIT_KEYBOARD);
    renderNav();
    expect(screen.getByTestId("bottom-nav-spacer").style.height).toBe("calc(64px + env(safe-area-inset-bottom, 0px))");
  });

  it("renders nothing on wider screens", () => {
    restore();
    restore = mockViewport(DESKTOP);
    const { container } = renderNav();
    expect(container.querySelector("nav")).toBeNull();
    expect(screen.queryByTestId("bottom-nav-spacer")).toBeNull();
  });
});
