/**
 * The cart page's states (empty, signed out, loading from the node, items
 * that can't be bought), editing the cart, and how checkout ends when Hub
 * says no or recording fails. Payments themselves are pinned in
 * Cart.pin.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { addToHashMapStores, setPreferredCoin } from "../../state/features/storeSlice";
import { setCatalogueHashMap } from "../../state/features/globalSlice";
import { cartFor, setIsOpen, setProductToCart } from "../../state/features/cartSlice";
import { installQortalMock, type QortalMock } from "../../test/qortalMock";
import { installMockNode, makeWorld } from "../../test/mockNode";
import { renderWithProviders } from "../../test/renderWithProviders";
import {
  BUYER,
  BUYER_ADDRESS,
  BUYER_PK,
  CATALOGUE_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
  STORE_ID,
  STORE_TITLE,
  catalogue,
  mug,
  poster,
  viewedStore,
} from "../../test/fixtures/shop";
import { listPendingOrders } from "../../money/pendingOrders";
import { CartPage } from "./CartPage";

vi.mock("short-unique-id", () => ({
  default: class {
    constructor(opts?: { length?: number }) {
      return () => (opts?.length === 10 ? "ORDERxxxx1" : "MAILx1");
    }
  },
}));

type Store = ReturnType<typeof createAppStore>;

function newStore(opts: { signedIn?: boolean } = {}): Store {
  const store = createAppStore();
  if (opts.signedIn ?? true) store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: BUYER_PK, name: BUYER }));
  return store;
}

/** The fixture shop, already loaded by a shop page (store JSON and catalogue in Redux). */
function withFixtureShop(store: Store, items: { product: any; qty: number }[], shopExtra: object = {}) {
  store.dispatch(addToHashMapStores({ ...viewedStore, ...shopExtra, owner: SELLER, isValid: true }));
  store.dispatch(setCatalogueHashMap({ ...catalogue, user: SELLER, isValid: true }));
  for (const { product, qty } of items) {
    store.dispatch(
      setProductToCart({ productId: product.id, catalogueId: CATALOGUE_ID, storeId: STORE_ID, storeOwner: SELLER, quantity: qty })
    );
  }
}

function renderCart(store: Store) {
  return renderWithProviders(
    <Routes>
      <Route path="/cart" element={<CartPage />} />
      <Route path="/" element={<p>Home page</p>} />
      <Route path="/my-orders" element={<p>My orders page</p>} />
    </Routes>,
    { store, initialEntries: ["/cart"] }
  );
}

function sellerMock(extra: Record<string, (p: any) => unknown> = {}): QortalMock {
  return installQortalMock({
    GET_NAME_DATA: async () => ({ name: SELLER, owner: SELLER_ADDRESS }),
    GET_ACCOUNT_DATA: async () => ({ address: SELLER_ADDRESS, publicKey: SELLER_PK }),
    SEND_COIN: async () => ({ signature: "PAYSIG" }),
    PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true,
    ...extra,
  });
}

