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
  mug,
  poster,
  viewedStore,
} from "../test/fixtures/shop";
import { ProductManager } from "../pages/ProductManager/ProductManager";
import { deliveryIdentifier } from "../qdn/identifiers";
import { EU_COUNTRIES } from "../constants/shipping";
import { collectionDrafts, collectionsDraftKey } from "./useCollections";

const DELIVERY_ID = deliveryIdentifier(SHORT_STORE_ID);

function setup(opts: { delivery?: unknown; index?: Record<string, unknown>; shop?: Record<string, unknown> } = {}) {
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
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER, ...opts.shop }));
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
    fireEvent.change(within(d).getByLabelText("Name buyers see"), { target: { value: "Heavy items" } });
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

    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
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
    await waitFor(() => expect(screen.queryByRole("region", { name: "Unpublished changes" })).not.toBeInTheDocument());
  });

  it("starts a first zone in one step: everywhere the shop ships, at the price typed", async () => {
    setup({ shop: { shippingCountries: ["PT", "ES", "FR"] } });
    fireEvent.click(await screen.findByRole("button", { name: "One price everywhere you ship" }));
    const dialog = await screen.findByRole("dialog", { name: "New delivery zone" });
    // Zones have no names: they're called by where they go.
    expect(within(dialog).queryByRole("textbox", { name: /^Zone name/ })).toBeNull();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^First item/ }), { target: { value: "4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save zone" }));
    const general = await screen.findByRole("region", { name: "Shipping profile: General" });
    expect(await within(general).findByText(/France, Portugal and Spain|Portugal, Spain and France|3 countries/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "One price everywhere you ship" })).toBeNull();
  });

  it("chooses a profile's products by collection, or all of them; digital ones go last, greyed, and can't be picked", async () => {
    collectionDrafts.set(collectionsDraftKey(SELLER, STORE_ID), [{ id: "SEATSxxxx1", title: "Seats", description: "", products: [chair.id, mug.id], created: 1, updated: 1 }]);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Add a shipping profile" }));
    let d = await dialog();
    fireEvent.change(within(d).getByLabelText("Name buyers see"), { target: { value: "Heavy items" } });
    fireEvent.click(within(d).getByRole("button", { name: "Save name" }));
    fireEvent.click(within(await card("Heavy items")).getByRole("button", { name: "Choose products" }));
    d = await dialog();
    const list = within(d).getByRole("list", { name: "Products to choose from" });
    // Grouped by collection: the chair under Seats; the digital mug and poster at the bottom, greyed.
    const seats = await within(list).findByRole("checkbox", { name: /^Seats/ });
    expect(await within(list).findByText("Digital products: never delivered")).toBeInTheDocument();
    expect(within(list).getByRole("checkbox", { name: new RegExp(mug.title) })).toBeDisabled();
    expect(within(list).getByRole("checkbox", { name: new RegExp(poster.title) })).toBeDisabled();
    fireEvent.click(seats);
    expect(within(d).getByRole("button", { name: "Use 1 product" })).toBeInTheDocument();
    fireEvent.click(seats);
    expect(within(d).getByRole("button", { name: "Use 0 products" })).toBeInTheDocument();
    // Select all takes what can be delivered.
    fireEvent.click(within(d).getByRole("button", { name: "Select all" }));
    expect(within(d).getByRole("button", { name: "Use 1 product" })).toBeInTheDocument();
    fireEvent.click(within(d).getByRole("button", { name: "Select none" }));
    expect(within(d).getByRole("button", { name: "Use 0 products" })).toBeInTheDocument();
  });

  it("a change put back as it was leaves nothing to publish", async () => {
    setup();
    const options = await screen.findByRole("region", { name: "Delivery options" });
    fireEvent.click(within(options).getByRole("button", { name: "Express" }));
    expect(await screen.findByRole("region", { name: "Unpublished changes" })).toBeInTheDocument();
    fireEvent.click(within(options).getByRole("button", { name: "Remove the option Express" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Unpublished changes" })).toBeNull());
  });

  it("adds delivery options buyers pick from, each priced in the zones that offer it", async () => {
    const { q } = setup();
    const options = await screen.findByRole("region", { name: "Delivery options" });
    fireEvent.change(within(options).getByLabelText("Note (optional)", { selector: "input[placeholder='5–10 days']" }), { target: { value: "5–10 days" } });
    fireEvent.click(within(options).getByRole("button", { name: "Express" }));
    fireEvent.change(within(options).getAllByLabelText("Note (optional)")[1], { target: { value: "1–3 days" } });
    fireEvent.click(within(options).getByRole("button", { name: "Tracked" }));
    const general = await card("General");
    fireEvent.click(within(general).getByRole("button", { name: "Add a zone" }));
    const d = await dialog();
    fireEvent.click(within(d).getByRole("button", { name: "USA: the United States, every state" }));
    expect(within(d).getByText("Price: Standard")).toBeInTheDocument();
    fireEvent.change(within(d).getAllByLabelText(/^First item/)[0], { target: { value: "3" } });
    fireEvent.click(within(d).getByRole("switch", { name: "Offer Express here" }));
    fireEvent.change(within(within(d).getByRole("region", { name: "Express in this zone" })).getByLabelText(/^First item/), { target: { value: "12" } });
    fireEvent.click(within(d).getByRole("button", { name: "Save zone" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(general).getByText("Standard: 3.00 QORT")).toBeInTheDocument();
    expect(within(general).getByText("Express: 12.00 QORT")).toBeInTheDocument();
    // An option without a name can't be published.
    fireEvent.change(within(options).getByLabelText("Option 3"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
    expect(await screen.findByText("Name each delivery option, or remove it.")).toBeInTheDocument();
    fireEvent.click(within(options).getByRole("button", { name: "Remove the option 3" }));
    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const doc = decodeData64((q.callsFor("PUBLISH_QDN_RESOURCE")[0] as any).data64);
    expect(doc.base).toEqual({ name: "Standard", note: "5–10 days" });
    expect(doc.options).toEqual([{ id: expect.any(String), name: "Express", note: "1–3 days" }]);
    expect(doc.general.zones[0]).toMatchObject({ countries: ["US"], first: 3, rates: { [doc.options[0].id]: { first: 12 } } });
  });

  it("adds a pickup point with its country, address, days and hours, with no shipping option needed", async () => {
    const { q } = setup();
    const points = await screen.findByRole("region", { name: "Pickup points" });
    fireEvent.click(within(points).getByRole("button", { name: "Add a pickup point" }));
    // It's a pickup point, not a delivery option.
    expect(within(screen.getByRole("region", { name: "Delivery options" })).queryByLabelText("Option 2")).toBeNull();
    const point = within(points).getByRole("group", { name: "Pickup point: Pick up" });
    // Weekdays 10–18 to start with; Saturday added, Monday taken off.
    expect(within(point).getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(point).getByRole("button", { name: "Sat" }));
    fireEvent.click(within(point).getByRole("button", { name: "Mon" }));
    // Hours are typed or picked from the list: "5:30 pm" is 17:30.
    const to = within(point).getByRole("combobox", { name: /^To/ });
    fireEvent.change(to, { target: { value: "5:30 pm" } });
    fireEvent.keyDown(to, { key: "Enter" });
    const general = await card("General");
    fireEvent.click(within(general).getByRole("button", { name: "Add a zone" }));
    const d = await dialog();
    fireEvent.click(within(d).getByRole("button", { name: "USA: the United States, every state" }));
    // A pickup point isn't priced by zone.
    expect(within(d).queryByRole("switch", { name: "Offer Pick up here" })).toBeNull();
    fireEvent.change(within(d).getAllByLabelText(/^First item/)[0], { target: { value: "3" } });
    fireEvent.click(within(d).getByRole("button", { name: "Save zone" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
    expect(await screen.findByText("Give each pickup point its country, address and the days it's open.")).toBeInTheDocument();
    fireEvent.change(within(point).getByRole("combobox", { name: /Country/ }), { target: { value: "Portugal" } });
    fireEvent.click(await screen.findByRole("option", { name: "Portugal" }));
    fireEvent.change(within(point).getByLabelText(/^Pickup address/), { target: { value: "Rua Augusta 10, Lisbon" } });
    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const doc = decodeData64((q.callsFor("PUBLISH_QDN_RESOURCE")[0] as any).data64);
    expect(doc.options).toEqual([
      { id: expect.any(String), name: "Pick up", pickup: true, place: { country: "PT", address: "Rua Augusta 10, Lisbon", days: [2, 3, 4, 5, 6], from: "10:00", to: "17:30" } },
    ]);
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
    // A zone named by an earlier build shows by where it goes.
    expect(within(general).queryByText("Europe")).toBeNull();
    expect(within(general).getByText(/Germany and Poland|Poland and Germany|2 countries/)).toBeInTheDocument();
    expect(within(general).getByText("3.00 QORT · free from 50.00 QORT")).toBeInTheDocument();
    const warning = screen.getByText(/These prices are in QORT, but the shop now prices in USD/);
    expect(warning).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use USD" }));
    expect(within(general).getByText("$3.00 · free from $50.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Publish changes/ })).toBeInTheDocument();
  });
});
