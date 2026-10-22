import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installQortalMock } from "../../test/qortalMock";
import { DESKTOP, PHONE_PORTRAIT, mockViewport } from "../../test/viewport";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setCurrentStore, setIsLoadingGlobal, setOwnShopStatus } from "../../state/features/globalSlice";
import { setAllMyStores } from "../../state/features/storeSlice";
import { setProductToCart } from "../../state/features/cartSlice";
import { ACTIVE_NAME_STORAGE_KEY } from "../../constants/plus";
import { AppShell } from "./AppShell";
import { isWebGateway } from "./shellState";

const ADDRESS = "QSeLLeRAddress";

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function renderShell(options: { store?: ReturnType<typeof createAppStore>; path?: string; authenticating?: boolean } = {}) {
  const authenticate = vi.fn();
  const onGatewaySignIn = vi.fn();
  const result = renderWithProviders(
    <AppShell authenticate={authenticate} onGatewaySignIn={onGatewaySignIn} authenticating={options.authenticating}>
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </AppShell>,
    { store: options.store, initialEntries: [options.path ?? "/"] }
  );
  return { ...result, authenticate, onGatewaySignIn };
}

function sellerStore() {
  const store = createAppStore();
  store.dispatch(
    addUser({
      address: ADDRESS,
      publicKey: "pk",
      name: "Seller Name",
      names: [
        { name: "Seller Name", owner: ADDRESS },
        { name: "Second Name", owner: ADDRESS },
      ],
    })
  );
  store.dispatch(
    setAllMyStores([
      { id: "q-store-general-my-shop", owner: "Seller Name", title: "Seller's Shop" },
      { id: "q-store-general-other", owner: "Seller Name", title: "" },
    ])
  );
  store.dispatch(setCurrentStore({ id: "q-store-general-my-shop", owner: "Seller Name" }));
  store.dispatch(setOwnShopStatus("ready"));
  return store;
}

const where = () => screen.getByTestId("where").textContent;
const openAccountMenu = () => fireEvent.click(screen.getByRole("button", { name: "Account menu for Seller Name" }));

let restore: () => void = () => {};
afterEach(() => restore());

