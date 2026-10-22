/**
 * The shop page against the mock node: what it reads (and how often), the
 * product list's filters, sorts, search and paging, Add to cart, share
 * links, and its loading, missing and "fetching from peers" states.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { installMockNode, makeWorld, type World } from "../../../test/mockNode";
import { addUser } from "../../../state/features/authSlice";
import { setCatalogueHashMap } from "../../../state/features/globalSlice";
import { createAppStore } from "../../../state/store";
import { setPeerRetryDelaysForTests } from "../peerRetry";
import { getShopDetails, resetShopDetails } from "../../../discovery/shopDetails";
import { shopKey } from "../../../discovery/shopIndex";
import { noteDeletedShop, resetDeletedShops } from "../../../qdn/deleted";
import { resetProductView } from "../../../utils/productView";
import { SETTINGS_STORAGE_KEY } from "../../../constants/plus";
import { Store } from "./Store";

const copyText = vi.fn(async (_text: string) => true);
vi.mock("../../../utils/clipboard", () => ({ copyText: (text: string) => copyText(text) }));

const SHOP_PATH = "/Seller%20Name/q-store-general-my-shop";
const STORE_ID = "q-store-general-my-shop";

let restoreDelays: (() => void) | null = null;
beforeEach(() => {
  copyText.mockClear();
  resetShopDetails();
  resetDeletedShops();
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  resetProductView();
  restoreDelays = setPeerRetryDelaysForTests([30, 30, 30]);
});
afterEach(() => {
  restoreDelays?.();
  vi.unstubAllGlobals();
});

function renderShop(world: World, path = SHOP_PATH, me: { name: string } | null = world.me) {
  const node = installMockNode(world);
  const store = createAppStore();
  if (me) store.dispatch(addUser({ address: "QAddr", publicKey: "pk", name: me.name }));
  const view = renderWithProviders(
    <Routes>
      <Route path="/:user/:store" element={<Store />} />
      <Route path="/:user/:store/:product/:catalogue" element={<div>Product page</div>} />
      <Route path="/cart" element={<div>Cart page</div>} />
      <Route path="/product-manager/:store" element={<div>Seller page</div>} />
    </Routes>,
    { initialEntries: [path], store }
  );
  return { node, ...view };
}

const searchUrls = (node: ReturnType<typeof installMockNode>) => node.fetchCalls.filter((u) => u.startsWith("/arbitrary/resources/search"));
const catalogueFetches = (node: ReturnType<typeof installMockNode>) =>
  node.fetchCalls.filter((u) => u.startsWith("/arbitrary/DOCUMENT/") && u.includes("q-store-catalogue-"));
const cardTitles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("shop page", { timeout: 20_000 }, () => {
  it("shows the shop: title as the page heading, owner, rating from the shared review search, coins", async () => {
    const { node } = renderShop(makeWorld());
    expect(await screen.findByRole("heading", { level: 1, name: "Seller's Shop" })).toBeInTheDocument();
    expect(screen.getByText("Seller Name")).toBeInTheDocument();
    // Six reviews of 3, 3.5, 4, 3, 3.5, 4.
    expect(await screen.findByRole("button", { name: /Rated 3\.5 out of 5 from 6 reviews/ })).toBeInTheDocument();
    const coins = screen.getByRole("list", { name: "Accepted coins" });
    expect(within(coins).getByText("QORT")).toBeInTheDocument();
    expect(within(coins).getByText("ARRR")).toBeInTheDocument();
    expect(screen.getByText("Lisbon")).toBeInTheDocument();
    expect(screen.getByText("Ships to Europe")).toBeInTheDocument();
    const mail = screen.getByRole("link", { name: /Message seller/ });
    expect(mail).toHaveAttribute("href", "qortal://APP/Q-Mail+/to/Seller%20Name");

    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    // No unlimited search; the review search is the only one (no shop search, no limit-0 container search).
    const searches = searchUrls(node);
    expect(searches.every((u) => /[?&]limit=[1-9]/.test(u))).toBe(true);
    expect(searches).toHaveLength(1);
    expect(searches[0]).toContain("identifier=q-store-review-my-shop-");
    expect(node.q.callsFor("SEARCH_QDN_RESOURCES")).toHaveLength(0);
    expect(node.fetchCalls.filter((u) => u.startsWith("/arbitrary/STORE/"))).toHaveLength(1);
    expect(node.fetchCalls.filter((u) => u.endsWith("-datacontainer"))).toHaveLength(1);
  });

  it("fetches catalogues only for the 20 products on screen, once each, and more on Show more", async () => {
    const { node } = renderShop(makeWorld({ productsPerShop: 45 }));
    await waitFor(() => expect(cardTitles()).toHaveLength(20));
    // Newest first: products 44…25 live in catalogues 4, 3 and 2.
    expect(cardTitles()[0]).toBe("Product 44");
    expect(catalogueFetches(node).map((u) => u.split("-").pop())).toEqual(["CAT0000004", "CAT0000003", "CAT0000002"]);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(cardTitles()).toHaveLength(40));
    expect(catalogueFetches(node)).toHaveLength(5);
    expect(screen.getByText("45 products")).toBeInTheDocument();
  });

  it("filters by category and stock and sorts by the QORT price, from the index", async () => {
    const { node } = renderShop(makeWorld());
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    fireEvent.click(screen.getByRole("button", { name: "Art" }));
    await waitFor(() => expect(cardTitles()).toHaveLength(6));
    expect(cardTitles()).toEqual(["Product 11", "Product 9", "Product 7", "Product 5", "Product 3", "Product 1"]);
    fireEvent.click(screen.getByLabelText("In stock only"));
    await waitFor(() => expect(cardTitles()).not.toContain("Product 5"));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "price-asc" } });
    await waitFor(() => expect(cardTitles()).toEqual(["Product 1", "Product 3", "Product 7", "Product 9", "Product 11"]));
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByLabelText("In stock only"));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "price-desc" } });
    await waitFor(() => expect(cardTitles()[0]).toBe("Product 11"));
    expect(cardTitles()[11]).toMatch(/^A product with a long title/);
    // Filtering and sorting read no more catalogues than the 12 products need.
    expect(catalogueFetches(node)).toHaveLength(2);
  });

  it("adds one to the cart with the viewed shop's id and owner, and offers to view the cart", async () => {
    const { store } = renderShop(makeWorld());
    const add = await screen.findByRole("button", { name: "Add to cart: Product 11" });
    fireEvent.click(add);
    const cart = store.getState().cart.carts[STORE_ID];
    expect(cart.storeOwner).toBe("Seller Name");
    expect(cart.storeId).toBe(STORE_ID);
    expect(cart.orders["q-store-product-my-shop-P000000011"]).toEqual({
      productId: "q-store-product-my-shop-P000000011",
      catalogueId: "q-store-catalogue-my-shop-CAT0000001",
      quantity: 1,
    });
    expect(await screen.findByText("Added to cart · Product 11")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View cart" }));
    expect(await screen.findByText("Cart page")).toBeInTheDocument();
  });

  it("can't add out-of-stock products", async () => {
    renderShop(makeWorld());
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    expect(screen.getByRole("button", { name: "Out of stock" })).toBeDisabled();
  });

  it("can't add your own products, and shows the owner's actions instead of Message seller", async () => {
    renderShop(makeWorld(), SHOP_PATH, { name: "Seller Name" });
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Your product" })).toHaveLength(12));
    screen.getAllByRole("button", { name: "Your product" }).forEach((b) => expect(b).toBeDisabled());
    expect(screen.getByRole("button", { name: /Seller page/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Message seller/ })).toBeNull();
  });

  it("copies share links for the viewed shop, and for its products (not your own shop's id)", async () => {
    renderShop(makeWorld());
    fireEvent.click(await screen.findByRole("button", { name: "Share" }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith("qortal://APP/Q-Shop+/Seller%20Name/q-store-general-my-shop"));
    const card = (await screen.findByRole("heading", { level: 3, name: "Product 11" })).closest("article")!;
    fireEvent.contextMenu(card);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Copy link/ }));
    await waitFor(() =>
      expect(copyText).toHaveBeenLastCalledWith(
        "qortal://APP/Q-Shop+/Seller%20Name/q-store-general-my-shop/q-store-product-my-shop-P000000011/q-store-catalogue-my-shop-CAT0000001"
      )
    );
  });

  it("links each card to its product page", async () => {
    renderShop(makeWorld());
    const link = await screen.findByRole("link", { name: "Product 11" });
    expect(link).toHaveAttribute(
      "href",
      "/Seller%20Name/q-store-general-my-shop/q-store-product-my-shop-P000000011/q-store-catalogue-my-shop-CAT0000001"
    );
  });

  it("shows prices in the picked coin with the node's rate", async () => {
    renderShop(makeWorld());
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    fireEvent.change(screen.getByRole("combobox", { name: "Prices in" }), { target: { value: "ARRR" } });
    expect(await screen.findByText("1 QORT ≈ 0.25 ARRR · Trade Portal rate")).toBeInTheDocument();
    // Product 11 costs 12 QORT: 3 ARRR at 0.25.
    const card = screen.getByRole("heading", { level: 3, name: "Product 11" }).closest("article")!;
    expect(within(card).getByText("3.00")).toBeInTheDocument();
  });

  it("searches titles and descriptions, reading the remaining catalogues", async () => {
    const { node } = renderShop(makeWorld({ productsPerShop: 45 }));
    await waitFor(() => expect(cardTitles()).toHaveLength(20));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search this shop" }), { target: { value: "wraps" } });
    await waitFor(() => expect(cardTitles()).toEqual(["A product with a long title that wraps over two lines on phones"]));
    expect(screen.getByText("1 result for “wraps”")).toBeInTheDocument();
    expect(catalogueFetches(node)).toHaveLength(5);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search this shop" }), { target: { value: "nothing like it" } });
    expect(await screen.findByText("No products match “nothing like it”")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all products" }));
    await waitFor(() => expect(cardTitles()).toHaveLength(20));
  });

  it("stops a search at 30 catalogues and says so", async () => {
    const { node } = renderShop(makeWorld({ productsPerShop: 320 }));
    await waitFor(() => expect(cardTitles()).toHaveLength(20));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search this shop" }), { target: { value: "wraps" } });
    expect(await screen.findByText(/Only the first 300 products were searched/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(catalogueFetches(node)).toHaveLength(30);
  });

  it("says when a shop doesn't exist, after one exact existence search", async () => {
    const { node } = renderShop(makeWorld(), "/Nobody/q-store-general-nothing");
    expect(await screen.findByText("Shop not found")).toBeInTheDocument();
    const exists = searchUrls(node).filter((u) => u.includes("service=STORE"));
    expect(exists).toHaveLength(1);
    expect(exists[0]).toContain("prefix=true");
    expect(exists[0]).toContain("identifier=q-store-general-nothing");
  });

  it("shows the shop's collections; one opens on its products, with its description and a share link", async () => {
    const world = makeWorld();
    const ids = world.shops[0].products.map((p) => p.id);
    world.shops[0].collections = [
      { id: "GIFTSxxxx1", title: "Gifts", description: "For friends\nand family", image: "data:image/webp;base64,R0lGVA==", products: [ids[1], ids[2]] },
      { id: "GONExxxxx2", title: "Empty one", products: ["q-store-product-my-shop-NOPExxxxx9"] },
    ];
    const { node } = renderShop(world);
    expect(await screen.findByRole("region", { name: "Collections" })).toBeInTheDocument();
    const gifts = await screen.findByRole("link", { name: /Gifts/ });
    expect(gifts).toHaveAttribute("href", "/Seller%20Name/q-store-general-my-shop?collection=GIFTSxxxx1");
    expect(within(gifts).getByText("2 products")).toBeInTheDocument();
    // A collection with none of the shop's products isn't offered.
    expect(screen.queryByRole("link", { name: /Empty one/ })).toBeNull();
    expect(node.fetchCalls.filter((u) => u.includes("q-store-collections-"))).toEqual([
      "/arbitrary/DOCUMENT/Seller%20Name/q-store-collections-my-shop",
    ]);

    fireEvent.click(gifts);
    expect(await screen.findByRole("heading", { level: 2, name: "Gifts" })).toBeInTheDocument();
    expect(screen.getByText(/For friends/)).toBeInTheDocument();
    expect(gifts).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(cardTitles()).toEqual(["Product 2", "Product 1"]));
    fireEvent.click(screen.getByRole("button", { name: "Share collection" }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith("qortal://APP/Q-Shop+/Seller%20Name/q-store-general-my-shop?collection=GIFTSxxxx1"));

    fireEvent.click(screen.getByRole("link", { name: "All products" }));
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    expect(screen.getByRole("heading", { level: 2, name: "Products" })).toBeInTheDocument();
  });

  it("offers Retry when the shop's collections can't be read for a collection link", async () => {
    const world = makeWorld();
    world.shops[0].collections = [{ id: "GIFTSxxxx1", title: "Gifts", products: [world.shops[0].products[1].id] }];
    const { node } = renderShop(world, `${SHOP_PATH}?collection=GIFTSxxxx1`);
    const serve = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let down = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string): Promise<unknown> =>
        down && String(url).includes("q-store-collections-") ? { ok: false, status: 500, text: async (): Promise<string> => "{}" } : serve(url)
      )
    );
    expect(await screen.findByText(/collections aren.t available on your node right now/)).toBeInTheDocument();
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    down = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Gifts" })).toBeInTheDocument();
    expect(node.fetchCalls.length).toBeGreaterThan(0);
  });

  it("reads no collections for a shop without them, and shows everything for a collection link that's gone", async () => {
    const { node } = renderShop(makeWorld(), `${SHOP_PATH}?collection=OLDxxxxxx1`);
    expect(await screen.findByText(/That collection isn.t in this shop any more/)).toBeInTheDocument();
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    expect(node.fetchCalls.filter((u) => u.includes("q-store-collections-"))).toEqual([]);
    expect(screen.queryByRole("region", { name: "Collections" })).toBeNull();
  });

  it("shows products as a grid or a list, as the buyer chooses, and remembers it", async () => {
    renderShop(makeWorld());
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    const grid = screen.getByRole("button", { name: "Grid" });
    // Automatic is tiles on a wide screen: no description in the cards.
    expect(grid).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Description of product 3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    // Rows show the start of each description.
    expect(screen.getByText("Description of product 3")).toBeInTheDocument();
    expect(cardTitles()).toHaveLength(12);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({ productView: "list" });
    fireEvent.click(grid);
    expect(screen.queryByText("Description of product 3")).toBeNull();
  });

  it("says when its owner deleted the shop, from one read: no retries, no existence search, gone from home", async () => {
    const world = makeWorld();
    world.shops[0].deleted = "plain";
    const { node } = renderShop(world);
    expect(await screen.findByText("This shop was deleted")).toBeInTheDocument();
    expect(screen.getByText("Seller Name deleted this shop. Orders you placed there stay in My orders.")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(node.fetchCalls.filter((u) => u.startsWith("/arbitrary/STORE/"))).toHaveLength(1);
    expect(searchUrls(node).filter((u) => u.includes("service=STORE"))).toEqual([]);
    expect(screen.queryByText(/Fetching from peers/)).not.toBeInTheDocument();
    expect(getShopDetails(shopKey("Seller Name", STORE_ID))).toMatchObject({ status: "ready", valid: false, deleted: true });
    fireEvent.click(screen.getByRole("button", { name: "Browse shops" }));
  });

  it("says a shop this browser just deleted is deleted, while the node may still serve it", async () => {
    noteDeletedShop("Seller Name", STORE_ID);
    const { node } = renderShop(makeWorld());
    expect(await screen.findByText("This shop was deleted")).toBeInTheDocument();
    expect(node.fetchCalls.filter((u) => u.startsWith("/arbitrary/STORE/") || u.endsWith("-datacontainer"))).toEqual([]);
  });

  it("says Fetching from peers while the node gets the shop, then shows it", async () => {
    const world = makeWorld();
    const node = installMockNode(world);
    const realFetch = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let failures = 2;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/arbitrary/STORE/") && failures-- > 0) {
          return { ok: false, status: 404, text: async () => '{"error":1401,"message":"not found"}', json: async () => ({}) };
        }
        return realFetch(url);
      })
    );
    restoreDelays?.();
    restoreDelays = setPeerRetryDelaysForTests([150, 150, 150]);
    const store = createAppStore();
    renderWithProviders(
      <Routes>
        <Route path="/:user/:store" element={<Store />} />
      </Routes>,
      { initialEntries: [SHOP_PATH], store }
    );
    expect(await screen.findByText("Fetching from peers…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Seller's Shop" }, { timeout: 3000 })).toBeInTheDocument();
    expect(node).toBeTruthy();
  });

  it("gives up after the retries with a Retry button that reads the shop again", async () => {
    const world = makeWorld();
    installMockNode(world);
    const realFetch = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let broken = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (broken && url.endsWith("-datacontainer")) {
          return { ok: false, status: 500, text: async () => "oops", json: async () => ({}) };
        }
        return realFetch(url);
      })
    );
    renderWithProviders(
      <Routes>
        <Route path="/:user/:store" element={<Store />} />
      </Routes>,
      { initialEntries: [SHOP_PATH] }
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Seller's Shop" })).toBeInTheDocument();
    expect(await screen.findByText("Not available on your node right now", {}, { timeout: 3000 })).toBeInTheDocument();
    broken = false;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    // The shop stays on screen while its products load again.
    expect(screen.getByRole("heading", { level: 1, name: "Seller's Shop" })).toBeInTheDocument();
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
  });

  it("shows a shop whose JSON has fields of the wrong type (it crashed the whole app)", async () => {
    const world = makeWorld();
    installMockNode(world);
    const realFetch = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    const { storeJsonOf } = await import("../../../test/mockNode");
    const odd = { ...storeJsonOf(world.shops[0]), supportedCoins: 1, foreignCoins: { ARRR: 5 }, acceptedAssets: {}, location: { city: "Lisbon" } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/arbitrary/STORE/")
          ? { ok: true, status: 200, text: async () => JSON.stringify(odd), json: async () => odd }
          : realFetch(url)
      )
    );
    renderWithProviders(
      <Routes>
        <Route path="/:user/:store" element={<Store />} />
      </Routes>,
      { initialEntries: [SHOP_PATH] }
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Seller's Shop" })).toBeInTheDocument();
    const coins = screen.getByRole("list", { name: "Accepted coins" });
    expect(within(coins).getByText("QORT")).toBeInTheDocument();
    expect(within(coins).queryByText("ARRR")).toBeNull();
    expect(screen.queryByText("Lisbon")).toBeNull();
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
  });

  it("shows the other products when one can't be shown", async () => {
    const world = makeWorld();
    installMockNode(world);
    const realFetch = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    const { catalogueOf } = await import("../../../test/mockNode");
    const cat = catalogueOf(world.shops[0], "q-store-catalogue-my-shop-CAT0000001")!;
    cat.products["q-store-product-my-shop-P000000011"].title = { en: "Odd" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/q-store-catalogue-my-shop-CAT0000001")
          ? { ok: true, status: 200, text: async () => JSON.stringify(cat), json: async () => cat }
          : realFetch(url)
      )
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      renderWithProviders(
        <Routes>
          <Route path="/:user/:store" element={<Store />} />
        </Routes>,
        { initialEntries: [SHOP_PATH] }
      );
      expect(await screen.findByText("This product couldn't be shown.")).toBeInTheDocument();
      await waitFor(() => expect(cardTitles()).toHaveLength(11));
      expect(screen.getByRole("heading", { level: 1, name: "Seller's Shop" })).toBeInTheDocument();
    } finally {
      error.mockRestore();
    }
  });

  it("shows the owner's products, not another name's copies published under the same catalogue ids", async () => {
    const world = makeWorld();
    const node = installMockNode(world);
    const store = createAppStore();
    store.dispatch(
      setCatalogueHashMap({
        id: "q-store-catalogue-my-shop-CAT0000001",
        user: "Mallory",
        isValid: true,
        products: {
          "q-store-product-my-shop-P000000011": { title: "Pay me directly", price: [{ currency: "qort", value: 1 }], status: "AVAILABLE" },
          "q-store-product-my-shop-P000000010": { title: "Pay me directly too", price: [{ currency: "qort", value: 1 }], status: "AVAILABLE" },
        },
      })
    );
    renderWithProviders(
      <Routes>
        <Route path="/:user/:store" element={<Store />} />
      </Routes>,
      { initialEntries: [SHOP_PATH], store }
    );
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    expect(cardTitles()).toContain("Product 11");
    expect(cardTitles()).not.toContain("Pay me directly");
    expect(catalogueFetches(node).filter((u) => u.includes("CAT0000001"))).toEqual([
      "/arbitrary/DOCUMENT/Seller%20Name/q-store-catalogue-my-shop-CAT0000001",
    ]);
  });

  it("tells a buyer the shop has no products, and the owner how to add some", async () => {
    const world = makeWorld({ productsPerShop: 0 });
    renderShop(world);
    expect(await screen.findByText("This shop hasn't listed anything for sale.")).toBeInTheDocument();
  });

  it("opens shop details and the reviews", async () => {
    const { node } = renderShop(makeWorld());
    fireEvent.click(await screen.findByRole("button", { name: "Details" }));
    const details = await screen.findByRole("dialog", { name: "Shop details" });
    expect(within(details).getByText("Everything shop 0 sells")).toBeInTheDocument();
    expect(within(details).getByText("Lisbon")).toBeInTheDocument();
    fireEvent.click(within(details).getByRole("button", { name: "Close" }));

    fireEvent.click(await screen.findByRole("button", { name: /Rated 3\.5 out of 5/ }));
    const reviews = await screen.findByRole("dialog", { name: "Reviews · Seller's Shop" });
    await waitFor(() => expect(within(reviews).getAllByRole("article")).toHaveLength(6));
    // The panel reuses the header's review search.
    expect(searchUrls(node).filter((u) => u.includes("q-store-review-"))).toHaveLength(1);
  });
});

describe("shop page on a phone", { timeout: 20_000 }, () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: /max-width:\s*599/.test(query),
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }),
    });
  });

  it("moves categories and stock into a Filters sheet", async () => {
    renderShop(makeWorld());
    await waitFor(() => expect(cardTitles()).toHaveLength(12));
    expect(screen.queryByRole("group", { name: "Categories" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Kitchen" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Show 6 products" }));
    await waitFor(() => expect(cardTitles()).toHaveLength(6));
    expect(screen.getByRole("button", { name: "Filters (1)" })).toBeInTheDocument();
  });
});
