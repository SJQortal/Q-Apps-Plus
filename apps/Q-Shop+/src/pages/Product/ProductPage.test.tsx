/**
 * The product page against the mock node: deep links, what it reads, the
 * quantity stepper and Add to cart, share link, own and unavailable
 * products, and not-found.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installMockNode, makeWorld, type World } from "../../test/mockNode";
import { addUser } from "../../state/features/authSlice";
import { setCatalogueHashMap } from "../../state/features/globalSlice";
import { createAppStore } from "../../state/store";
import { setPeerRetryDelaysForTests } from "../Store/peerRetry";
import { clampQuantity, ProductPage } from "./ProductPage";

const copyText = vi.fn(async (_text: string) => true);
vi.mock("../../utils/clipboard", () => ({ copyText: (text: string) => copyText(text) }));

const STORE_ID = "q-store-general-my-shop";
const P11 = "q-store-product-my-shop-P000000011";
const CAT1 = "q-store-catalogue-my-shop-CAT0000001";
const pathOf = (product: string, catalogue = CAT1) => `/Seller%20Name/${STORE_ID}/${product}/${catalogue}`;

let restore: (() => void) | null = null;
beforeEach(() => {
  copyText.mockClear();
  restore = setPeerRetryDelaysForTests([10, 10, 10]);
});
afterEach(() => {
  restore?.();
  vi.unstubAllGlobals();
});

function renderProduct(world: World, path: string, me: string | null = world.me?.name ?? null, store = createAppStore()) {
  const node = installMockNode(world);
  if (me) store.dispatch(addUser({ address: "QAddr", publicKey: "pk", name: me }));
  const view = renderWithProviders(
    <Routes>
      <Route path="/:user/:store/:product/:catalogue" element={<ProductPage />} />
      <Route path="/:user/:store" element={<div>Shop page</div>} />
      <Route path="/cart" element={<div>Cart page</div>} />
    </Routes>,
    { initialEntries: [path], store }
  );
  return { node, ...view };
}

describe("product page", { timeout: 20_000 }, () => {
  it("opens from a deep link: the catalogue and the shop JSON, no search and no product index", async () => {
    const { node } = renderProduct(makeWorld(), pathOf(P11));
    expect(await screen.findByRole("heading", { level: 1, name: "Product 11" })).toBeInTheDocument();
    expect(screen.getByText("12.00")).toBeInTheDocument();
    expect(screen.getByText("Digital")).toBeInTheDocument();
    expect(screen.getByText("Art")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.getByText("Description of product 11")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("link", { name: "Seller's Shop" })).toHaveAttribute("href", `/Seller%20Name/${STORE_ID}`));
    expect(node.fetchCalls.filter((u) => u.includes("resources/search"))).toEqual([]);
    expect(node.fetchCalls.filter((u) => u.includes(CAT1))).toHaveLength(1);
    expect(node.fetchCalls.filter((u) => u.endsWith("-datacontainer"))).toHaveLength(0);
    expect(node.q.calls.filter((c) => c.action === "FETCH_QDN_RESOURCE")).toHaveLength(0);
  });

  it("uses a catalogue a list already read, without fetching it", async () => {
    const world = makeWorld();
    const store = createAppStore();
    const { catalogueOf } = await import("../../test/mockNode");
    store.dispatch(setCatalogueHashMap({ ...catalogueOf(world.shops[0], CAT1), user: "Seller Name", isValid: true }));
    const { node } = renderProduct(world, pathOf(P11), null, store);
    expect(await screen.findByRole("heading", { level: 1, name: "Product 11" })).toBeInTheDocument();
    expect(node.fetchCalls.filter((u) => u.includes(CAT1))).toHaveLength(0);
  });

  it("shows the owner's product, not another name's copy published under the same catalogue id", async () => {
    const store = createAppStore();
    store.dispatch(
      setCatalogueHashMap({
        id: CAT1,
        user: "Mallory",
        isValid: true,
        products: { [P11]: { title: "Pay me directly", description: "Send QORT to Mallory", price: [{ currency: "qort", value: 1 }], status: "AVAILABLE" } },
      })
    );
    const { node } = renderProduct(makeWorld(), pathOf(P11), null, store);
    expect(await screen.findByRole("heading", { level: 1, name: "Product 11" })).toBeInTheDocument();
    expect(screen.queryByText("Send QORT to Mallory")).toBeNull();
    expect(node.fetchCalls.filter((u) => u.includes(CAT1))).toEqual([`/arbitrary/DOCUMENT/Seller%20Name/${CAT1}`]);
  });

  it("puts the price and Add to cart beside a frame-high picture on a phone held sideways", async () => {
    renderProduct(makeWorld(), pathOf(P11));
    await screen.findByRole("heading", { level: 1, name: "Product 11" });
    // jsdom applies no media queries: read the rules the page's elements get on a landscape phone.
    const css = [...document.querySelectorAll("style")].map((style) => style.textContent ?? "").join("\n");
    const landscape = /@media\s*\(pointer:\s*coarse\)\s*and\s*\(max-height:\s*500px\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
    const blocks = [...css.matchAll(landscape)].map((m) => m[1]);
    const rulesFor = (el: Element) => {
      const classes = [...el.classList].filter((c) => c.startsWith("css-"));
      return blocks.filter((block) => classes.some((c) => block.includes(`.${c}`))).join("\n");
    };
    const layout = document.querySelector("[data-product-layout]")!;
    expect(rulesFor(layout)).toMatch(/grid-template-columns:\s*auto minmax\(0, 1fr\)/);
    const gallery = screen.getByRole("region", { name: "Product 11: pictures" });
    expect(rulesFor(gallery)).toContain("width:min(42vw, max(148px, calc(var(--qshare-app-height, 100dvh) - 120px)))");
    // The price and Add to cart are in the column beside the gallery.
    expect(layout.children[1]).toContainElement(screen.getByRole("button", { name: "Add to cart" }));
  });

  it("adds the chosen quantity to the cart, 1 to 99", async () => {
    const { store } = renderProduct(makeWorld(), pathOf(P11));
    await screen.findByRole("heading", { level: 1, name: "Product 11" });
    const input = screen.getByRole("textbox", { name: "Quantity" });
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(input).toHaveValue("3");
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(store.getState().cart.carts[STORE_ID]).toMatchObject({
      storeId: STORE_ID,
      storeOwner: "Seller Name",
      orders: { [P11]: { productId: P11, catalogueId: CAT1, quantity: 3 } },
    });
    expect(await screen.findByText("Added to cart · 3 × Product 11")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "1x50" } });
    expect(input).toHaveValue("15");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("1");
  });

  it("copies the product's link", async () => {
    renderProduct(makeWorld(), pathOf(P11));
    fireEvent.click(await screen.findByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(copyText).toHaveBeenCalledWith(`qortal://APP/Q-Shop+/Seller%20Name/${STORE_ID}/${P11}/${CAT1}`)
    );
  });

  it("offers no Add to cart for an out-of-stock product, nor your own", async () => {
    renderProduct(makeWorld(), pathOf("q-store-product-my-shop-P000000005", "q-store-catalogue-my-shop-CAT0000000"));
    expect(await screen.findByText(/Out of stock/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
  });

  it("tells the owner it's their product", async () => {
    renderProduct(makeWorld(), pathOf(P11), "Seller Name");
    expect(await screen.findByText("This is your product.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Cart/ })).toBeNull();
  });

  it("keeps the page when the product's data can't be shown (it crashed the whole app)", async () => {
    const world = makeWorld();
    const store = createAppStore();
    const { catalogueOf } = await import("../../test/mockNode");
    const cat = catalogueOf(world.shops[0], CAT1)!;
    cat.products[P11] = { ...cat.products[P11], title: { en: "Odd" } };
    cat.products["q-store-product-my-shop-P000000012"] = { ...cat.products[P11], title: "Odd price", price: { qort: 1 } };
    store.dispatch(setCatalogueHashMap({ ...cat, user: "Seller Name", isValid: true }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { unmount } = renderProduct(world, pathOf(P11), null, store);
      // A title that isn't text: the page shows the rest.
      expect(await screen.findByRole("heading", { level: 1, name: "Product" })).toBeInTheDocument();
      expect(screen.getByText("Description of product 11")).toBeInTheDocument();
      unmount();
      // A price list that isn't a list: the header and a way back stay.
      renderProduct(world, pathOf("q-store-product-my-shop-P000000012"), null, store);
      expect(await screen.findByText("This product couldn't be shown")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Odd price" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Go to the shop" }));
      expect(await screen.findByText("Shop page")).toBeInTheDocument();
    } finally {
      error.mockRestore();
    }
  });

  it("says plainly when the product isn't there (no template text)", async () => {
    renderProduct(makeWorld(), pathOf("q-store-product-my-shop-GONE000000"));
    expect(await screen.findByRole("heading", { level: 1, name: "Product not found" })).toBeInTheDocument();
    expect(screen.getByText("This product isn't in the shop any more")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("${");
    fireEvent.click(screen.getByRole("button", { name: "Go to the shop" }));
    expect(await screen.findByText("Shop page")).toBeInTheDocument();
  });

  it("says not found when the catalogue doesn't exist, after one exact existence search", async () => {
    const { node } = renderProduct(makeWorld(), pathOf(P11, "q-store-catalogue-my-shop-NOPE000000"));
    expect(await screen.findByRole("heading", { level: 1, name: "Product not found" })).toBeInTheDocument();
    const searches = node.fetchCalls.filter((u) => u.includes("resources/search"));
    expect(searches).toHaveLength(1);
    expect(searches[0]).toContain("prefix=true");
  });
});

describe("clampQuantity", () => {
  it("keeps quantities whole and between 1 and 99", () => {
    expect(clampQuantity("")).toBe(1);
    expect(clampQuantity("0")).toBe(1);
    expect(clampQuantity("2.7")).toBe(2);
    expect(clampQuantity(150)).toBe(99);
    expect(clampQuantity("abc")).toBe(1);
  });
});
