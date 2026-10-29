import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { SHIPPING_REGIONS } from "../constants/shipping";
import type { CartLine } from "../money/order";
import type { DeliveryDoc } from "./model";
import type { ShopDelivery } from "./checkoutDelivery";
import { ProductDelivery } from "./ProductDelivery";
import { setBuyerPlace } from "./buyerPlace";

const STORE = "q-store-general-shop-1";
const EUROPE = [...SHIPPING_REGIONS[0].codes];
let delivery: ShopDelivery | Error = { doc: null, pricing: null };
vi.mock("./checkoutDelivery", () => ({
  loadShopDelivery: vi.fn(async () => {
    if (delivery instanceof Error) throw delivery;
    return delivery;
  }),
}));

const doc: DeliveryDoc = {
  v: 1,
  storeId: STORE,
  currency: "QORT",
  base: { name: "Standard", note: "5–10 days" },
  options: [{ id: "exp", name: "Express", note: "1–3 days, tracked" }, { id: "pick", name: "Local pickup" }],
  general: { zones: [{ id: "eu", name: "Europe", countries: EUROPE, first: 2, extra: 0.5, freeOver: 50, rates: { exp: { first: 6 }, pick: { first: 0 } } }] },
  profiles: [],
  updated: 1,
};
const line = (quantity = 1): CartLine => ({ productId: "mug", catalogueId: "c", quantity, product: { title: "Mug", type: "physical", price: [{ currency: "qort", value: 10 }] } as never });
const shop = { title: "Plus Gadgets", shipsTo: "Europe", shippingCountries: EUROPE, supportedCoins: ["QORT"] };

function show(quantity = 1) {
  return renderWithProviders(<ProductDelivery owner="Shop+Plus" storeId={STORE} shop={shop} line={line(quantity)} />);
}

beforeEach(() => {
  localStorage.clear();
  delivery = { doc, pricing: null };
});
afterEach(() => act(() => setBuyerPlace(null)));

describe("delivery on a product page", () => {
  it("asks for the buyer's country, then prices each option there", async () => {
    show();
    const section = await screen.findByRole("region", { name: "Delivery" });
    expect(within(section).getByText(/Choose your country to see what delivery costs, and the options the shop offers/)).toBeInTheDocument();
    expect(within(section).getByText(/Ships to Europe/)).toBeInTheDocument();
    act(() => setBuyerPlace({ country: "Portugal", state: "" }));
    const priced = await screen.findByRole("region", { name: "Delivery to Portugal" });
    const options = within(priced).getByRole("list", { name: "Delivery options" });
    const rows = within(options).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toMatch(/Standard5–10 days.*2\.00/);
    expect(rows[1]).toMatch(/Express1–3 days, tracked.*6\.00/);
    expect(rows[2]).toMatch(/Local pickupFree/);
    expect(within(priced).getByText(/Free delivery once this shop's items in your order reach 50\.00 QORT/)).toBeInTheDocument();
  });

  it("prices the quantity chosen", async () => {
    act(() => setBuyerPlace({ country: "Portugal", state: "" }));
    show(3);
    const priced = await screen.findByRole("region", { name: "Delivery to Portugal, for 3" });
    expect(within(priced).getAllByRole("listitem")[0].textContent).toMatch(/3\.00/);
  });

  it("says when the shop doesn't ship to the buyer's country", async () => {
    act(() => setBuyerPlace({ country: "Japan", state: "" }));
    show();
    expect(await screen.findByText("Plus Gadgets doesn't ship to Japan.")).toBeInTheDocument();
  });

  it("lets the buyer change the country", async () => {
    act(() => setBuyerPlace({ country: "Portugal", state: "" }));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    const dialog = await screen.findByRole("dialog", { name: "Deliver to" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Forget it" }));
    expect(await screen.findByRole("button", { name: "Choose your country" })).toBeInTheDocument();
  });

  it("without delivery prices, says where the shop ships, and if not to the buyer", async () => {
    delivery = { doc: null, pricing: null };
    act(() => setBuyerPlace({ country: "Japan", state: "" }));
    show();
    expect(await screen.findByText("Doesn't ship to Japan.")).toBeInTheDocument();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("when the node can't serve the prices, leaves them to checkout", async () => {
    delivery = new Error("offline");
    show();
    expect(await screen.findByText(/couldn't be read from your node right now; checkout works them out/)).toBeInTheDocument();
  });

  it("says where it ships from, with where the shop ships", async () => {
    renderWithProviders(<ProductDelivery owner="Shop+Plus" storeId={STORE} shop={{ ...shop, location: "Lisbon" }} line={line()} />);
    expect(await screen.findByText(/^Ships from Lisbon · to Europe/)).toBeInTheDocument();
  });

  it("offers to forget only a country picked here, not one from the address kept at checkout", async () => {
    const { PlacePickerDialog } = await import("./PlacePickerDialog");
    const view = renderWithProviders(<PlacePickerDialog place={{ country: "Portugal", state: "" }} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Forget it" })).toBeNull();
    view.unmount();
    act(() => setBuyerPlace({ country: "Portugal", state: "" }));
    renderWithProviders(<PlacePickerDialog place={{ country: "Portugal", state: "" }} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Forget it" })).toBeInTheDocument();
  });
});
