import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { renderWithProviders } from "../test/renderWithProviders";
import { AssetPriceSetting } from "./AssetPriceSetting";
import { resetAssetRates, type AssetPricing } from "../money/assetRates";
import { shopFormValues, toStoreFields } from "./shopFields";

afterEach(() => {
  vi.unstubAllGlobals();
  resetAssetRates();
});

function Harness({ onPricing }: { onPricing: (p: AssetPricing | undefined) => void }) {
  const [value, setValue] = useState<AssetPricing | undefined>(undefined);
  return (
    <AssetPriceSetting
      assetId={88}
      label="BHC Coin"
      value={value}
      onChange={(p) => {
        setValue(p);
        onPricing(p);
      }}
    />
  );
}

describe("an accepted asset's prices", () => {
  it("convert at the trade portal's price or the seller's own, filled from the portal in one press", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = url.startsWith("/assets/trades/recent?assetid=0&otherassetid=88") ? [{ amount: "5.5", otherAmount: "100", timestamp: Date.now() - 3_600_000 }] : [];
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
      })
    );
    const onPricing = vi.fn();
    renderWithProviders(<Harness onPricing={onPricing} />);
    expect(screen.getByText(/only for products you give a price in it/)).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Other prices in BHC Coin" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Convert at the trade portal price" }));
    expect(onPricing).toHaveBeenLastCalledWith({ from: "market" });
    expect(await screen.findByText(/1 BHC Coin ≈ 0.055 QORT on the trade portal \(latest trade/)).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Other prices in BHC Coin" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Convert at my own rate" }));
    // Starts from the portal's price; the seller types their own.
    expect(onPricing).toHaveBeenLastCalledWith({ from: "seller", qort: 0.055 });
    fireEvent.change(screen.getByRole("textbox", { name: "1 BHC Coin =" }), { target: { value: "0,06" } });
    expect(onPricing).toHaveBeenLastCalledWith({ from: "seller", qort: 0.06 });
    fireEvent.click(screen.getByRole("button", { name: /Use the trade portal's 0.055/ }));
    await waitFor(() => expect(onPricing).toHaveBeenLastCalledWith({ from: "seller", qort: 0.055 }));
  });

  it("are published with the shop's assets, and gone when set back", () => {
    const store = { id: "q-store-general-shop", title: "S", description: "d", location: "l", shipsTo: "x", logo: "x", acceptedAssets: [{ id: 88, name: "BHC Coin", price: { from: "market" } }] };
    const values = shopFormValues(store as never);
    expect(values.assets).toEqual([{ id: 88, name: "BHC Coin", price: { from: "market" } }]);
    expect(toStoreFields(values).acceptedAssets).toEqual([{ id: 88, name: "BHC Coin", price: { from: "market" } }]);
    expect(toStoreFields({ ...values, assets: [{ id: 88, name: "BHC Coin" }] }).acceptedAssets).toEqual([{ id: 88, name: "BHC Coin" }]);
  });
});
