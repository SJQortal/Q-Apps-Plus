import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { SHIPPING_REGIONS } from "../../constants/shipping";
import type { CartLine } from "../../money/order";
import type { DeliveryDoc } from "../../delivery/model";
import type { ShopDelivery } from "../../delivery/checkoutDelivery";
import { setBuyerPlace } from "../../delivery/buyerPlace";
import { CartDelivery } from "./CartDelivery";
import { FreeDeliveryBar } from "../../delivery/FreeDeliveryBar";

const STORE = "q-store-general-shop-1";
const EUROPE = [...SHIPPING_REGIONS[0].codes];
let delivery: ShopDelivery = { doc: null, pricing: null };
vi.mock("../../delivery/checkoutDelivery", () => ({ loadShopDelivery: vi.fn(async () => delivery) }));

const doc = (over: Partial<DeliveryDoc> = {}): DeliveryDoc => ({
  v: 1,
  storeId: STORE,
  currency: "QORT",
  general: { zones: [{ id: "eu", countries: EUROPE, first: 2, extra: 0.5, freeOver: 50, rates: { exp: { first: 6 }, pick: { first: 0 } } }] },
  profiles: [],
  updated: 1,
  ...over,
});
const line = (type = "physical", quantity = 1): CartLine => ({ productId: `p-${type}`, catalogueId: "c", quantity, product: { title: "Mug", type, price: [{ currency: "qort", value: 10 }] } as never });
const shop = { title: "Plus Gadgets", shippingCountries: EUROPE, supportedCoins: ["QORT"] };
const show = (lines: CartLine[]) => renderWithProviders(<CartDelivery owner="Shop+Plus" storeId={STORE} shop={shop} lines={lines} />);

beforeEach(() => {
  delivery = { doc: doc(), pricing: null };
});
afterEach(() => act(() => setBuyerPlace(null)));

describe("delivery in the cart", () => {
  it("says it's added at checkout until the buyer has a country, then what it costs", async () => {
    show([line(), line("physical", 2)]);
    expect(await screen.findByText("Delivery is added at checkout.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See it for your country" })).toBeInTheDocument();
    act(() => setBuyerPlace({ country: "Portugal", state: "" }));
    expect(await screen.findByText("Delivery to Portugal:")).toBeInTheDocument();
    // First item 2, two more at 0.5: 3.00.
    expect(screen.getByText("3.00")).toBeInTheDocument();
    expect(screen.getByText("· free from 50.00 QORT")).toBeInTheDocument();
  });

  it("with options: free with one, or from the cheapest paid one", async () => {
    delivery = { doc: doc({ base: { name: "Standard" }, options: [{ id: "exp", name: "Express" }, { id: "pick", name: "Local pickup" }] }), pricing: null };
    act(() => setBuyerPlace({ country: "Portugal", state: "" }));
    show([line()]);
    expect(await screen.findByText("free with Local pickup")).toBeInTheDocument();
    expect(screen.getByText("from")).toBeInTheDocument();
    expect(screen.getByText("2.00")).toBeInTheDocument();
    expect(screen.getByText("· 3 options at checkout")).toBeInTheDocument();
  });

  it("says when the shop doesn't ship there, and nothing for digital carts or shops without prices", async () => {
    act(() => setBuyerPlace({ country: "Japan", state: "" }));
    const japan = show([line()]);
    expect(await screen.findByText("Plus Gadgets doesn't ship to Japan.")).toBeInTheDocument();
    // Another country is a tap away.
    fireEvent.click(screen.getByRole("button", { name: "Check another country" }));
    expect(await screen.findByRole("dialog", { name: "Where should things be delivered?" })).toBeInTheDocument();
    japan.unmount();
    const digital = show([line("digital")]);
    await waitFor(() => expect(digital.container.textContent).toBe(""));
    digital.unmount();
    delivery = { doc: null, pricing: null };
    const none = show([line()]);
    await waitFor(() => expect(none.container.textContent).toBe(""));
  });

  it("shows a bar of how much is left for free delivery there, and when it's reached", async () => {
    act(() => setBuyerPlace({ country: "Portugal", state: "" }));
    const one = renderWithProviders(<FreeDeliveryBar owner="Shop+Plus" storeId={STORE} lines={[line("physical", 2)]} />);
    expect(await screen.findByText("Add 30.00 QORT more for free delivery to Portugal")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "40% of the way to free delivery" })).toHaveAttribute("aria-valuenow", "40");
    one.unmount();
    renderWithProviders(<FreeDeliveryBar owner="Shop+Plus" storeId={STORE} lines={[line("physical", 6)]} />);
    expect(await screen.findByText("Free delivery to Portugal")).toBeInTheDocument();
  });

  it("offers free delivery on the shop's page while the cart has nothing of it", async () => {
    act(() => setBuyerPlace({ country: "Portugal", state: "" }));
    renderWithProviders(<FreeDeliveryBar owner="Shop+Plus" storeId={STORE} lines={[]} framed />);
    expect(await screen.findByText("Free delivery to Portugal on orders from 50.00 QORT")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
