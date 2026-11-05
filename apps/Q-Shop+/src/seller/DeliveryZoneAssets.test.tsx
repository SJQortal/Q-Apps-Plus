import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { DeliveryZoneDialog } from "./DeliveryZoneDialog";
import { resetAssetRates } from "../money/assetRates";
import { resetAssetCache } from "../qdn/assets";

afterEach(() => {
  vi.unstubAllGlobals();
  resetAssetRates();
  resetAssetCache();
});

describe("a delivery zone's Q-Asset prices", () => {
  it("are typed or filled from the trade portal, rounded up, and saved with the zone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = url.startsWith("/assets/info")
          ? { assetId: 88, name: "BHC Coin", isDivisible: true }
          : url.startsWith("/assets/trades/recent?assetid=0&otherassetid=88")
            ? [{ amount: "5.5", otherAmount: "100", timestamp: 1 }]
            : [];
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
      })
    );
    const onSave = vi.fn();
    renderWithProviders(
      <DeliveryZoneDialog
        zone={{ id: "eu", countries: ["PL"], first: 2, extra: 1 }}
        currency="USD"
        // 1 USD = 5 QORT
        qortPerUnit={5}
        assets={[{ id: 88, name: "BHC Coin", price: { from: "market" } }]}
        newId={() => "z"}
        onSave={onSave}
        onClose={() => {}}
      />
    );
    const box = screen.getByRole("region", { name: "In Q-Assets" });
    expect(within(box).getByText("Empty: converts at the trade portal price.")).toBeInTheDocument();
    fireEvent.click(within(box).getByRole("button", { name: "Fill from the trade portal" }));
    // $2 = 10 QORT = 181.82 BHC Coin at 0.055 (rounded up); $1 = 5 QORT = 90.91.
    await waitFor(() => expect(within(box).getByRole("textbox", { name: "First item in BHC Coin" })).toHaveValue("181.82"));
    expect(within(box).getByRole("textbox", { name: "Each extra item in BHC Coin" })).toHaveValue("90.91");
    fireEvent.change(within(box).getByRole("textbox", { name: "First item in BHC Coin" }), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "Save zone" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "eu", first: 2, extra: 1, assets: { "88": { first: 180, extra: 90.91 } } }));
  });
});
