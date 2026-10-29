import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { createAppStore } from "../state/store";
import { setPreferredCoin } from "../state/features/storeSlice";
import { useShopCoin } from "./useShopCoin";
import { resetAssetRates } from "./assetRates";
import { resetCoinRates } from "./coinRate";
import { resetAssetCache } from "../qdn/assets";
import { unitPrice } from "./pricing";

const shop = { supportedCoins: ["QORT"], acceptedAssets: [{ id: 81, name: "Gold Bar", price: { from: "market" as const } }] };

function Probe() {
  const { coin, rate, rateLoading, rateError, assetRate } = useShopCoin(shop);
  return (
    <p data-testid="probe">
      {coin} {String(rate)} {String(rateLoading)} {String(rateError)} {assetRate?.source ?? "-"} {String(unitPrice({ price: [{ currency: "qort", value: 3 }] }, coin, rate))}
    </p>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetAssetRates();
  resetCoinRates();
  resetAssetCache();
});

describe("paying a shop in a Q-Asset", () => {
  it("converts at the trade portal's price when the shop says so", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = url.startsWith("/assets/info")
          ? { assetId: 81, name: "Gold Bar", isDivisible: true }
          : url.startsWith("/assets/trades/recent?assetid=0&otherassetid=81")
            ? [{ amount: "20", otherAmount: "10", timestamp: 1 }]
            : [];
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
      })
    );
    const store = createAppStore();
    store.dispatch(setPreferredCoin("ASSET:81"));
    renderWithProviders(<Probe />, { store });
    // 3 QORT at 2 QORT a Gold Bar: 1.5.
    expect(await screen.findByText("ASSET:81 0.5 false false trade 1.5")).toBeInTheDocument();
  });
});
