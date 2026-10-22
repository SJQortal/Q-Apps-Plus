/**
 * The Products page against the mock node (24 shops of 12 products; shop 23
 * has the newest products, Product 11 first): what it shows, and what it
 * asks the node for.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { ProductsPage, resetProductsMemory } from "./ProductsPage";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installMockNode, makeWorld, type World } from "../../test/mockNode";
import { mockViewport, PHONE_PORTRAIT } from "../../test/viewport";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { cartFor } from "../../state/features/cartSlice";
import { resetShopIndexMemory } from "../../discovery/shopIndex";
import { resetActivityMemory } from "../../discovery/activity";
import { INDEX_BATCH } from "../../discovery/allProducts";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderProducts(options: { path?: string; world?: World; user?: string } = {}) {
  const node = installMockNode(options.world ?? makeWorld());
  const store = createAppStore();
  if (options.user) store.dispatch(addUser({ address: "QAddress", publicKey: "pk", name: options.user }));
  const view = renderWithProviders(
    <>
      <ProductsPage />
      <LocationProbe />
    </>,
    { initialEntries: [options.path ?? "/products"], store }
  );
  return { ...view, node, store };
}

const cards = () => screen.queryAllByRole("article");
const titles = () => cards().map((card) => within(card).getAllByRole("link")[0].textContent);
const location = () => screen.getByTestId("location").textContent;
/** A card's shop link: its name says it is the shop. */
const shopLink = (title: string) => `Shop: ${title}`;
const dataContainers = (node: ReturnType<typeof installMockNode>) => node.summary().resources["data container"] ?? 0;

beforeEach(() => {
  resetShopIndexMemory();
  resetActivityMemory();
  resetProductsMemory();
});

