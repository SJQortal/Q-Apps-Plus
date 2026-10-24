/**
 * The seller's Delivery tab (delivery/model.ts) against the mocked Hub and
 * node: zones and shipping profiles drafted, then published as one DOCUMENT
 * `q-store-delivery-<short>`; published prices read back; and the tab
 * following the shop's currency. Nothing reaches a real node.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer } from "../state/features/globalSlice";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock } from "../test/qortalMock";
import {
  DATA_CONTAINER_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
  SHORT_STORE_ID,
  STORE_ID,
  catalogue,
  chair,
  dataContainer,
  decodeData64,
  viewedStore,
} from "../test/fixtures/shop";
import { ProductManager } from "../pages/ProductManager/ProductManager";
import { deliveryIdentifier } from "../qdn/identifiers";
import { EU_COUNTRIES } from "../constants/shipping";

const DELIVERY_ID = deliveryIdentifier(SHORT_STORE_ID);

function setup(opts: { delivery?: unknown; index?: Record<string, unknown> } = {}) {
  const index = opts.index ?? dataContainer;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const [path] = String(input).split("?");
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      if (path === "/arbitrary/resources/search") {
        return ok(opts.delivery && String(input).includes(DELIVERY_ID) ? [{ name: SELLER, service: "DOCUMENT", identifier: DELIVERY_ID }] : []);
      }
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DELIVERY_ID}`) return ok(opts.delivery);
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DATA_CONTAINER_ID}`) return ok(index);
      return { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
    })
  );
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
  store.dispatch(setDataContainer(index));
  const q = installQortalMock({
    FETCH_QDN_RESOURCE: async () => structuredClone(catalogue),
    PUBLISH_QDN_RESOURCE: async () => true,
  });
  renderWithProviders(
    <Routes>
      <Route path="/product-manager/:store" element={<ProductManager />} />
    </Routes>,
    { store, initialEntries: [`/product-manager/${STORE_ID}?tab=delivery`] }
  );
  return { store, q };
}

const dialog = () => screen.findByRole("dialog");
const card = (name: string) => screen.findByRole("region", { name: `Shipping profile: ${name}` });

afterEach(() => vi.unstubAllGlobals());

describe("the Delivery tab", () => {
  it("drafts zones and a shipping profile with its products, then publishes them as one DOCUMENT", async () => {
    const { q } = setup();
    const general = await card("General");
    expect(within(general).getByText(/No zones yet/)).toBeInTheDocument();

    // General: the whole of the USA, 2.5 QORT and 1 QORT for each extra item.
    fireEvent.click(within(general).getByRole("button", { name: "Add a zone" }));
    let d = await dialog();
    fireEvent.click(within(d).getByRole("button", { name: "USA: the United States, every state" }));
    fireEvent.change(within(d).getByLabelText(/^First item/), { target: { value: "2.5" } });
    fireEvent.change(within(d).getByLabelText(/^Each extra item/), { target: { value: "1" } });
    // The form works an example out as you type.
    expect(within(d).getByRole("status", { name: "Example" })).toHaveTextContent("3 items: 2.50 QORT + 2 × 1.00 QORT = 4.50 QORT");
    fireEvent.click(within(d).getByRole("button", { name: "Save zone" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(general).getByText("2.50 QORT · 1.00 QORT each extra item")).toBeInTheDocument();

    // A profile for the chair, delivered to the EU at 10 QORT.
    fireEvent.click(screen.getByRole("button", { name: "Add a shipping profile" }));
    d = await dialog();
    fireEvent.change(within(d).getByLabelText("Profile name"), { target: { value: "Heavy items" } });
    fireEvent.click(within(d).getByRole("button", { name: "Save name" }));
    const heavy = await card("Heavy items");
    fireEvent.click(within(heavy).getByRole("button", { name: "Choose products" }));
    d = await dialog();
    fireEvent.click(await within(d).findByRole("checkbox", { name: new RegExp(chair.title) }));
    fireEvent.click(within(d).getByRole("button", { name: "Use 1 product" }));
    await waitFor(() => expect(within(heavy).getByText("1 product")).toBeInTheDocument());
    fireEvent.click(within(heavy).getByRole("button", { name: "Add a zone" }));
    d = await dialog();
    // Save says what's missing, and the message goes as soon as the zone is changed.
    fireEvent.click(within(d).getByRole("button", { name: "Save zone" }));
    expect(within(d).getByRole("alert")).toHaveTextContent("Tick where this zone delivers to.");
    fireEvent.click(within(d).getByRole("button", { name: "European Union" }));
    expect(within(d).queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.change(within(d).getByLabelText(/^First item/), { target: { value: "10" } });
    fireEvent.click(within(d).getByRole("button", { name: "Save zone" }));
    await waitFor(() => expect(within(heavy).getByText("10.00 QORT")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Publish delivery prices" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const publish = q.callsFor("PUBLISH_QDN_RESOURCE")[0] as any;
    expect(publish).toMatchObject({ name: SELLER, service: "DOCUMENT", identifier: DELIVERY_ID, filename: "delivery.json" });
    const doc = decodeData64(publish.data64);
    expect(doc).toEqual({
      v: 1,
      storeId: STORE_ID,
      currency: "QORT",
      general: { zones: [{ id: expect.any(String), countries: ["US"], first: 2.5, extra: 1 }] },
      profiles: [
        {
          id: expect.any(String),
          name: "Heavy items",
          products: [chair.id],
          zones: [{ id: expect.any(String), countries: expect.arrayContaining([...EU_COUNTRIES]), first: 10 }],
        },
      ],
      updated: expect.any(Number),
    });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Publish delivery prices" })).not.toBeInTheDocument());
  });

  it("shows the published prices, and asks to check them when the shop prices in another currency now", async () => {
    const delivery = {
      v: 1,
      storeId: STORE_ID,
      currency: "QORT",
      general: { zones: [{ id: "eu", name: "Europe", countries: ["PL", "DE"], first: 3, freeOver: 50 }] },
      profiles: [],
      updated: 1,
    };
    const index = { ...dataContainer, fiatPricing: { currency: "USD", rates: { QORT: 0.2 }, updated: 1 } };
    setup({ delivery, index });
    const general = await card("General");
    expect(within(general).getByText("Europe")).toBeInTheDocument();
    expect(within(general).getByText("3.00 QORT · free from 50.00 QORT")).toBeInTheDocument();
    const warning = screen.getByText(/These prices are in QORT, but the shop now prices in USD/);
    expect(warning).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use USD" }));
    expect(within(general).getByText("$3.00 · free from $50.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish delivery prices" })).toBeInTheDocument();
  });
});
