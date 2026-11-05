/**
 * The shop checkup on the Overview (seller/checkup.ts, ShopCheckup.tsx): an
 * older shop's steps, Fix categories putting category-only edits in the
 * drafts, retiring delivery-fee products, and Edit shop opening Shop Settings.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within, configure } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer } from "../state/features/globalSlice";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock } from "../test/qortalMock";
import { installVisibleIntersectionObserver } from "../test/mockNode";
import { resetQdnCaches } from "../qdn/search";
import { CATALOGUE_ID, SELLER, SELLER_ADDRESS, SELLER_PK, STORE_ID, catalogue, chair, dataContainer, mug, poster, viewedStore } from "../test/fixtures/shop";
import { ProductManager } from "../pages/ProductManager/ProductManager";

vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });

const postage = { ...poster, id: poster.id.replace("POSTER", "POSTAG"), title: "Postage to Europe", category: "Shipping" };

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.search}</p>;
}

function setup(over: { store?: Record<string, unknown>; products?: Record<string, unknown> } = {}) {
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER, ...over.store }));
  const products = { ...dataContainer.products, ...over.products };
  store.dispatch(setDataContainer({ ...dataContainer, products }));
  const cat = { ...catalogue, products: { ...catalogue.products, [postage.id]: postage } };
  installQortalMock({ FETCH_QDN_RESOURCE: async () => structuredClone(cat) });
  renderWithProviders(
    <Routes>
      <Route
        path="/product-manager/:store"
        element={
          <>
            <ProductManager />
            <Where />
          </>
        }
      />
    </Routes>,
    { store, initialEntries: [`/product-manager/${STORE_ID}`] }
  );
  return store;
}

beforeEach(() => {
  installVisibleIntersectionObserver();
  resetQdnCaches();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => [], text: async () => "[]" })));
});
afterEach(() => vi.unstubAllGlobals());

describe("the shop checkup", () => {
  it("lists an older shop's steps, and Fix categories drafts each product in its suggested category only", async () => {
    const store = setup();
    const card = await screen.findByRole("region", { name: "Get your shop ready for Q-Shop+" });
    const steps = within(card).getByRole("list", { name: "Steps" });
    await waitFor(() => expect(within(steps).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent)).toEqual(expect.arrayContaining(["Pick categories from the list", "Choose where you ship", "Set delivery prices"])));
    expect(within(card).getByText(/3 products still use a category from before/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Fix categories" }));
    const dialog = await screen.findByRole("dialog", { name: "Fix categories" });
    // Each title's suggestion is picked ("Chair" is furniture: Home & Garden).
    await waitFor(() => expect(within((within(dialog).getByText(chair.title).closest("li") as HTMLElement)).getByRole("combobox")).toHaveTextContent("Home & Garden"));
    fireEvent.click(within(dialog).getByRole("button", { name: /^Add \d+ to drafts$/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Fix categories" })).toBeNull());
    const drafts = store.getState().global.productsToSave as Record<string, any>;
    expect(drafts[chair.id]).toMatchObject({ id: chair.id, title: chair.title, category: "Home & Garden", isUpdate: true, catalogueId: CATALOGUE_ID, user: SELLER, price: chair.price });
    expect(within(card).getByText(/ready to publish with their new categories/)).toBeInTheDocument();
    void mug;
  });

  it("asks a new shop for its first product, and Add product opens the form", async () => {
    const store = createAppStore();
    store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
    store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
    store.dispatch(setDataContainer({ ...dataContainer, products: {}, catalogues: [] }));
    installQortalMock({});
    renderWithProviders(
      <Routes>
        <Route path="/product-manager/:store" element={<ProductManager />} />
      </Routes>,
      { store, initialEntries: [`/product-manager/${STORE_ID}`] }
    );
    const card = await screen.findByRole("region", { name: "Get your shop ready for Q-Shop+" });
    expect(within(card).getByText("Add your first product")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Add product" }));
    expect(await screen.findByRole("dialog", { name: "Add product" })).toBeInTheDocument();
  });

  it("retires the products that charged delivery, once the shop has delivery prices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const rows = String(url).includes("q-store-delivery-") ? [{ name: SELLER, service: "DOCUMENT", identifier: "q-store-delivery-my-shop" }] : [];
        const doc = { v: 1, storeId: STORE_ID, currency: "QORT", general: { zones: [] }, profiles: [], updated: 1 };
        if (String(url).includes("/arbitrary/DOCUMENT/")) return { ok: true, status: 200, json: async () => doc, text: async () => JSON.stringify(doc) };
        return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
      })
    );
    const store = setup({ products: { [postage.id]: { created: 5, priceQort: 2, category: "Shipping", catalogueId: CATALOGUE_ID, status: "AVAILABLE" } } });
    const card = await screen.findByRole("region", { name: "Get your shop ready for Q-Shop+" });
    fireEvent.click(await within(card).findByRole("button", { name: "Retire them" }));
    const dialog = await screen.findByRole("dialog", { name: "Retire the delivery-fee products?" });
    expect(within(dialog).getByText(/Postage to Europe/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Retire it" }));
    await waitFor(() => expect((store.getState().global.productsToSave as Record<string, any>)[postage.id]).toMatchObject({ status: "RETIRED", isUpdate: true }));
  });

  it("Edit shop opens Shop Settings with its form open", async () => {
    setup({ store: { logo: "" } });
    const card = await screen.findByRole("region", { name: "Get your shop ready for Q-Shop+" });
    fireEvent.click(within(card).getAllByRole("button", { name: "Edit shop" })[0]);
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("tab=shop"));
    expect(screen.getByTestId("where").textContent).toContain("edit=1");
  });
});

describe("the ships-to picker of an older shop", () => {
  it("offers its typed text as countries, in one tap", async () => {
    const { ShipsToPicker } = await import("./ShipsToPicker");
    const onChange = vi.fn();
    renderWithProviders(<ShipsToPicker value={null} onChange={onChange} typed="USA (50 States)" />);
    expect(screen.getByText(/From what you typed \("USA \(50 States\)"\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use United States" }));
    expect(onChange).toHaveBeenCalledWith(["US"]);
  });
});