describe("AppShell on desktop", () => {
  it("has the logo, Shops / Products / Orders / Sell, the cart, Settings and Sign in, and the page in <main>", () => {
    restore = mockViewport(DESKTOP);
    const { authenticate, onGatewaySignIn } = renderShell({ path: "/my-orders" });
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toContainElement(screen.getByTestId("where"));
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["Shops", "Products", "Orders", "Sell"]);
    expect(within(nav).getByRole("button", { name: "Orders" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(nav).getByRole("button", { name: "Products" }));
    expect(where()).toBe("/products");
    // The bottom bar is for phones only.
    expect(screen.getAllByRole("navigation")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Q-Shop+ home" }));
    expect(where()).toBe("/");
    fireEvent.click(screen.getByRole("button", { name: "Cart" }));
    expect(where()).toBe("/cart");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(where()).toBe("/settings");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(onGatewaySignIn).not.toHaveBeenCalled();
  });

  it("holds Sign in back while the account request is out", () => {
    restore = mockViewport(DESKTOP);
    renderShell({ authenticating: true });
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("tells a web gateway (https, the page itself) from Hub and GO (in a frame, over http or https)", () => {
    const page = (protocol: string, framed: boolean): Window => {
      const win: { location: { protocol: string }; parent?: unknown } = { location: { protocol } };
      win.parent = framed ? {} : win;
      return win as unknown as Window;
    };
    expect(isWebGateway(page("https:", false))).toBe(true);
    expect(isWebGateway(page("https:", true))).toBe(false);
    expect(isWebGateway(page("http:", true))).toBe(false);
    expect(isWebGateway(page("http:", false))).toBe(false);
  });

  it("counts every shop's cart items on the cart button", () => {
    restore = mockViewport(DESKTOP);
    const store = createAppStore();
    store.dispatch(setProductToCart({ storeId: "s1", storeOwner: "A", productId: "p1", catalogueId: "c1", quantity: 2 }));
    renderShell({ store });
    expect(screen.getByRole("button", { name: "Cart, 2 items" })).toHaveTextContent("2");
  });

  it("shows a thin progress line, not a blank page, while the app loads", () => {
    restore = mockViewport(DESKTOP);
    const store = createAppStore();
    renderShell({ store });
    expect(screen.queryByRole("progressbar")).toBeNull();
    act(() => {
      store.dispatch(setIsLoadingGlobal(true));
    });
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toBeVisible();
  });

  it("keeps the Hub frame's height in a CSS variable", () => {
    restore = mockViewport(DESKTOP);
    document.documentElement.style.removeProperty("--qshare-app-height");
    renderShell();
    // jsdom is not in a frame: the app runs on its own, so the full dynamic viewport.
    expect(document.documentElement.style.getPropertyValue("--qshare-app-height")).toBe("100dvh");
  });

  describe("account menu", () => {
    it("lists the names and the name's shops, and opens another shop's seller page", async () => {
      restore = mockViewport(DESKTOP);
      const store = sellerStore();
      renderShell({ store });
      openAccountMenu();
      const menu = await screen.findByRole("dialog", { name: "Account menu for Seller Name" });
      expect(within(menu).getByRole("menuitemradio", { name: "Seller Name" })).toHaveAttribute("aria-checked", "true");
      const shops = within(menu).getByRole("menu", { name: "My shops" });
      expect(within(shops).getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
        "Seller's ShopSelling now",
        "other",
      ]);
      fireEvent.click(within(shops).getByRole("menuitem", { name: "other" }));
      expect(where()).toBe("/product-manager/q-store-general-other");
      expect(store.getState().global.recentlyVisitedStoreId).toBe("q-store-general-other");
    });

    it("lists the shops of the account's other names too, and opens one as that name", async () => {
      restore = mockViewport(DESKTOP);
      const searches: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string) => {
          const url = String(input);
          if (url.startsWith("/arbitrary/resources/search")) searches.push(url);
          const rows = url.startsWith("/arbitrary/resources/search")
            ? [
                { name: "Seller Name", service: "STORE", identifier: "q-store-general-my-shop", created: 1, metadata: { title: "Seller's Shop" } },
                { name: "Second Name", service: "STORE", identifier: "q-store-general-second", created: 2, metadata: { title: "Second's Shop" } },
              ]
            : [];
          return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
        })
      );
      const store = sellerStore();
      renderShell({ store });
      openAccountMenu();
      const menu = await screen.findByRole("dialog", { name: "Account menu for Seller Name" });
      const shops = within(menu).getByRole("menu", { name: "My shops" });
      await waitFor(() =>
        expect(within(shops).getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
          "Seller's ShopSelling now",
          "other",
          "Second's ShopAs Second Name",
        ])
      );
      // One search for every name.
      expect(searches).toHaveLength(1);
      expect(new URL(searches[0], "http://x").searchParams.getAll("name").sort()).toEqual(["Second Name", "Seller Name"]);
      fireEvent.click(within(shops).getByRole("menuitem", { name: /^Second's Shop/ }));
      expect(store.getState().auth.user?.name).toBe("Second Name");
      expect(store.getState().global.recentlyVisitedStoreId).toBe("q-store-general-second");
      expect(where()).toBe("/product-manager/q-store-general-second");
      vi.unstubAllGlobals();
    });

    it("opens Create shop, Settings and Messages in Q-Mail", async () => {
      restore = mockViewport(DESKTOP);
      const store = sellerStore();
      renderShell({ store });
      openAccountMenu();
      expect(await screen.findByRole("menuitem", { name: "Messages in Q-Mail" })).toHaveAttribute("href", "qortal://APP/Q-Mail");
      fireEvent.click(screen.getByRole("menuitem", { name: "Open a new shop" }));
      expect(store.getState().global.isOpenCreateStoreModal).toBe(true);
      openAccountMenu();
      fireEvent.click(await screen.findByRole("menuitem", { name: "Settings" }));
      expect(where()).toBe("/settings");
    });

    it("switches the name, remembers it, and leaves the previous name's seller page", async () => {
      restore = mockViewport(DESKTOP);
      const store = sellerStore();
      renderShell({ store, path: "/product-manager/q-store-general-my-shop" });
      openAccountMenu();
      fireEvent.click(await screen.findByRole("menuitemradio", { name: "Second Name" }));
      expect(store.getState().auth.user?.name).toBe("Second Name");
      expect(JSON.parse(localStorage.getItem(ACTIVE_NAME_STORAGE_KEY) || "{}")).toEqual({ [ADDRESS]: "Second Name" });
      expect(store.getState().global.currentStore).toBeNull();
      expect(store.getState().store.myStores).toEqual([]);
      expect(where()).toBe("/");
      expect(screen.getByRole("button", { name: "Account menu for Second Name" })).toBeInTheDocument();
    });

    it("opens the blocked names list", async () => {
      restore = mockViewport(DESKTOP);
      installQortalMock({ GET_LIST_ITEMS: async () => ["spammer"] });
      renderShell({ store: sellerStore() });
      openAccountMenu();
      fireEvent.click(await screen.findByRole("menuitem", { name: "Blocked names" }));
      expect(await screen.findByText("spammer")).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Blocked names" })).toBeInTheDocument();
    });
  });
});

describe("AppShell on a phone", () => {
  it("has the bottom bar instead of the header's navigation, and the account menu as a sheet", async () => {
    restore = mockViewport(PHONE_PORTRAIT);
    renderShell({ store: sellerStore() });
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Shops",
      "Products",
      "Cart",
      "Orders",
      "Sell",
    ]);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    // Five items fill the bar: Settings is in the header.
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Settings" }));
    expect(where()).toBe("/settings");
    openAccountMenu();
    const sheet = await screen.findByRole("dialog", { name: "Seller Name" });
    expect(within(sheet).getByRole("menuitem", { name: "Open a new shop" })).toBeInTheDocument();
  });

  it("offers Sign in in the header when signed out", () => {
    restore = mockViewport(PHONE_PORTRAIT);
    const { authenticate } = renderShell();
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Sign in" }));
    expect(authenticate).toHaveBeenCalledTimes(1);
  });
});
