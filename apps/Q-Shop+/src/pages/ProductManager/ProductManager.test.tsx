/**
 * The seller page inside the app's own wiring (useOwnShops mounted, as in
 * GlobalWrapper): which of the seller's shops is current as they move
 * between their shops, create one, or open a link. The page's tabs and
 * publishing are in seller/products.test.tsx; the pinned publish shapes in
 * ProductManager.pin.test.tsx.
 */
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes, useNavigate, type NavigateFunction } from "react-router-dom";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { resetProducts, toggleCreateStoreModal, updateRecentlyVisitedStoreId } from "../../state/features/globalSlice";
import { resetOrders } from "../../state/features/orderSlice";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installMockNode, makeWorld, type World } from "../../test/mockNode";
import { SELLER, SELLER_ADDRESS, SELLER_PK } from "../../test/fixtures/shop";
import { useOwnShops } from "../../hooks/useOwnShops";
import { ShopDialogs } from "../../components/modals/ShopDialogs";
import { ShellContext } from "../../components/layout/shellState";
import { ProductManager } from "./ProductManager";

vi.mock("../../components/common/ImageUploader", () => ({
  default: ({ label, onPick }: { label: string; onPick: (img: string) => void }) => (
    <button type="button" onClick={() => onPick("data:image/webp;base64,TE9HTw==")}>
      {label}
    </button>
  ),
}));

const SHOP_A = "q-store-general-my-shop";
const SHOP_B = "q-store-general-my-shop-2";
const TITLE_A = "Seller's Shop";
const TITLE_B = "Second shop";

/** The seller with two shops on the node: A (the older, so the original's "current") and B. */
function twoShopWorld(): World {
  const world = makeWorld({ shops: 1, productsPerShop: 3, me: { name: SELLER, address: SELLER_ADDRESS, publicKey: SELLER_PK } });
  const a = world.shops[0];
  world.shops.push({
    ...a,
    shortStoreId: "my-shop-2",
    title: TITLE_B,
    created: a.created + 86_400_000,
    updated: a.updated + 86_400_000,
    products: a.products.map((p) => ({
      ...p,
      id: p.id.replace("-my-shop-", "-my-shop-2-"),
      storeId: SHOP_B,
      shortStoreId: "my-shop-2",
    })),
  });
  return world;
}

const router: { navigate: NavigateFunction } = { navigate: () => {} };
const navigate = (to: string | number) => (typeof to === "number" ? router.navigate(to) : router.navigate(to));
function Navigator() {
  const go = useNavigate();
  useEffect(() => {
    router.navigate = go;
  }, [go]);
  return null;
}

/** What GlobalWrapper mounts around the seller page. */
function SellerApp() {
  useOwnShops();
  return (
    <>
      <Navigator />
      <ShopDialogs />
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route path="/product-manager/:store" element={<ProductManager />} />
      </Routes>
    </>
  );
}

function renderSeller(path: string, world: World) {
  const node = installMockNode(world);
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  const view = renderWithProviders(<SellerApp />, { store, initialEntries: [path] });
  return { ...view, store, node };
}

/** Let every answer of the mock node land (they all come back at once). */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
}