async function press(name: string | RegExp) {
  const dialog = await screen.findByRole("dialog");
  const button = await within(dialog).findByRole("button", { name });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

async function openCheckout(title = STORE_TITLE) {
  const button = await screen.findByRole("button", { name: `Check out ${title}` });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  return screen.findByRole("dialog");
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.startsWith("/arbitrary/resources/search")) return { ok: true, status: 200, json: async () => [], text: async () => "[]" };
      throw new Error(`unexpected fetch ${u}`);
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cart page", () => {
  it("is empty with a way to shops, and lowers the open-cart flag", async () => {
    const store = newStore();
    store.dispatch(setIsOpen(true));
    renderCart(store);
    expect(screen.getByRole("heading", { level: 1, name: "Cart" })).toBeInTheDocument();
    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
    await waitFor(() => expect(store.getState().cart.isOpen).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Browse shops" }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("keeps the cart when signed out and asks to sign in to check out", async () => {
    const store = newStore({ signedIn: false });
    withFixtureShop(store, [{ product: mug, qty: 2 }]);
    renderCart(store);
    expect(screen.getByText("Sign in to check out. Your cart stays on this device.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Check out ${STORE_TITLE}` })).toBeDisabled();
    expect(screen.getByText("Sign in to check out.")).toBeInTheDocument();
  });

  it("explains that orders need a registered name", () => {
    const store = createAppStore();
    store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: BUYER_PK }));
    withFixtureShop(store, [{ product: mug, qty: 1 }]);
    renderCart(store);
    expect(screen.getByRole("button", { name: `Check out ${STORE_TITLE}` })).toBeDisabled();
    expect(screen.getByText(/register one in Hub to check out/)).toBeInTheDocument();
  });

  it("shows each line with its price, line total and subtotal in the shop's coin", () => {
    const store = newStore();
    withFixtureShop(store, [
      { product: mug, qty: 2 },
      { product: poster, qty: 1 },
    ]);
    renderCart(store);
    expect(screen.getByText("3 items from 1 shop")).toBeInTheDocument();
    const shop = screen.getByRole("region", { name: STORE_TITLE });
    const items = within(shop).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("link", { name: "Mug" })).toHaveAttribute(
      "href",
      `/${encodeURIComponent(SELLER)}/${STORE_ID}/${mug.id}/${CATALOGUE_ID}`
    );
    expect(within(items[0]).getByText("1.50")).toBeInTheDocument();
    expect(within(items[0]).getByText("3.00")).toBeInTheDocument();
    expect(within(items[0]).getByRole("img", { name: "Mug" })).toHaveAttribute("src", mug.images[0]);
    expect(within(shop).getByText("3.10")).toBeInTheDocument();
    expect(within(shop).getByRole("link", { name: STORE_TITLE })).toHaveAttribute(
      "href",
      `/${encodeURIComponent(SELLER)}/${STORE_ID}`
    );
  });

  it("changes quantities, and Undo puts a removed line back in its place", async () => {
    const store = newStore();
    withFixtureShop(store, [
      { product: mug, qty: 2 },
      { product: poster, qty: 1 },
    ]);
    renderCart(store);
    const orders = () => store.getState().cart.carts[STORE_ID]?.orders;

    fireEvent.click(screen.getByRole("button", { name: "More Mug" }));
    expect(orders()[mug.id].quantity).toBe(3);
    expect(screen.getByRole("button", { name: "Fewer Poster" })).toBeDisabled();
    const field = screen.getByRole("textbox", { name: "Quantity of Mug" });
    expect(field).toHaveAttribute("inputmode", "numeric");
    fireEvent.change(field, { target: { value: "7" } });
    fireEvent.blur(field);
    expect(orders()[mug.id].quantity).toBe(7);

    fireEvent.click(screen.getByRole("button", { name: "Remove Mug" }));
    expect(orders()[mug.id]).toBeUndefined();
    expect(await screen.findByText("Mug removed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(Object.keys(orders())).toEqual([mug.id, poster.id]);
    expect(orders()[mug.id].quantity).toBe(7);
  });

  it("loads shops and products it doesn't have from the node, once each, and flags what can't be bought", async () => {
    const world = makeWorld({ shops: 3 });
    const node = installMockNode(world);
    const shop = world.shops[0];
    const cat = `q-store-catalogue-${shop.shortStoreId}-CAT0000000`;
    const store = newStore();
    const add = (productId: string) =>
      store.dispatch(
        setProductToCart({ productId, catalogueId: cat, storeId: `q-store-general-${shop.shortStoreId}`, storeOwner: shop.owner })
      );
    add(shop.products[1].id); // digital, available
    add(shop.products[2].id); // digital, available
    add(shop.products[5].id); // out of stock
    add(`q-store-product-${shop.shortStoreId}-GONExxxxxx`); // no longer in its catalogue
    renderCart(store);

    // Skeletons first, then the products.
    expect(await screen.findByRole("link", { name: "Product 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Product 2" })).toBeInTheDocument();
    expect(screen.getByText("Out of stock: left out of checkout")).toBeInTheDocument();
    expect(screen.getByText("The seller removed this product: left out of checkout")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: shop.title })).toBeInTheDocument();
    expect(screen.getByText("2 items can't be bought now and are left out of checkout.")).toBeInTheDocument();

    const s = node.summary();
    expect(s.hub).toEqual({ "FETCH q-store-catalogue": 1 });
    expect(s.resources).toEqual({ STORE: 1 });
    expect(s.searches).toEqual({});

    // Checkout takes the two that are for sale and says the rest are left out.
    const dialog = await openCheckout(shop.title);
    expect(within(dialog).getByText("2 items in your cart can't be bought right now and are left out.")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
  });

  it("fetches each owner's copy of a catalogue once, even when two names publish the same identifier", async () => {
    // Another name can publish a catalogue under the seller's identifier (docs/QORTAL.md → pitfall 15).
    const OTHER = "Mallory";
    const OTHER_STORE = "q-store-general-mallory";
    const copyMug = { ...mug, id: "q-store-product-mallory-COPYxxxxxx", title: "Mallory mug" };
    const q = installQortalMock({
      FETCH_QDN_RESOURCE: async (p) => {
        await new Promise((r) => setTimeout(r, 5));
        if (p.name === SELLER) return { ...catalogue };
        if (p.name === OTHER) return { id: CATALOGUE_ID, products: { [copyMug.id]: copyMug } };
        throw { error: 1401, message: "Not found" };
      },
    });
    const store = newStore();
    store.dispatch(addToHashMapStores({ ...viewedStore, owner: SELLER, isValid: true }));
    store.dispatch(addToHashMapStores({ ...viewedStore, id: OTHER_STORE, title: "Mallory's shop", owner: OTHER, isValid: true }));
    store.dispatch(setProductToCart({ productId: mug.id, catalogueId: CATALOGUE_ID, storeId: STORE_ID, storeOwner: SELLER }));
    store.dispatch(setProductToCart({ productId: copyMug.id, catalogueId: CATALOGUE_ID, storeId: OTHER_STORE, storeOwner: OTHER }));
    renderCart(store);

    expect(await screen.findByRole("link", { name: "Mug" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Mallory mug" })).toBeInTheDocument();
    // Long enough for a load that evicted the other's copy to start the other's fetch again, several times.
    await new Promise((r) => setTimeout(r, 150));
    expect(q.callsFor("FETCH_QDN_RESOURCE").map((c) => c.name).sort()).toEqual([OTHER, SELLER]);
    expect(screen.getByRole("link", { name: "Mug" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mallory mug" })).toBeInTheDocument();
    // The shared map keeps the first copy it got; the other never replaces it.
    expect(store.getState().global.catalogueHashMap[CATALOGUE_ID]?.user).toBeDefined();
  });

  it("keeps two owners' shops with the same shop id apart, and pays each owner for their own", async () => {
    // Shop ids are the seller's choice: "Shop+Plus" runs a copy under Seller Name's id.
    const world = makeWorld({ shops: 2 });
    const [real, copy] = world.shops;
    copy.shortStoreId = real.shortStoreId;
    copy.title = "Copycat shop";
    copy.products = copy.products.map((p: any, i: number) => ({ ...p, title: `Copy ${i}` }));
    const node = installMockNode(world);
    node.q.on("SEND_COIN", async () => ({ signature: "PAYSIG" }));
    node.q.on("PUBLISH_MULTIPLE_QDN_RESOURCES", async () => true);
    const storeId = `q-store-general-${real.shortStoreId}`;
    const cat = `q-store-catalogue-${real.shortStoreId}-CAT0000000`;
    const store = newStore();
    store.dispatch(setProductToCart({ productId: real.products[1].id, catalogueId: cat, storeId, storeOwner: real.owner }));
    store.dispatch(setProductToCart({ productId: copy.products[2].id, catalogueId: cat, storeId, storeOwner: copy.owner }));
    renderCart(store);

    const realShop = await screen.findByRole("region", { name: real.title });
    const copyShop = await screen.findByRole("region", { name: "Copycat shop" });
    expect(await within(realShop).findByRole("link", { name: "Product 1" })).toBeInTheDocument();
    expect(await within(copyShop).findByRole("link", { name: "Copy 2" })).toBeInTheDocument();
    expect(within(realShop).queryByRole("link", { name: "Copy 2" })).toBeNull();
    expect(screen.getByText("2 items from 2 shops")).toBeInTheDocument();

    await openCheckout("Copycat shop");
    await press("Continue");
    await press(/^Pay /);
    expect(await screen.findByText("Order placed", { selector: "p" })).toBeInTheDocument();
    expect(node.q.callsFor("GET_NAME_DATA").map((c) => c.name)).toEqual([copy.owner]);
    expect(node.q.callsFor("SEND_COIN")[0]).toMatchObject({ coin: "QORT", destinationAddress: "QShopPlusAddress", amount: "3.00000000" });
    // Only the copy's cart was bought; Seller Name's stays.
    expect(cartFor(store.getState().cart.carts, copy.owner, storeId)).toBeUndefined();
    expect(Object.keys(cartFor(store.getState().cart.carts, real.owner, storeId)!.orders)).toEqual([real.products[1].id]);
  });

  it("explains a product without a price in the chosen coin, and won't go on", async () => {
    const store = newStore();
    withFixtureShop(store, [{ product: mug, qty: 1 }], { acceptedAssets: [{ id: 81, name: "Gold Bar" }] });
    store.dispatch(setPreferredCoin("ASSET:81"));
    renderCart(store);
    expect(screen.getByText("No price in Gold Bar")).toBeInTheDocument();
    const dialog = await openCheckout();
    expect(within(dialog).getByText(/Mug has no price in Gold Bar\. Pick another coin/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Continue" })).toBeDisabled();

    // Picking QORT prices it again.
    fireEvent.click(within(dialog).getByRole("button", { name: "QORT" }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Continue" })).toBeEnabled());
  });

  it("goes back to Confirm when the payment is declined, with nothing paid and the cart kept", async () => {
    const q = sellerMock({
      SEND_COIN: async () => {
        throw { error: "User declined request" };
      },
    });
    const store = newStore();
    withFixtureShop(store, [{ product: mug, qty: 2 }]);
    renderCart(store);
    await openCheckout();
    await press("Continue");
    expect(screen.getByText("Hub asks you to confirm the payment, then to record your order (2 steps).")).toBeInTheDocument();
    await press(/^Pay 3\.00 QORT$/);
    expect(await screen.findByText("You declined the payment in Hub. Nothing was paid.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pay / })).toBeEnabled();
    expect(q.callsFor("SEND_COIN")).toHaveLength(1);
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(store.getState().cart.carts[STORE_ID]).toBeDefined();
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("when recording fails after paying, finishes the order from the dialog without paying again", async () => {
    let publishes = 0;
    const q = sellerMock({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        publishes++;
        if (publishes === 1) throw { error: "User declined request" };
        return true;
      },
    });
    const store = newStore();
    withFixtureShop(store, [{ product: mug, qty: 1 }]);
    renderCart(store);
    await openCheckout();
    await press("Continue");
    await press(/^Pay /);

    expect(await screen.findByText("Payment sent — the order isn't recorded yet")).toBeInTheDocument();
    // Paid: the line has left the cart and the order waits to be finished.
    expect(store.getState().cart.carts[STORE_ID]).toBeUndefined();
    expect(listPendingOrders(BUYER)).toHaveLength(1);

    await press("Finish order");
    expect(await screen.findByText(`${STORE_TITLE} has your order and a Q-Mail about it. Follow it in My orders.`)).toBeInTheDocument();
    expect(q.callsFor("SEND_COIN")).toHaveLength(1);
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(2);
    expect(listPendingOrders(BUYER)).toEqual([]);
    await press("View my orders");
    expect(await screen.findByText("My orders page")).toBeInTheDocument();
  });

  it("stops before paying when the seller can't be found, and says nothing was paid", async () => {
    const q = sellerMock({
      GET_ACCOUNT_DATA: async () => ({ address: SELLER_ADDRESS }),
    });
    const store = newStore();
    withFixtureShop(store, [{ product: mug, qty: 1 }]);
    renderCart(store);
    await openCheckout();
    await press("Continue");
    await press(/^Pay /);
    expect(await screen.findByText(/Cannot find the store owner/)).toHaveTextContent("Nothing was paid.");
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
    expect(store.getState().cart.carts[STORE_ID]).toBeDefined();
  });

  it("keeps lines that were left out of a checkout in the cart", async () => {
    sellerMock();
    const store = newStore();
    const retired = { ...poster, id: "q-store-product-my-shop-RETIREDxx", status: "RETIRED" };
    withFixtureShop(store, [{ product: mug, qty: 1 }]);
    store.dispatch(
      setCatalogueHashMap({ ...catalogue, products: { ...catalogue.products, [retired.id]: retired }, user: SELLER, isValid: true })
    );
    store.dispatch(setProductToCart({ productId: retired.id, catalogueId: CATALOGUE_ID, storeId: STORE_ID, storeOwner: SELLER }));
    renderCart(store);
    await openCheckout();
    await press("Continue");
    await press(/^Pay /);
    expect(await screen.findByText("Order placed", { selector: "p" })).toBeInTheDocument();
    expect(Object.keys(store.getState().cart.carts[STORE_ID].orders)).toEqual([retired.id]);
  });
});