describe("Products", () => {
  it("lists every shop's newest products, reading only the newest shops' lists and the catalogues on screen", async () => {
    const { node } = renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(20));
    await waitFor(() => expect(titles()[0]).toBe("Product 11"));
    // Shop 23's twelve, then shop 22's newest eight.
    expect(titles().slice(0, 3)).toEqual(["Product 11", "Product 10", "Product 9"]);
    const first = cards()[0];
    expect(within(first).getByRole("link", { name: shopLink("Shop number 23") })).toHaveAttribute("href", "/Seller%2023/q-store-general-shop-23");
    expect(within(cards()[12]).getByRole("link", { name: shopLink("Shop number 22") })).toBeInTheDocument();
    expect(within(first).getByText("QORT")).toBeInTheDocument();

    const summary = node.summary();
    expect(summary.searches).toEqual({ STORE: 1, DOCUMENT: 1 });
    expect(summary.unlimitedSearches).toBe(0);
    expect(dataContainers(node)).toBe(INDEX_BATCH);
    // Two catalogues of shop 23, two of shop 22.
    expect(summary.resources.DOCUMENT).toBe(4);
    expect(screen.getByText("Newest first")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(cards()).toHaveLength(40));
  });

  it("filters by one or several categories across every shop, whatever case the sellers typed", async () => {
    const world = makeWorld({ shops: 6, productsPerShop: 4 });
    world.shops[2].products.forEach((p) => (p.category = " kitchen "));
    world.shops[4].products[0].category = "Zines";
    const { node } = renderProducts({ world });
    await waitFor(() => expect(cards()).toHaveLength(20));

    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    const dialog = await screen.findByRole("dialog", { name: "Categories" });
    const group = await within(dialog).findByRole("group", { name: "Categories" });
    // Every shop's list is read to know them all.
    expect(dataContainers(node)).toBe(6);
    // The biggest first, each named with its count; " kitchen " is Kitchen.
    const boxes = ["Kitchen, 13 products", "Art, 10 products", "Zines, 1 product"].map((name) =>
      within(group).getByRole("checkbox", { name })
    );
    expect(within(group).getAllByRole("checkbox")).toEqual(boxes);

    fireEvent.click(within(group).getByRole("checkbox", { name: /Zines/ }));
    await waitFor(() => expect(screen.getByText("1 product")).toBeInTheDocument());
    expect(location()).toBe("/products?category=zines");
    fireEvent.click(within(group).getByRole("checkbox", { name: /Art/ }));
    await waitFor(() => expect(screen.getByText("11 products")).toBeInTheDocument());
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(cards()).toHaveLength(11));
    expect(titles().filter((title) => title?.startsWith("A product with a long title"))).toHaveLength(1);

    // The chosen categories show as chips; one tap takes one off.
    const chosen = screen.getByRole("group", { name: "Chosen categories" });
    fireEvent.click(within(chosen).getByRole("button", { name: "Zines" }));
    await waitFor(() => expect(cards()).toHaveLength(10));
    expect(location()).toBe("/products?category=art");
  });

  it("puts a heading between the page's and the cards' (axe heading-order)", async () => {
    renderProducts({ world: makeWorld({ shops: 2, productsPerShop: 2 }) });
    await waitFor(() => expect(cards()).toHaveLength(4));
    const levels = screen.getAllByRole("heading").map((h) => Number(h.tagName.slice(1)));
    expect(levels.slice(0, 3)).toEqual([1, 2, 3]);
  });

  it("lists the categories every shop picks from first, and the sellers' own words under Other categories", async () => {
    const world = makeWorld({ shops: 2, productsPerShop: 3 });
    world.shops[0].products.forEach((p) => (p.category = "toys & hobbies"));
    world.shops[1].products.forEach((p, i) => (p.category = i === 0 ? "Baby" : "flower"));
    renderProducts({ world });
    await waitFor(() => expect(cards()).toHaveLength(6));
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    const dialog = await screen.findByRole("dialog", { name: "Categories" });
    const group = await within(dialog).findByRole("group", { name: "Categories" });
    expect(within(group).getAllByRole("checkbox").map((box) => box.getAttribute("aria-label") ?? box.closest("label")?.textContent)).toEqual([
      "Toys & Hobbies3, 3 products",
      "Baby1, 1 product",
      "flower2, 2 products",
    ]);
    expect(within(group).getByRole("heading", { name: "Other categories" })).toBeInTheDocument();
  });

  it("opens with the categories a link names, and sorts by price across shops", async () => {
    const world = makeWorld({ shops: 3, productsPerShop: 3 });
    world.shops[0].products[2].price = [{ currency: "qort", value: 0.5 }];
    renderProducts({ world, path: "/products?category=Kitchen&sort=price-asc" });
    await waitFor(() => expect(cards()).toHaveLength(6));
    // Kitchen: products 0 and 2 of each shop; the cheapest first.
    expect(within(cards()[0]).getByText(/0\.50/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Categories (1)" })).toBeInTheDocument();
  });

  it("searches products and shops, reading every shop's list", async () => {
    const world = makeWorld({ shops: 4, productsPerShop: 12 });
    world.shops[2].title = "Gold corner";
    world.shops[1].products[3].title = "Golden mug";
    const { node } = renderProducts({ world });
    await waitFor(() => expect(cards()).toHaveLength(20));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search products" }), { target: { value: "gold" } });
    await waitFor(() => expect(screen.getByText("13 results for “gold”")).toBeInTheDocument());
    expect(cards().filter((card) => within(card).queryByRole("link", { name: shopLink("Gold corner") }))).toHaveLength(12);
    expect(titles()).toContain("Golden mug");
    expect(dataContainers(node)).toBe(4);
    expect(location()).toBe("/products?q=gold");
  });

  it("adds a product to its own shop's cart", async () => {
    const { store } = renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(20));
    fireEvent.click(await screen.findByRole("button", { name: "Add to cart: Product 11 (Shop number 23)" }));
    const cart = cartFor(store.getState().cart.carts, "Seller 23", "q-store-general-shop-23");
    expect(Object.values(cart?.orders ?? {})).toEqual([
      { productId: "q-store-product-shop-23-P000000011", catalogueId: "q-store-catalogue-shop-23-CAT0000001", quantity: 1 },
    ]);
    expect(await screen.findByText(/Added to cart/)).toBeInTheDocument();
  });

  it("shows your own products without Add to cart", async () => {
    renderProducts({ user: "Seller 23" });
    await waitFor(() => expect(cards()).toHaveLength(20));
    expect(within(cards()[0]).getByRole("button", { name: "Your product" })).toBeDisabled();
  });

  it("leaves out deleted shops and retired products", async () => {
    const world = makeWorld({ shops: 4, productsPerShop: 3 });
    world.shops[3].deleted = "marked";
    world.shops[2].products[2].status = "RETIRED";
    renderProducts({ world });
    await waitFor(() => expect(screen.getByText("That's every product.")).toBeInTheDocument());
    // The cards fill in as their catalogues land (placeholders until then): wait for them, not just the end note.
    await waitFor(() => expect(cards()).toHaveLength(8));
    expect(cards().some((card) => within(card).queryByRole("link", { name: shopLink("Shop number 3") }))).toBe(false);
  });

  it("says so when no shop has products yet", async () => {
    renderProducts({ world: makeWorld({ shops: 2, productsPerShop: 0 }) });
    expect(await screen.findByText("No products yet")).toBeInTheDocument();
  });

  describe("on a phone", () => {
    let restore: () => void = () => {};
    beforeEach(() => {
      restore = mockViewport(PHONE_PORTRAIT);
    });
    afterEach(() => restore());

    it("keeps the categories and in stock only in the Filters sheet", async () => {
      renderProducts({ world: makeWorld({ shops: 3, productsPerShop: 6 }) });
      await waitFor(() => expect(cards()).toHaveLength(18));
      expect(screen.queryByRole("button", { name: "Categories" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Filters" }));
      const sheet = await screen.findByRole("dialog", { name: "Filters" });
      fireEvent.click(await within(sheet).findByRole("checkbox", { name: /Art/ }));
      fireEvent.click(within(sheet).getByRole("switch", { name: "In stock only" }));
      await waitFor(() => expect(within(sheet).getByRole("button", { name: "Show 6 products" })).toBeInTheDocument());
      fireEvent.click(within(sheet).getByRole("button", { name: "Show 6 products" }));
      await waitFor(() => expect(cards()).toHaveLength(6));
      expect(screen.getByRole("button", { name: "Filters (2)" })).toBeInTheDocument();
    });
  });
});
