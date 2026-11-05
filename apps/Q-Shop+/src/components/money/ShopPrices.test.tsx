import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { resetRates } from "../../money/rates";
import { pricedCoins, ShopPrices } from "./ShopPrices";

const product = {
  price: [
    { currency: "qort", value: 10 },
    { currency: "ASSET:81", value: 3 },
    { currency: "ASSET:83", value: 7 },
    { currency: "ASSET:84", value: 1.5 },
  ],
};
const shop = (assets: { id: number; name: string }[]) => ({
  supportedCoins: ["QORT", "ARRR"],
  foreignCoins: { ARRR: "zs1arrr" },
  acceptedAssets: assets,
});

beforeEach(() => {
  resetRates();
  // 0.5 ARRR per QORT (the node answers × 1e8).
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "50000000" })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prices in every coin the shop takes", () => {
  it("lists the buyer's coin first, converts ARRR, and leaves out an asset the product has no price in", () => {
    const coins = pricedCoins(product, shop([{ id: 81, name: "Gold" }, { id: 82, name: "Silver" }]), "ARRR", { ARRR: 0.5 });
    expect(coins).toEqual([
      { coin: "ARRR", value: 5, converted: true },
      { coin: "QORT", value: 10, converted: false },
      { coin: "ASSET:81", value: 3, converted: false },
    ]);
  });

  it("shows two or three prices side by side", async () => {
    renderWithProviders(<ShopPrices product={product} shop={shop([{ id: 81, name: "Gold" }])} preferred="QORT" />);
    expect(screen.getByText("10.00")).toBeInTheDocument();
    const also = screen.getByRole("list", { name: "Also priced in" });
    await waitFor(() => expect(within(also).getByText("5.00")).toBeInTheDocument());
    expect(within(also).getByText("Gold")).toBeInTheDocument();
    expect(within(also).getByText("3.00")).toBeInTheDocument();
    expect(screen.getByText("ARRR at the Trade Portal rate: 1 QORT ≈ 0.50 ARRR.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more price/ })).toBeNull();
  });

  it("puts a fourth coin and more in a list behind a button", async () => {
    renderWithProviders(
      <ShopPrices
        product={product}
        shop={shop([{ id: 81, name: "Gold" }, { id: 83, name: "Seats" }, { id: 84, name: "Locked" }])}
        preferred="QORT"
      />
    );
    const also = screen.getByRole("list", { name: "Also priced in" });
    expect(within(also).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Seats")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "2 more prices" }));
    const more = await screen.findByRole("list", { name: "More prices" });
    expect(within(more).getByText("Seats")).toBeInTheDocument();
    expect(within(more).getByText("7.00")).toBeInTheDocument();
    expect(within(more).getByText("Locked")).toBeInTheDocument();
  });

  it("shows one price for a shop that takes QORT only", () => {
    renderWithProviders(<ShopPrices product={product} shop={{}} preferred="QORT" />);
    expect(screen.getByText("10.00")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Also priced in" })).toBeNull();
  });
});