/** The seller page of `title` is up: its tabs, and no skeleton. */
async function expectSellerPage(store: ReturnType<typeof createAppStore>, id: string, title: string) {
  await waitFor(() => expect(store.getState().global.currentStore?.id).toBe(id));
  expect(await screen.findByRole("tablist", { name: "Seller tools" })).toBeInTheDocument();
  await settle();
  expect(store.getState().global.currentStore?.id).toBe(id);
  expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  expect(screen.getByRole("tablist", { name: "Seller tools" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Loading your shop")).toBeNull();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("which of the seller's shops the seller page shows", () => {
  it("Back from another of the seller's shops shows the first one again, not an endless skeleton", async () => {
    const { store } = renderSeller(`/product-manager/${SHOP_A}`, twoShopWorld());
    await expectSellerPage(store, SHOP_A, TITLE_A);

    // The account menu's My shops → the second shop (AccountMenu.openShop).
    act(() => {
      store.dispatch(resetOrders());
      store.dispatch(resetProducts());
      store.dispatch(updateRecentlyVisitedStoreId(SHOP_B));
      navigate(`/product-manager/${SHOP_B}`);
    });
    await expectSellerPage(store, SHOP_B, TITLE_B);

    act(() => navigate(-1));
    await expectSellerPage(store, SHOP_A, TITLE_A);

    // And forward again.
    act(() => navigate(1));
    await expectSellerPage(store, SHOP_B, TITLE_B);
  });

  it("a link to the second shop opens it, even though the first one loads first by default", async () => {
    const { store, node } = renderSeller(`/product-manager/${SHOP_B}`, twoShopWorld());
    await expectSellerPage(store, SHOP_B, TITLE_B);
    // One read of the second shop's JSON and index, the first one's at most once.
    const reads = node.fetchCalls.filter((u) => u.startsWith("/arbitrary/STORE/"));
    expect(reads.filter((u) => u.endsWith(SHOP_B))).toHaveLength(1);
    expect(reads.filter((u) => u.endsWith(SHOP_A)).length).toBeLessThanOrEqual(1);
  });

  it("after creating a second shop, the new one stays current and its seller page opens", async () => {
    const world = twoShopWorld();
    const second = world.shops.pop()!;
    const { store, node } = renderSeller("/", world);
    await waitFor(() => expect(store.getState().global.currentStore?.id).toBe(SHOP_A));
    // The seller had looked at their first shop's page (useShopData sets this).
    act(() => {
      store.dispatch(updateRecentlyVisitedStoreId(SHOP_A));
    });
    node.q.on("PUBLISH_MULTIPLE_QDN_RESOURCES", async () => {
      // Once published, the node serves it.
      world.shops.push(second);
      return true;
    });

    act(() => {
      store.dispatch(toggleCreateStoreModal(true));
    });
    const dialog = await screen.findByRole("dialog", { name: "Create shop" });
    const field = (name: RegExp) => within(dialog).getByRole("textbox", { name });
    fireEvent.change(field(/^Shop id/), { target: { value: "my-shop-2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add shop logo" }));
    fireEvent.change(field(/^Title/), { target: { value: TITLE_B } });
    fireEvent.change(field(/^Description/), { target: { value: "More mugs" } });
    fireEvent.change(field(/^Location/), { target: { value: "Lisbon" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Worldwide" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create shop" }));

    await expectSellerPage(store, SHOP_B, TITLE_B);
    expect(store.getState().global.recentlyVisitedStoreId).toBe(SHOP_B);

    // Back on the first shop's seller page, it becomes current again.
    act(() => navigate(`/product-manager/${SHOP_A}`));
    await expectSellerPage(store, SHOP_A, TITLE_A);
  });
});

describe("before the seller page has a name to work with", () => {
  function renderWithoutName(opts: { user?: { address: string; publicKey: string; name: string }; authenticating: boolean }) {
    const store = createAppStore();
    if (opts.user) store.dispatch(addUser(opts.user));
    const signIn = vi.fn();
    renderWithProviders(
      <ShellContext.Provider value={{ signIn, reloadOwnShops: () => {}, authenticating: opts.authenticating }}>
        <Routes>
          <Route path="/product-manager/:store" element={<ProductManager />} />
        </Routes>
      </ShellContext.Provider>,
      { store, initialEntries: [`/product-manager/${SHOP_A}`] }
    );
    return { signIn };
  }

  it("while the account loads, shows that it is loading (the header has no Sign in then)", () => {
    renderWithoutName({ authenticating: true });
    expect(screen.getByLabelText("Loading your account")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/Sign in/)).toBeNull();
  });

  it("an account without a name is told to register one in Hub, not to sign in", () => {
    renderWithoutName({ user: { address: SELLER_ADDRESS, publicKey: SELLER_PK, name: "" }, authenticating: false });
    expect(screen.getByText("Register a Qortal name in Hub to sell")).toBeInTheDocument();
    expect(screen.queryByText(/Sign in/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("signed out, offers the shell's Sign in on the page", () => {
    const { signIn } = renderWithoutName({ authenticating: false });
    expect(screen.getByText("Sign in to manage your shop")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
